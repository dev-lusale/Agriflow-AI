import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { callGrok, GrokUnavailableError, redact, XAI_ENDPOINT } from "./xai";

/**
 * Grok configuration self-test for administrators.
 * Makes small real calls to xAI and reports a safe summary. The API key itself, any part of
 * it, and request headers are never included in the result.
 */

// 64×64 synthetic PNG (green over brown) — used only to confirm image input is accepted.
const PROBE_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAdklEQVR4Xu3SQQ2AQBAEQSD88MIDG6cJn8ghaOBRuaRLwWx61/O+lpltM4//dIBWAa0CWgW0CmgV0CqgVUCrgFYBrQJaBbQKaBXQKqBVQKuAVgGtAto+nkNv+KUX0iqgVUCrgFYBrQJaBbQKaBXQKqBVQJu+wAtkiwKNYxhRCwAAAABJRU5ErkJggg==";

export type ProbeResult = {
  ok: boolean;
  model: string;
  latencyMs: number | null;
  reason?: GrokUnavailableError["reason"] | "UNKNOWN";
  httpStatus?: number;
  message?: string;
  sample?: string;
};

export type DiagnosticsReport = {
  checkedAt: string;
  endpoint: string;
  keyConfigured: boolean;
  textModel: string;
  visionModel: string;
  text: ProbeResult | { skipped: true };
  vision: ProbeResult | { skipped: true };
  last24h: { calls: number; ok: number; fallback: number; errors: number; avgLatencyMs: number | null; lastError: string | null };
  verdict: "working" | "not_configured" | "failing" | "partial";
  advice: string[];
};

function explain(e: unknown, model: string): ProbeResult {
  if (e instanceof GrokUnavailableError) {
    return { ok: false, model, latencyMs: null, reason: e.reason, httpStatus: e.status, message: redact(e.message).slice(0, 240) };
  }
  return { ok: false, model, latencyMs: null, reason: "UNKNOWN", message: redact(String(e)).slice(0, 240) };
}

async function probeText(): Promise<ProbeResult> {
  const model = env.xaiModel;
  try {
    const r = await callGrok({ model, input: [{ role: "user", content: "Reply with exactly the word OK." }], maxOutputTokens: 64, timeoutMs: 25_000, retries: 1 });
    return { ok: true, model: r.model, latencyMs: r.latencyMs, sample: r.text.slice(0, 40) };
  } catch (e) {
    return explain(e, model);
  }
}

async function probeVision(): Promise<ProbeResult> {
  const model = env.xaiVisionModel;
  try {
    const r = await callGrok({
      model,
      input: [{ role: "user", content: [{ type: "input_image", image_url: PROBE_PNG, detail: "low" }, { type: "input_text", text: "Name the two main colours in this image in at most five words." }] }],
      maxOutputTokens: 64,
      timeoutMs: 30_000,
      retries: 1,
    });
    return { ok: true, model: r.model, latencyMs: r.latencyMs, sample: r.text.slice(0, 60) };
  } catch (e) {
    return explain(e, model);
  }
}

function adviceFor(p: ProbeResult): string[] {
  if (p.ok) return [];
  switch (p.reason) {
    case "NOT_CONFIGURED":
      return ["Add XAI_API_KEY in Vercel → Project → Settings → Environment Variables (Production), then redeploy."];
    case "HTTP":
      if (p.httpStatus === 401 || p.httpStatus === 403) return ["xAI rejected the key. Create a new key at console.x.ai, replace XAI_API_KEY in Vercel and redeploy."];
      if (p.httpStatus === 404 || p.httpStatus === 400) return [`Check the model name (${p.model}). Set XAI_MODEL / XAI_VISION_MODEL to a model your xAI team can use.`];
      if (p.httpStatus === 429) return ["Rate limit or credit limit reached on the xAI account. Check usage and billing at console.x.ai."];
      return ["xAI returned a server error. Try again in a few minutes."];
    case "TIMEOUT":
      return ["xAI did not answer in time. Try again; if it persists, check status.x.ai."];
    case "NETWORK":
      return ["The server could not reach api.x.ai. Check the deployment region's outbound network."];
    default:
      return ["Grok returned an unexpected response. Check the server logs."];
  }
}

export async function runGrokDiagnostics(opts: { vision?: boolean; userId: string }): Promise<DiagnosticsReport> {
  const keyConfigured = Boolean(env.xaiApiKey);
  const text = keyConfigured ? await probeText() : explain(new GrokUnavailableError("XAI_API_KEY is not configured", "NOT_CONFIGURED"), env.xaiModel);
  const vision = keyConfigured && opts.vision && text.ok ? await probeVision() : ({ skipped: true } as const);

  for (const [feature, p] of [["diagnostics.text", text], ["diagnostics.vision", vision]] as const) {
    if ("skipped" in p) continue;
    await prisma.aIUsage
      .create({ data: { userId: opts.userId, feature, model: p.model, status: p.ok ? "OK" : "ERROR", latencyMs: p.latencyMs ?? undefined, error: p.ok ? null : (p.message ?? null) } })
      .catch(() => undefined);
  }

  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const rows = await prisma.aIUsage.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true }, _avg: { latencyMs: true } });
  const lastErr = await prisma.aIUsage.findFirst({ where: { createdAt: { gte: since }, status: "ERROR" }, orderBy: { createdAt: "desc" }, select: { error: true } });
  const count = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;
  const okRow = rows.find((r) => r.status === "OK");

  const advice = [...adviceFor(text), ...("skipped" in vision ? [] : adviceFor(vision))];
  const verdict: DiagnosticsReport["verdict"] = !keyConfigured
    ? "not_configured"
    : !text.ok
      ? "failing"
      : "skipped" in vision || vision.ok
        ? "working"
        : "partial";

  return {
    checkedAt: new Date().toISOString(),
    endpoint: XAI_ENDPOINT,
    keyConfigured,
    textModel: env.xaiModel,
    visionModel: env.xaiVisionModel,
    text,
    vision,
    last24h: {
      calls: rows.reduce((n, r) => n + r._count._all, 0),
      ok: count("OK"),
      fallback: count("FALLBACK"),
      errors: count("ERROR"),
      avgLatencyMs: okRow?._avg.latencyMs ? Math.round(okRow._avg.latencyMs) : null,
      lastError: lastErr?.error ? redact(lastErr.error).slice(0, 200) : null,
    },
    verdict,
    advice,
  };
}
