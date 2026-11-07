import "server-only";
import { z } from "zod";
import type { Actor } from "@/lib/action";
import { AppError } from "@/lib/errors";
import { createNote, createTask, recordActivity, setTaskStatus, updateNote } from "@/server/farms/service";

/**
 * Offline synchronisation endpoint logic.
 * Only low-risk farm records can be created offline (activities, notes, tasks, task completion).
 * Orders and financial transactions are never accepted through sync.
 * Each operation carries a client-generated id → retries are idempotent.
 */
export const syncOpSchema = z.discriminatedUnion("kind", [
  z.object({ opId: z.string().min(8).max(64), kind: z.literal("activity.create"), payload: z.record(z.string(), z.unknown()) }),
  z.object({ opId: z.string().min(8).max(64), kind: z.literal("note.create"), payload: z.record(z.string(), z.unknown()) }),
  z.object({
    opId: z.string().min(8).max(64),
    kind: z.literal("note.update"),
    payload: z.object({ id: z.string(), title: z.string().max(140), body: z.string().max(5000), baseVersion: z.number().int().min(1) }),
  }),
  z.object({ opId: z.string().min(8).max(64), kind: z.literal("task.create"), payload: z.record(z.string(), z.unknown()) }),
  z.object({ opId: z.string().min(8).max(64), kind: z.literal("task.complete"), payload: z.object({ id: z.string() }) }),
]);
export const syncBatchSchema = z.object({ ops: z.array(syncOpSchema).min(1).max(50) });

export type SyncOp = z.infer<typeof syncOpSchema>;
export type SyncResult =
  | { opId: string; status: "synced"; serverId: string }
  | { opId: string; status: "conflict"; serverId: string; server: { title: string; body: string; version: number } }
  | { opId: string; status: "failed"; error: string; retryable: boolean };

export async function applySyncBatch(actor: Actor, raw: unknown): Promise<SyncResult[]> {
  if (actor.role !== "FARMER") throw new AppError("Offline sync is available to farmer accounts.", "FORBIDDEN");
  const { ops } = syncBatchSchema.parse(raw);
  const results: SyncResult[] = [];
  for (const op of ops) {
    try {
      switch (op.kind) {
        case "activity.create": {
          const a = await recordActivity(actor, { ...(op.payload as object), clientId: op.opId } as Parameters<typeof recordActivity>[1]);
          results.push({ opId: op.opId, status: "synced", serverId: a.id });
          break;
        }
        case "note.create": {
          const n = await createNote(actor, { ...(op.payload as object), clientId: op.opId } as Parameters<typeof createNote>[1]);
          results.push({ opId: op.opId, status: "synced", serverId: n.id });
          break;
        }
        case "note.update": {
          const r = await updateNote(actor, op.payload.id, op.payload);
          if (r.conflict) results.push({ opId: op.opId, status: "conflict", serverId: op.payload.id, server: { title: r.current.title, body: r.current.body, version: r.current.version } });
          else results.push({ opId: op.opId, status: "synced", serverId: r.note.id });
          break;
        }
        case "task.create": {
          const t = await createTask(actor, { ...(op.payload as object), clientId: op.opId } as Parameters<typeof createTask>[1]);
          results.push({ opId: op.opId, status: "synced", serverId: t.id });
          break;
        }
        case "task.complete": {
          const t = await setTaskStatus(actor, op.payload.id, "DONE");
          results.push({ opId: op.opId, status: "synced", serverId: t.id });
          break;
        }
      }
    } catch (e) {
      const msg = e instanceof AppError ? e.message : e instanceof z.ZodError ? "Some fields are invalid." : "Server error";
      const retryable = !(e instanceof AppError) && !(e instanceof z.ZodError);
      results.push({ opId: op.opId, status: "failed", error: msg, retryable });
    }
  }
  return results;
}
