import "server-only";
import { env } from "@/lib/env";
import { callGrok, type GrokCall, type GrokResult } from "./xai";
import { callOpenRouter, OPENROUTER_ENDPOINT } from "./openrouter";
import { XAI_ENDPOINT } from "./xai";

/**
 * Chooses the AI provider. OpenRouter is used whenever OPENROUTER_API_KEY is set;
 * otherwise the Grok (xAI) client is used exactly as before. Remove OPENROUTER_API_KEY
 * to switch back to Grok.
 */
export type AIProvider = "openrouter" | "xai";

export function activeProvider(): AIProvider {
  return env.openrouterApiKey ? "openrouter" : "xai";
}

export function providerInfo() {
  return activeProvider() === "openrouter"
    ? { provider: "openrouter" as const, endpoint: OPENROUTER_ENDPOINT, textModel: env.openrouterModel, visionModel: env.openrouterVisionModel, keyConfigured: true }
    : { provider: "xai" as const, endpoint: XAI_ENDPOINT, textModel: env.xaiModel, visionModel: env.xaiVisionModel, keyConfigured: Boolean(env.xaiApiKey) };
}

export function callAI<T = string>(call: GrokCall<T>): Promise<GrokResult<T>> {
  return activeProvider() === "openrouter" ? callOpenRouter(call) : callGrok(call);
}
