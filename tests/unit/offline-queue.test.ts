import { describe, expect, it } from "vitest";
import { applyResults, dueOps, markNetworkFailure, MAX_ATTEMPTS, nextRetryDelay, type QueuedOp } from "@/lib/offline/queue-logic";

const op = (id: string, over: Partial<QueuedOp> = {}): QueuedOp => ({ opId: id, kind: "activity.create", payload: {}, label: id, status: "pending", attempts: 0, createdAt: 0, updatedAt: 0, ...over });

describe("offline sync queue", () => {
  it("backs off exponentially, capped at 10 minutes", () => {
    expect(nextRetryDelay(1)).toBe(5000);
    expect(nextRetryDelay(2)).toBe(10000);
    expect(nextRetryDelay(20)).toBe(600000);
  });

  it("selects pending and due retryable ops only", () => {
    const now = 1000;
    const ops = [op("a"), op("b", { status: "synced" }), op("c", { status: "failed", attempts: 1, nextAttemptAt: 500 }), op("d", { status: "failed", attempts: 1, nextAttemptAt: 5000 }), op("e", { status: "failed", attempts: 1 }), op("f", { status: "conflict" })];
    expect(dueOps(ops, now).map((o) => o.opId)).toEqual(["a", "c"]);
  });

  it("applies server results without dropping unanswered ops", () => {
    const ops = [op("a"), op("b"), op("c"), op("d")];
    const out = applyResults(
      ops,
      [
        { opId: "a", status: "synced", serverId: "s1" },
        { opId: "b", status: "conflict", serverId: "s2", server: { title: "t", body: "server", version: 3 } },
        { opId: "c", status: "failed", error: "Invalid farm", retryable: false },
      ],
      100,
    );
    expect(out.find((o) => o.opId === "a")).toMatchObject({ status: "synced", serverId: "s1" });
    expect(out.find((o) => o.opId === "b")).toMatchObject({ status: "conflict", server: { version: 3 } });
    expect(out.find((o) => o.opId === "c")).toMatchObject({ status: "failed", nextAttemptAt: undefined });
    expect(out.find((o) => o.opId === "d")).toMatchObject({ status: "pending" }); // untouched, still queued
  });

  it("schedules retries after network failure and stops after max attempts", () => {
    const out = markNetworkFailure([op("a"), op("b")], ["a"], 0);
    expect(out[0]).toMatchObject({ status: "failed", attempts: 1, nextAttemptAt: 5000 });
    expect(out[1]!.status).toBe("pending");
    const exhausted = applyResults([op("x", { attempts: MAX_ATTEMPTS - 1 })], [{ opId: "x", status: "failed", error: "boom", retryable: true }], 0);
    expect(exhausted[0]!.nextAttemptAt).toBeUndefined();
  });
});
