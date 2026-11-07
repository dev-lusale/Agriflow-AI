"use client";

import { openDB, type IDBPDatabase } from "idb";
import { applyResults, dueOps, markNetworkFailure, type OpKind, type QueuedOp, type ServerResult } from "./queue-logic";

/**
 * Browser-side offline queue stored in IndexedDB (per device, per browser profile).
 * Holds only low-risk farm drafts (activities, notes, tasks). Never orders or payments.
 * Cleared on sign-out.
 */
const DB_NAME = "agriflow-offline";
const EVENT = "agriflow:queue";

type Schema = { ops: { key: string; value: QueuedOp }; cache: { key: string; value: unknown } };

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;
function db() {
  dbPromise ??= openDB<Schema>(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore("ops", { keyPath: "opId" });
      d.createObjectStore("cache");
    },
  });
  return dbPromise;
}

const emit = () => window.dispatchEvent(new Event(EVENT));

export function onQueueChange(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

export function newOpId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function enqueue(kind: OpKind, payload: Record<string, unknown>, label: string) {
  const now = Date.now();
  const op: QueuedOp = { opId: newOpId(), kind, payload, label, status: "pending", attempts: 0, createdAt: now, updatedAt: now };
  await (await db()).put("ops", op);
  emit();
  void syncNow();
  return op;
}

export async function allOps(): Promise<QueuedOp[]> {
  const ops = await (await db()).getAll("ops");
  return ops.sort((a, b) => b.createdAt - a.createdAt);
}

export async function removeOp(opId: string) {
  await (await db()).delete("ops", opId);
  emit();
}

export async function retryOp(opId: string) {
  const d = await db();
  const op = await d.get("ops", opId);
  if (op) await d.put("ops", { ...op, status: "pending", nextAttemptAt: undefined, error: undefined });
  emit();
  void syncNow();
}

/** Resolve a note conflict by re-submitting the local version on top of the server version. */
export async function keepMineOnConflict(opId: string) {
  const d = await db();
  const op = await d.get("ops", opId);
  if (!op || op.status !== "conflict" || !op.server) return;
  await d.put("ops", { ...op, status: "pending", payload: { ...op.payload, baseVersion: op.server.version }, server: undefined, error: undefined });
  emit();
  void syncNow();
}

let syncing = false;
export async function syncNow() {
  if (syncing || typeof navigator === "undefined" || !navigator.onLine) return;
  syncing = true;
  try {
    const d = await db();
    const ops = await d.getAll("ops");
    const due = dueOps(ops, Date.now()).slice(0, 50);
    if (!due.length) return;
    for (const op of due) await d.put("ops", { ...op, status: "syncing" });
    emit();
    let results: ServerResult[] | null = null;
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops: due.map(({ opId, kind, payload }) => ({ opId, kind, payload })) }),
        credentials: "same-origin",
      });
      if (res.status === 401) {
        results = due.map((o) => ({ opId: o.opId, status: "failed", error: "Sign in again to sync", retryable: true }));
      } else if (res.ok) {
        results = ((await res.json()) as { results: ServerResult[] }).results;
      }
    } catch {
      results = null;
    }
    const fresh = await d.getAll("ops");
    const updated = results ? applyResults(fresh, results, Date.now()) : markNetworkFailure(fresh, due.map((o) => o.opId), Date.now());
    const tx = d.transaction("ops", "readwrite");
    for (const op of updated) await tx.store.put(op.status === "syncing" ? { ...op, status: "pending" } : op);
    await tx.done;
    // prune synced ops older than 7 days
    for (const op of updated) if (op.status === "synced" && Date.now() - op.updatedAt > 7 * 86400_000) await d.delete("ops", op.opId);
    emit();
  } finally {
    syncing = false;
  }
}

export async function cacheSet(key: string, value: unknown) {
  await (await db()).put("cache", value, key);
}
export async function cacheGet<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get("cache", key)) as T | undefined;
}

export async function clearOfflineData() {
  try {
    const d = await db();
    await d.clear("ops");
    await d.clear("cache");
    emit();
  } catch {
    /* ignore */
  }
}

let started = false;
/** Start background sync: on reconnect, on focus, and every 30 s. */
export function startSyncLoop() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => void syncNow());
  window.addEventListener("focus", () => void syncNow());
  setInterval(() => void syncNow(), 30_000);
  void syncNow();
}
