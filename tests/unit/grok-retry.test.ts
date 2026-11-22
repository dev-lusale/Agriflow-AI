import { afterEach, describe, expect, it, vi } from "vitest";
import { backoffMs, callGrok, GrokUnavailableError, isRetryable, redact } from "@/server/ai/xai";

const ok = () => new Response(JSON.stringify({ model: "grok-4.7", output_text: "OK", usage: { input_tokens: 5, output_tokens: 1 } }));

describe("Grok retries", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries a 429 and a 503, then succeeds", async () => {
    process.env.XAI_API_KEY = "k";
    const statuses = [429, 503];
    const fetchMock = vi.fn(async () => {
      const s = statuses.shift();
      return s ? new Response("busy", { status: s, headers: { "retry-after": "0" } }) : ok();
    });
    const r = await callGrok({ input: [{ role: "user", content: "hi" }] }, fetchMock as unknown as typeof fetch);
    expect(r.text).toBe("OK");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries network errors", async () => {
    process.env.XAI_API_KEY = "k";
    let n = 0;
    const fetchMock = vi.fn(async () => {
      if (n++ === 0) throw new TypeError("fetch failed");
      return ok();
    });
    await expect(callGrok({ input: [] }, fetchMock as unknown as typeof fetch)).resolves.toMatchObject({ text: "OK" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry auth errors or bad requests", async () => {
    process.env.XAI_API_KEY = "k";
    for (const status of [400, 401, 403, 404]) {
      const fetchMock = vi.fn(async () => new Response("no", { status }));
      await expect(callGrok({ input: [] }, fetchMock as unknown as typeof fetch)).rejects.toMatchObject({ reason: "HTTP", status });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it("gives up after the configured number of retries", async () => {
    process.env.XAI_API_KEY = "k";
    const fetchMock = vi.fn(async () => new Response("down", { status: 502, headers: { "retry-after": "0" } }));
    await expect(callGrok({ input: [], retries: 1 }, fetchMock as unknown as typeof fetch)).rejects.toBeInstanceOf(GrokUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("classifies retryable failures", () => {
    expect(isRetryable(new GrokUnavailableError("x", "NETWORK"))).toBe(true);
    expect(isRetryable(new GrokUnavailableError("x", "HTTP", 429))).toBe(true);
    expect(isRetryable(new GrokUnavailableError("x", "HTTP", 401))).toBe(false);
    expect(isRetryable(new GrokUnavailableError("x", "TIMEOUT"))).toBe(false);
    expect(isRetryable(new Error("x"))).toBe(false);
  });

  it("caps backoff and honours Retry-After", () => {
    expect(backoffMs(0, "2")).toBe(2000);
    expect(backoffMs(0, "600")).toBe(8000);
    for (let a = 0; a < 6; a++) expect(backoffMs(a)).toBeLessThanOrEqual(4250);
  });
});

describe("secret redaction", () => {
  it("removes xAI keys and bearer tokens from error text", () => {
    const out = redact('{"error":"Incorrect API key provided: xai-AbCdEf1234567890xyz"} Authorization: Bearer sk.abc-123');
    expect(out).not.toMatch(/AbCdEf1234567890/);
    expect(out).not.toMatch(/sk\.abc-123/);
    expect(out).toContain("xai-***");
  });

  it("never puts the key into thrown errors", async () => {
    process.env.XAI_API_KEY = "xai-SECRETSECRETSECRET123";
    const echo = (async () => new Response("bad key xai-SECRETSECRETSECRET123", { status: 401 })) as unknown as typeof fetch;
    const err = await callGrok({ input: [] }, echo).catch((e: Error) => e);
    expect(String((err as Error).message)).not.toContain("SECRETSECRETSECRET");
  });
});
