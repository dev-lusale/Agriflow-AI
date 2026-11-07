import "server-only";
import { env } from "@/lib/env";

/**
 * Minimal server-side client for the xAI Responses API (POST https://api.x.ai/v1/responses).
 * Docs: https://docs.x.ai/docs/guides/structured-outputs and /image-understanding
 * The API key is read from the server environment only and never sent to the browser.
 */
export const XAI_ENDPOINT = "https://api.x.ai/v1/responses";

export type InputContent = { type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail?: "high" | "low" | "auto" };

export type InputMessage = { role: "system" | "user" | "assistant"; content: string | InputContent[] };

export type GrokCall<T> = {
  model?: string;
  input: InputMessage[];
  schema?: { name: string; schema: Record<string, unknown> };
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** Parse/validate the structured output. Throwing here counts as an invalid response. */
  parse?: (raw: unknown) => T;
};

export type GrokResult<T> = {
  text: string;
  data: T;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
};

export class GrokUnavailableError extends Error {
  constructor(
    message: string,
    public reason: "NOT_CONFIGURED" | "HTTP" | "TIMEOUT" | "INVALID_RESPONSE" | "NETWORK",
    public status?: number,
  ) {
    super(message);
    this.name = "GrokUnavailableError";
  }
}

type ResponsesPayload = {
  model?: string;
  output_text?: string;
  output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string } | string;
};

export function extractOutputText(p: ResponsesPayload): string {
  if (typeof p.output_text === "string" && p.output_text.length) return p.output_text;
  const parts: string[] = [];
  for (const item of p.output ?? []) {
    if (item.type !== "message") continue;
    for (const c of item.content ?? []) if (c.type === "output_text" && typeof c.text === "string") parts.push(c.text);
  }
  return parts.join("");
}

export async function callGrok<T = string>(call: GrokCall<T>, fetchImpl: typeof fetch = fetch): Promise<GrokResult<T>> {
  const apiKey = env.xaiApiKey;
  if (!apiKey) throw new GrokUnavailableError("XAI_API_KEY is not configured", "NOT_CONFIGURED");
  const model = call.model ?? env.xaiModel;
  const body: Record<string, unknown> = {
    model,
    input: call.input,
    // Do not retain request/response history on xAI servers (also required for image requests)
    store: false,
    max_output_tokens: call.maxOutputTokens ?? 1600,
  };
  if (call.temperature !== undefined) body.temperature = call.temperature;
  if (call.schema) body.text = { format: { type: "json_schema", name: call.schema.name, schema: call.schema.schema, strict: true } };

  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), call.timeoutMs ?? 60_000);
  let res: Response;
  try {
    res = await fetchImpl(XAI_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new GrokUnavailableError(aborted ? "Grok request timed out" : `Network error: ${String(e)}`, aborted ? "TIMEOUT" : "NETWORK");
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
    throw new GrokUnavailableError(`xAI HTTP ${res.status}: ${detail}`, "HTTP", res.status);
  }
  const payload = (await res.json()) as ResponsesPayload;
  const text = extractOutputText(payload);
  if (!text) throw new GrokUnavailableError("Empty response from Grok", "INVALID_RESPONSE");
  let data: T;
  try {
    if (call.schema) {
      const raw = JSON.parse(text);
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
    inputTokens: payload.usage?.input_tokens ?? payload.usage?.prompt_tokens ?? null,
    outputTokens: payload.usage?.output_tokens ?? payload.usage?.completion_tokens ?? null,
    latencyMs,
  };
}
