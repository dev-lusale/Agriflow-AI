"use client";

import * as React from "react";
import Link from "next/link";
import { CloudOff, RefreshCw, RotateCcw, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { ACTIVITY_LABEL, ACTIVITY_TYPES } from "@/lib/labels";
import { allOps, cacheGet, cacheSet, enqueue, keepMineOnConflict, onQueueChange, removeOp, retryOp, syncNow } from "@/lib/offline/queue";
import { statusLabel, type QueuedOp } from "@/lib/offline/queue-logic";
import type { FarmOpt } from "@/components/farm/forms";
import { cn, toDateInput } from "@/lib/utils";

const TONE: Record<QueuedOp["status"], "amber" | "blue" | "green" | "red"> = { pending: "amber", syncing: "blue", synced: "green", failed: "red", conflict: "red" };

/** Works without a connection: drafts are stored on this device (IndexedDB) and synced automatically. */
export default function OfflinePage() {
  const [online, setOnline] = React.useState(true);
  const [ops, setOps] = React.useState<QueuedOp[]>([]);
  const [farms, setFarms] = React.useState<FarmOpt[] | null>(null);
  const [kind, setKind] = React.useState<"activity" | "note" | "task">("activity");

  React.useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const refresh = () => void allOps().then(setOps).catch(() => setOps([]));
    refresh();
    const unsub = onQueueChange(refresh);
    (async () => {
      const cached = await cacheGet<FarmOpt[]>("farm-options").catch(() => undefined);
      if (cached) setFarms(cached);
      if (navigator.onLine) {
        try {
          const res = await fetch("/api/me/farm-options", { credentials: "same-origin", cache: "no-store" });
          if (res.ok) {
            const j = (await res.json()) as { farms: FarmOpt[] };
            setFarms(j.farms);
            await cacheSet("farm-options", j.farms);
          } else if (!cached) setFarms([]);
        } catch {
          if (!cached) setFarms([]);
        }
        void syncNow();
      } else if (!cached) setFarms([]);
    })();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      unsub();
    };
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const p: Record<string, unknown> = {};
    fd.forEach((v, k) => typeof v === "string" && v.trim() !== "" && (p[k] = v));
    const farm = farms?.find((f) => f.id === p.farmId);
    if (kind === "activity") {
      if (!p.farmId || !p.type || !p.date) return toast.error("Choose a farm, activity and date.");
      p.recordExpense = "on";
      await enqueue("activity.create", p, `${ACTIVITY_LABEL[p.type as keyof typeof ACTIVITY_LABEL]} · ${farm?.name ?? ""} · ${p.date}`);
    } else if (kind === "note") {
      if (!p.title || !p.body) return toast.error("Add a title and a note.");
      await enqueue("note.create", p, `Note · ${p.title}`);
    } else {
      if (!p.title || !p.dueDate) return toast.error("Add a task and due date.");
      await enqueue("task.create", { ...p, reminder: "on" }, `Task · ${p.title}`);
    }
    e.currentTarget.reset();
    toast.success(navigator.onLine ? "Saved. Syncing now…" : "Saved on this device. It will sync when you're back online.");
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Logo />
          <Badge tone={online ? "green" : "amber"}>
            {online ? <Wifi className="size-3.5" /> : <CloudOff className="size-3.5" />} {online ? "Online" : "Offline"}
          </Badge>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold">Offline farm records</h1>
          <p className="mt-1 text-sm text-navy-500">Record activities, notes and tasks without a connection. Each item shows whether it is saved locally, syncing, synced or failed. Nothing is discarded automatically.</p>
        </div>
        {!online && (
          <Alert tone="amber" icon={<CloudOff />} title="You are offline">
            Marketplace orders, payments and AI features need a connection and are not available offline.
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>New record</CardTitle>
            <div className="mt-2 inline-flex rounded-xl border border-border p-1 text-sm">
              {(["activity", "note", "task"] as const).map((k) => (
                <button key={k} onClick={() => setKind(k)} className={cn("rounded-lg px-3 py-1 font-medium capitalize", kind === k ? "bg-forest-800 text-white" : "text-navy-600")}>
                  {k}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {farms === null ? (
              <p className="text-sm text-navy-500">Loading…</p>
            ) : farms.length === 0 && kind !== "note" ? (
              <p className="text-sm text-navy-600">
                Sign in as a farmer while online once, so your farm list is available offline.{" "}
                <Link href="/auth/login?next=/offline" className="font-semibold text-forest-700">
                  Sign in
                </Link>
              </p>
            ) : (
              <form key={kind} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
                {(kind !== "note" || farms.length > 0) && (
                  <Field label="Farm" required={kind === "activity"}>
                    <Select name="farmId" defaultValue={farms[0]?.id}>
                      {kind !== "activity" && <option value="">Not farm-specific</option>}
                      {farms.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                {kind === "activity" && (
                  <>
                    <Field label="Activity" required>
                      <Select name="type" defaultValue="PLANTING">
                        {ACTIVITY_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {ACTIVITY_LABEL[t]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Date" required>
                      <Input name="date" type="date" defaultValue={toDateInput(new Date())} />
                    </Field>
                    <Field label="Cost (ZMW)">
                      <Input name="cost" type="number" step="0.01" min={0} inputMode="decimal" />
                    </Field>
                    <Field label="Quantity">
                      <Input name="quantity" type="number" step="0.01" min={0} />
                    </Field>
                    <Field label="Unit">
                      <Input name="unit" placeholder="bags, kg, hours" />
                    </Field>
                    <Field label="Notes" className="sm:col-span-2">
                      <Textarea name="notes" rows={3} />
                    </Field>
                  </>
                )}
                {kind === "note" && (
                  <>
                    <Field label="Title" required className="sm:col-span-2">
                      <Input name="title" />
                    </Field>
                    <Field label="Note" required className="sm:col-span-2">
                      <Textarea name="body" rows={5} />
                    </Field>
                  </>
                )}
                {kind === "task" && (
                  <>
                    <Field label="Task" required>
                      <Input name="title" />
                    </Field>
                    <Field label="Due date" required>
                      <Input name="dueDate" type="date" defaultValue={toDateInput(new Date())} />
                    </Field>
                  </>
                )}
                <div className="sm:col-span-2">
                  <Button type="submit">Save {online ? "" : "on this device"}</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Sync queue</CardTitle>
            <Button size="sm" variant="outline" onClick={() => void syncNow()} disabled={!online}>
              <RefreshCw /> Sync now
            </Button>
          </CardHeader>
          <CardContent>
            {ops.length === 0 ? (
              <p className="text-sm text-navy-500">No offline records on this device.</p>
            ) : (
              <ul className="divide-y divide-border">
                {ops.map((o) => (
                  <li key={o.opId} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{o.label}</p>
                        <p className="text-xs text-navy-500">
                          Saved {new Date(o.createdAt).toLocaleString("en-ZM")}
                          {o.attempts ? ` · ${o.attempts} attempt(s)` : ""}
                        </p>
                        {o.error && <p className="mt-0.5 text-xs text-red-600">{o.error}</p>}
                      </div>
                      <Badge tone={TONE[o.status]}>{statusLabel(o.status)}</Badge>
                    </div>
                    {o.status === "conflict" && o.server && (
                      <div className="mt-2 rounded-lg bg-harvest-50 p-3 text-xs text-harvest-900">
                        <p className="font-semibold">This note was changed elsewhere. Server version:</p>
                        <p className="mt-1 whitespace-pre-wrap">{o.server.title}: {o.server.body}</p>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" onClick={() => void keepMineOnConflict(o.opId)}>
                            Keep my version
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void removeOp(o.opId)}>
                            Keep server version
                          </Button>
                        </div>
                      </div>
                    )}
                    {(o.status === "failed" || o.status === "synced") && (
                      <div className="mt-2 flex gap-2">
                        {o.status === "failed" && (
                          <Button size="sm" variant="outline" onClick={() => void retryOp(o.opId)} disabled={!online}>
                            <RotateCcw /> Retry
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (o.status === "synced" || window.confirm("Discard this unsynced record? It will be lost.")) void removeOp(o.opId);
                          }}
                        >
                          <Trash2 /> {o.status === "synced" ? "Clear" : "Discard"}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <p className="text-center text-sm">
          <Link href="/farmer/dashboard" className="font-semibold text-forest-700">
            Back to dashboard
          </Link>
        </p>
      </main>
    </div>
  );
}
