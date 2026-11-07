import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env, isAIConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

/** GET /api/health — deployment check (no secrets are returned). */
export async function GET() {
  let database = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "unreachable";
  }
  return NextResponse.json(
    {
      status: database === "ok" ? "ok" : "degraded",
      database,
      ai: isAIConfigured() ? "configured" : "not_configured",
      aiModel: env.xaiModel,
      weatherProvider: env.weatherProvider,
      storage: env.supabaseUrl && env.supabaseServiceKey ? "supabase" : "database",
      email: env.resendApiKey ? "resend" : "not_configured",
      demoMode: env.demoMode,
      time: new Date().toISOString(),
    },
    { status: database === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
