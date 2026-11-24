import "server-only";
import { z } from "zod";
import { Prisma, type Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AppError, httpStatus } from "@/lib/errors";
import { flattenZod } from "@/lib/action";
import { isFamilyActive, verifyAccessToken } from "./tokens";

/** Mobile API (v1) HTTP helpers. Errors are always `{ error: { code, message, fieldErrors? } }`. */

export type MobileUser = {
  id: string;
  role: Role;
  email: string;
  verifiedAt: Date | null;
  emailVerifiedAt: Date | null;
  onboardingCompletedAt: Date | null;
};

export type Ctx = {
  req: Request;
  params: Record<string, string>;
  query: URLSearchParams;
  /** Present on authenticated routes */
  user: MobileUser;
  actor: { id: string; role: Role };
  json: <T = Record<string, unknown>>() => Promise<T>;
  form: () => Promise<FormData>;
};

export type Handler = (ctx: Ctx) => Promise<unknown>;

export type RouteDef = {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  /** false = public route. Otherwise any signed-in user, or only the listed roles. */
  auth: false | true | Role[];
  handler: Handler;
};

export const ADMIN_ROLES: Role[] = ["ADMIN", "SUPER_ADMIN"];

export function errorResponse(e: unknown) {
  if (e instanceof AppError) {
    return NextResponse.json({ error: { code: e.code, message: e.message, fieldErrors: e.fieldErrors } }, { status: httpStatus[e.code] });
  }
  if (e instanceof z.ZodError) {
    return NextResponse.json({ error: { code: "VALIDATION", message: "Please check the highlighted fields.", fieldErrors: flattenZod(e) } }, { status: 400 });
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    return NextResponse.json({ error: { code: "CONFLICT", message: "A record with these details already exists." } }, { status: 409 });
  }
  if (e instanceof SyntaxError) {
    return NextResponse.json({ error: { code: "VALIDATION", message: "The request body is not valid JSON." } }, { status: 400 });
  }
  console.error("[api/v1] unexpected error", e);
  return NextResponse.json({ error: { code: "SERVER_ERROR", message: "Something went wrong. Please try again." } }, { status: 500 });
}

export async function authenticateRequest(req: Request): Promise<MobileUser> {
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) throw new AppError("Please sign in to continue.", "UNAUTHENTICATED");
  const claims = verifyAccessToken(m[1]!.trim());
  const [user, active] = await Promise.all([
    prisma.user.findUnique({ where: { id: claims.sub }, select: { id: true, role: true, email: true, status: true, verifiedAt: true, emailVerifiedAt: true, onboardingCompletedAt: true } }),
    isFamilyActive(claims.fam),
  ]);
  // Signed-out (revoked) sessions stop working immediately, not after the token expires.
  if (!user || !active) throw new AppError("Please sign in again.", "UNAUTHENTICATED");
  if (user.status !== "ACTIVE") throw new AppError("This account is suspended. Contact support.", "FORBIDDEN");
  return { id: user.id, role: user.role, email: user.email, verifiedAt: user.verifiedAt, emailVerifiedAt: user.emailVerifiedAt, onboardingCompletedAt: user.onboardingCompletedAt };
}

/** JSON-safe output: Prisma Decimal → string, BigInt → string, Bytes dropped. */
export function toJson(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => {
      if (typeof v === "bigint") return v.toString();
      if (v && typeof v === "object" && v.type === "Buffer") return undefined;
      return v;
    }),
  );
}

export const num = (v: string | null) => (v === null || v === "" ? undefined : Number(v));

/** Explicit status / headers / raw body (e.g. 201 Created, CSV downloads). */
export class Res {
  constructor(
    public status: number,
    public body: unknown,
    public headers: Record<string, string> = {},
    public raw = false,
  ) {}
}
