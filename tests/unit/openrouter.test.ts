import { afterEach, describe, expect, it, vi } from "vitest";
import { callOpenRouter, OPENROUTER_ENDPOINT, stripJsonFence, toChatMessages } from "@/server/ai/openrouter";
import { activeProvider, callAI } from "@/server/ai/provider";
import { GrokUnavailableError, XAI_ENDPOINT } from "@/server/ai/xai";

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.OPENROUTER_API_KEY = "";
  process.env.XAI_API_KEY = "";
  delete process.env.OPENROUTER_MODEL;
  delete process.env.OPENROUTER_VISION_MODEL;
});

const ok = (content: string, model = "google/gemini-2.5-flash") =>
  new Response(JSON.stringify({ model, choices: [{ message: { content } }], usage: { prompt_tokens: 12, completion_tokens: 3 } }));

describe("OpenRouter client", () => {
  it("is used instead of xAI when OPENROUTER_API_KEY is set, and xAI is used otherwise", async () => {
    process.env.XAI_API_KEY = "xai-test";
    expect(activeProvider()).toBe("xai");
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    expect(activeProvider()).toBe("openrouter");
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ok("Hello"));
    vi.stubGlobal("fetch", fetchMock);
    const r = await callAI({ input: [{ role: "user", content: "Hi" }] });
    expect(r.text).toBe("Hello");
    expect(String(fetchMock.mock.calls[0]![0])).toBe(OPENROUTER_ENDPOINT);
    expect(String(fetchMock.mock.calls[0]![0])).not.toBe(XAI_ENDPOINT);
  });

  it("sends chat messages, the configured models, auth and structured output", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    process.env.OPENROUTER_MODEL = "text/model";
    process.env.OPENROUTER_VISION_MODEL = "vision/model";
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ok('```json\n{"answer":"Plant early"}\n```'));
    vi.stubGlobal("fetch", fetchMock);
    const r = await callOpenRouter<{ answer: string }>({
      model: "grok-4.7",
      input: [
        { role: "system", content: "Be brief" },
        { role: "user", content: [{ type: "input_text", text: "What is this?" }, { type: "input_image", image_url: "data:image/png;base64,AAAA", detail: "low" }] },
      ],
      schema: { name: "a", schema: { type: "object" } },
    });
    expect(r.data.answer).toBe("Plant early");
    expect(r.inputTokens).toBe(12);
    const init = fetchMock.mock.calls[0]![1]!;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-or-test");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("vision/model"); // image present → vision model, Grok model name ignored
    expect(body.messages[1].content[1]).toEqual({ type: "image_url", image_url: { url: "data:image/png;base64,AAAA", detail: "low" } });
    expect(body.response_format.type).toBe("json_schema");

    fetchMock.mockClear();
    await callOpenRouter({ input: [{ role: "user", content: "Hi" }] });
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)).model).toBe("text/model");
  });

  it("reports a missing key, rejected keys and empty credit without leaking the key", async () => {
    await expect(callOpenRouter({ input: [{ role: "user", content: "Hi" }] })).rejects.toMatchObject({ reason: "NOT_CONFIGURED" });
    process.env.OPENROUTER_API_KEY = "sk-or-v1-secretsecretsecret";
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":{"message":"bad key sk-or-v1-secretsecretsecret"}}', { status: 401 })));
    const e = (await callOpenRouter({ input: [{ role: "user", content: "Hi" }], retries: 0 }).catch((x) => x)) as GrokUnavailableError;
    expect(e.status).toBe(401);
    expect(e.message).not.toContain("secretsecret");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 402 })));
    await expect(callOpenRouter({ input: [{ role: "user", content: "Hi" }], retries: 0 })).rejects.toMatchObject({ status: 402 });
  });

  it("retries a transient failure", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("busy", { status: 503, headers: { "retry-after": "0" } })).mockResolvedValueOnce(ok("Fine"));
    vi.stubGlobal("fetch", fetchMock);
    const r = await callOpenRouter({ input: [{ role: "user", content: "Hi" }] });
    expect(r.text).toBe("Fine");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("helpers", () => {
    expect(stripJsonFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripJsonFence('{"a":1}')).toBe('{"a":1}');
    expect(toChatMessages([{ role: "user", content: "x" }])).toEqual([{ role: "user", content: "x" }]);
  });
});
