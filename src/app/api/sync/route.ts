import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { AppError, httpStatus } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { applySyncBatch } from "@/server/sync/service";

/** POST /api/sync — applies queued offline operations (idempotent by opId). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    await rateLimit(`sync:${user.id}`, 120, 3600);
    const body = await req.json().catch(() => null);
    const results = await applySyncBatch({ id: user.id, role: user.role }, body);
    return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid sync payload" }, { status: 400 });
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: httpStatus[e.code] });
    console.error("[sync]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
