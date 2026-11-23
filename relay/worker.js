/**
 * AgriFlow AI relay (Cloudflare Worker).
 *
 * Some Zambian mobile networks (notably MTN) cannot reach *.vercel.app. Phones connect to this
 * Worker on Cloudflare instead, and it forwards every request unchanged to the AgriFlow server.
 *
 * Worker variable (Settings -> Variables and Secrets, type "Secret"):
 *   RELAY_SECRET  - must equal RELAY_SECRET in the Vercel project, so the server can trust the
 *                   phone's real IP for its sign-up/login limits.
 */
const ORIGIN = "https://agriflow-ai-wheat.vercel.app";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const target = ORIGIN + url.pathname + url.search;

    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("x-agriflow-client-ip");
    headers.delete("x-agriflow-relay-secret");
    const clientIp = request.headers.get("cf-connecting-ip");
    if (env.RELAY_SECRET && clientIp) {
      headers.set("x-agriflow-client-ip", clientIp);
      headers.set("x-agriflow-relay-secret", env.RELAY_SECRET);
    }

    const init = { method: request.method, headers, redirect: "manual" };
    if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;

    try {
      return await fetch(target, init);
    } catch {
      return new Response(JSON.stringify({ error: { code: "UPSTREAM_UNAVAILABLE", message: "The AgriFlow server could not be reached. Please try again." } }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }
  },
};
