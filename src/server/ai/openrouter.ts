import "server-only";
import { env } from "@/lib/env";
import { backoffMs, GrokUnavailableError, isRetryable, redact, type GrokCall, type GrokResult, type InputMessage } from "./xai";

/**
 * Server-side client for OpenRouter's Chat Completions API (POST https://openrouter.ai/api/v1/chat/completions).
 * It takes the same call shape as the Grok client, so the AI service can use either one.
 * The key is read from the server environment only and never reaches the app.
 */
export const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

type ChatPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail?: string } };
type ChatMessage = { role: "system" | "user" | "assistant"; content: string | ChatPart[] };

type ChatPayload = {
  model?: string;
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: number } | string;
};

/** Convert Responses-style input (input_text / input_image) to Chat Completions messages. */
export function toChatMessages(input: InputMessage[]): ChatMessage[] {
  return input.map((m) => {
    if (typeof m.content === "string") return { role: m.role, content: m.content };
    const parts: ChatPart[] = m.content.map((c) =>
      c.type === "input_text" ? { type: "text", text: c.text } : { type: "image_url", image_url: { url: c.image_url, ...(c.detail ? { detail: c.detail } : {}) } },
    );
    return { role: m.role, content: parts };
  });
}

export function hasImage(input: InputMessage[]): boolean {
  return input.some((m) => typeof m.content !== "string" && m.content.some((c) => c.type === "input_image"));
}

export function extractChatText(p: ChatPayload): string {
  const content = p.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((c) => (typeof c.text === "string" ? c.text : "")).join("");
  return "";
}

/** Models sometimes wrap JSON in a Markdown code fence; strip it before parsing. */
export function stripJsonFence(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1]! : t;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callOpenRouter<T = string>(call: GrokCall<T>, fetchImpl: typeof fetch = fetch): Promise<GrokResult<T>> {
  const retries = Math.max(0, Math.min(call.retries ?? 2, 4));
  for (let attempt = 0; ; attempt++) {
    try {
      return await callOnce(call, fetchImpl);
    } catch (e) {
      if (attempt >= retries || !isRetryable(e)) throw e;
      await sleep(backoffMs(attempt, (e as GrokUnavailableError).retryAfter));
    }
  }
}

async function callOnce<T>(call: GrokCall<T>, fetchImpl: typeof fetch): Promise<GrokResult<T>> {
  const apiKey = env.openrouterApiKey;
  if (!apiKey) throw new GrokUnavailableError("OPENROUTER_API_KEY is not configured", "NOT_CONFIGURED");
  // The callers pass Grok model names; OpenRouter uses its own model settings instead.
  const model = hasImage(call.input) ? env.openrouterVisionModel : env.openrouterModel;
  const body: Record<string, unknown> = {
    model,
    messages: toChatMessages(call.input),
    max_tokens: call.maxOutputTokens ?? 1600,
  };
  if (call.temperature !== undefined) body.temperature = call.temperature;
  if (call.schema) {
    body.response_format = { type: "json_schema", json_schema: { name: call.schema.name, strict: true, schema: call.schema.schema } };
    // Only route to providers that honour structured output.
    body.provider = { require_parameters: true };
  }

  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), call.timeoutMs ?? 60_000);
  let res: Response;
  try {
    res = await fetchImpl(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://agriflow-ai-wheat.vercel.app",
        "X-Title": "AgriFlow AI",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new GrokUnavailableError(aborted ? "AI request timed out" : `Network error: ${String(e)}`, aborted ? "TIMEOUT" : "NETWORK");
  } finally {
    clearTimeout(timer);
  }
  const latencyMs = Date.now() - started;
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 300);
    } catch {
      /* ignore */
    }
    throw new GrokUnavailableError(`OpenRouter HTTP ${res.status}: ${redactKey(detail)}`, "HTTP", res.status, res.headers.get("retry-after"));
  }
  let payload: ChatPayload;
  try {
    payload = (await res.json()) as ChatPayload;
  } catch {
    throw new GrokUnavailableError("OpenRouter returned a non-JSON response", "INVALID_RESPONSE");
  }
  if (payload.error) throw new GrokUnavailableError(`OpenRouter error: ${redactKey(typeof payload.error === "string" ? payload.error : (payload.error.message ?? ""))}`, "INVALID_RESPONSE");
  const text = extractChatText(payload);
  if (!text) throw new GrokUnavailableError("Empty response from the AI model", "INVALID_RESPONSE");
  let data: T;
  try {
    if (call.schema) {
      const raw = JSON.parse(stripJsonFence(text));
      data = call.parse ? call.parse(raw) : (raw as T);
    } else {
      data = (call.parse ? call.parse(text) : text) as T;
    }
  } catch (e) {
    throw new GrokUnavailableError(`Invalid structured output: ${String(e).slice(0, 200)}`, "INVALID_RESPONSE");
  }
  return {
    text,
    data,
    model: payload.model ?? model,
    inputTokens: payload.usage?.prompt_tokens ?? null,
    outputTokens: payload.usage?.completion_tokens ?? null,
    latencyMs,
  };
}

function redactKey(text: string): string {
  return redact(text).replace(/sk-or-[A-Za-z0-9_-]{8,}/g, "sk-or-***");
}
