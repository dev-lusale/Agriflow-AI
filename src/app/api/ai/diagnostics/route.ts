import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/roles";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { runGrokDiagnostics } from "@/server/ai/diagnostics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/ai/diagnostics[?vision=1] — administrators only.
 * Runs a small live call to xAI Grok and returns a safe status report.
 * The API key is never returned, logged or echoed in any form.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!isAdminRole(user.role)) return NextResponse.json({ error: "Administrators only" }, { status: 403 });
  try {
    // Each run spends a few tokens; keep it to a handful per admin per 10 minutes.
    await rateLimit(`ai-diag:${user.id}`, 6, 600);
  } catch (e) {
    if (e instanceof AppError && e.code === "RATE_LIMITED") return NextResponse.json({ error: e.message }, { status: 429 });
    throw e;
  }
  const vision = new URL(req.url).searchParams.get("vision") === "1";
  const report = await runGrokDiagnostics({ vision, userId: user.id });
  return NextResponse.json(report, { status: 200, headers: { "Cache-Control": "no-store" } });
}
