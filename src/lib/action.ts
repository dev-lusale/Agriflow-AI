import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { AppError, type ActionResult } from "@/lib/errors";

export type Actor = { id: string; role: import("@prisma/client").Role };

/** Convert any thrown error into a safe ActionResult (never leaks internals). */
export function toActionError(e: unknown): ActionResult<never> {
  if (e instanceof AppError) return { ok: false, error: e.message, code: e.code, fieldErrors: e.fieldErrors };
  if (e instanceof z.ZodError) {
    return { ok: false, error: "Please check the highlighted fields.", code: "VALIDATION", fieldErrors: flattenZod(e) };
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    return { ok: false, error: "A record with these details already exists.", code: "CONFLICT" };
  }
  // Next.js redirect/notFound errors must propagate
  if (e && typeof e === "object" && "digest" in e && typeof (e as { digest: unknown }).digest === "string" && String((e as { digest: string }).digest).startsWith("NEXT_")) {
    throw e;
  }
  console.error("[action] unexpected error", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export function flattenZod(e: z.ZodError) {
  const out: Record<string, string[]> = {};
  for (const issue of e.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Parse FormData or plain objects with a zod schema. Empty strings become undefined. */
export function parseInput<T extends z.ZodTypeAny>(schema: T, input: FormData | Record<string, unknown>): z.infer<T> {
  const obj: Record<string, unknown> = {};
  if (input instanceof FormData) {
    for (const [k, v] of input.entries()) {
      if (typeof v !== "string") continue;
      const val = v.trim() === "" ? undefined : v;
      if (k.endsWith("[]")) {
        const key = k.slice(0, -2);
        ((obj[key] as unknown[]) ??= []).push(v);
      } else obj[k] = val;
    }
  } else {
    for (const [k, v] of Object.entries(input)) obj[k] = typeof v === "string" && v.trim() === "" ? undefined : v;
  }
  return schema.parse(obj);
}

export async function runAction<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message };
  } catch (e) {
    return toActionError(e);
  }
}
