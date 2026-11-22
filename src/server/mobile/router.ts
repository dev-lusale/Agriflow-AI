import "server-only";
import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { readUpload } from "@/server/storage/service";
import { prisma } from "@/lib/db";
import { DISTRICTS, PROVINCES } from "@/lib/zambia";
import { authenticateRequest, errorResponse, Res, toJson, type Ctx, type RouteDef } from "./http";
import { authRoutes } from "./routes/auth";
import { meRoutes } from "./routes/me";
import { aiRoutes, farmRoutes } from "./routes/farm-ai";
import { marketRoutes, opsRoutes } from "./routes/commerce";
import { adminRoutes } from "./routes/admin";

/** AgriFlow mobile REST API v1. See docs/MOBILE_API.md. */
const uploadRoute: RouteDef = {
  method: "GET",
  path: "/uploads/:id",
  auth: true,
  handler: async ({ actor, params }) => {
    const { upload, bytes } = await readUpload(actor, params.id!);
    return new Res(200, new Uint8Array(bytes), {
      "Content-Type": upload.mimeType,
      "Content-Length": String(bytes.length),
      "Cache-Control": upload.isPublic ? "public, max-age=86400" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    }, true);
  },
};

export const ROUTES: RouteDef[] = [
  ...authRoutes,
  ...meRoutes,
  ...farmRoutes,
  ...aiRoutes,
  ...marketRoutes,
  ...opsRoutes,
  ...adminRoutes,
  uploadRoute,
  { method: "GET", path: "/health", auth: false, handler: async () => ({ ok: true, api: "v1" }) },
  {
    method: "GET",
    path: "/meta/regions",
    auth: false,
    handler: async () => ({
      country: { code: "ZM", name: "Zambia" },
      provinces: PROVINCES.map((p) => ({ value: p.value, label: p.label, districts: DISTRICTS[p.value].map((d) => d.name) })),
    }),
  },
  {
    method: "GET",
    path: "/meta/product-categories",
    auth: true,
    handler: async () => prisma.productCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, requiresSafetyInfo: true } }),
  },
];

type Compiled = RouteDef & { re: RegExp; keys: string[] };
const compiled: Compiled[] = ROUTES.map((r) => {
  const keys: string[] = [];
  const re = new RegExp(
    "^" +
      r.path
        .split("/")
        .map((seg) => {
          if (seg.startsWith(":")) {
            keys.push(seg.slice(1));
            return "([^/]+)";
          }
          return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("/") +
      "/?$",
  );
  return { ...r, re, keys };
});

export function matchRoute(method: string, path: string) {
  let pathMatched = false;
  for (const r of compiled) {
    const m = r.re.exec(path);
    if (!m) continue;
    pathMatched = true;
    if (r.method !== method) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]!)));
    return { route: r, params };
  }
  return pathMatched ? "METHOD_NOT_ALLOWED" : null;
}

const MAX_JSON_BYTES = 256 * 1024;

export async function dispatch(req: Request, segments: string[]) {
  const path = "/" + segments.map(encodeURIComponent).join("/");
  try {
    const hit = matchRoute(req.method, "/" + segments.join("/"));
    if (hit === null) return NextResponse.json({ error: { code: "NOT_FOUND", message: `No such endpoint: ${req.method} ${path}` } }, { status: 404 });
    if (hit === "METHOD_NOT_ALLOWED") return NextResponse.json({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } }, { status: 405 });
    const { route, params } = hit;
    let user = null as Ctx["user"] | null;
    if (route.auth !== false) {
      user = await authenticateRequest(req);
      if (Array.isArray(route.auth) && !route.auth.includes(user.role)) throw new AppError("Your account type cannot use this feature.", "FORBIDDEN");
    }
    const ctx: Ctx = {
      req,
      params,
      query: new URL(req.url).searchParams,
      user: user as Ctx["user"],
      actor: user ? { id: user.id, role: user.role } : (undefined as never),
      json: async <T,>() => {
        const text = await req.text();
        if (text.length > MAX_JSON_BYTES) throw new AppError("Request body is too large.", "VALIDATION");
        return (text ? JSON.parse(text) : {}) as T;
      },
      form: () => req.formData(),
    };
    const out = await route.handler(ctx);
    if (out instanceof Res) {
      if (out.raw) return new NextResponse(out.body as BodyInit, { status: out.status, headers: { "Cache-Control": "no-store", ...out.headers } });
      return NextResponse.json(toJson(out.body), { status: out.status, headers: { "Cache-Control": "no-store", ...out.headers } });
    }
    return NextResponse.json(toJson(out ?? { ok: true }), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
