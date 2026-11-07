/** Pure offline-queue logic (unit-tested). No browser APIs here. */

export type OpKind = "activity.create" | "note.create" | "note.update" | "task.create" | "task.complete";
export type OpStatus = "pending" | "syncing" | "synced" | "failed" | "conflict";

export type QueuedOp = {
  opId: string;
  kind: OpKind;
  payload: Record<string, unknown>;
  label: string;
  status: OpStatus;
  attempts: number;
  createdAt: number;
  updatedAt: number;
  nextAttemptAt?: number;
  error?: string;
  serverId?: string;
  server?: { title: string; body: string; version: number };
};

export type ServerResult =
  | { opId: string; status: "synced"; serverId: string }
  | { opId: string; status: "conflict"; serverId: string; server: { title: string; body: string; version: number } }
  | { opId: string; status: "failed"; error: string; retryable: boolean };

export const MAX_ATTEMPTS = 8;

/** Exponential backoff: 5s, 10s, 20s … capped at 10 minutes. */
export function nextRetryDelay(attempts: number) {
  return Math.min(5000 * 2 ** Math.max(0, attempts - 1), 10 * 60_000);
}

/** Ops ready to send now. */
export function dueOps(ops: QueuedOp[], now: number) {
  return ops.filter((o) => (o.status === "pending" || (o.status === "failed" && o.attempts < MAX_ATTEMPTS && o.nextAttemptAt !== undefined)) && (o.nextAttemptAt ?? 0) <= now);
}

/** Apply server results to queued ops. Ops missing from the response are left for retry (never dropped). */
export function applyResults(ops: QueuedOp[], results: ServerResult[], now: number): QueuedOp[] {
  const byId = new Map(results.map((r) => [r.opId, r]));
  return ops.map((op) => {
    const r = byId.get(op.opId);
    if (!r) return op;
    const attempts = op.attempts + 1;
    if (r.status === "synced") return { ...op, status: "synced", serverId: r.serverId, error: undefined, attempts, updatedAt: now, nextAttemptAt: undefined };
    if (r.status === "conflict") return { ...op, status: "conflict", serverId: r.serverId, server: r.server, attempts, updatedAt: now, nextAttemptAt: undefined };
    return {
      ...op,
      status: "failed",
      error: r.error,
      attempts,
      updatedAt: now,
      // non-retryable (validation) failures wait for the user; retryable ones back off
      nextAttemptAt: r.retryable && attempts < MAX_ATTEMPTS ? now + nextRetryDelay(attempts) : undefined,
    };
  });
}

/** Network-level failure: mark sent ops for retry with backoff. */
export function markNetworkFailure(ops: QueuedOp[], sentIds: string[], now: number): QueuedOp[] {
  const sent = new Set(sentIds);
  return ops.map((op) =>
    sent.has(op.opId) ? { ...op, status: "failed", error: "No connection, will retry automatically", attempts: op.attempts + 1, updatedAt: now, nextAttemptAt: now + nextRetryDelay(op.attempts + 1) } : op,
  );
}

export function statusLabel(s: OpStatus) {
  return { pending: "Saved locally · awaiting sync", syncing: "Syncing…", synced: "Synced", failed: "Sync failed", conflict: "Conflict: needs your review" }[s];
}
