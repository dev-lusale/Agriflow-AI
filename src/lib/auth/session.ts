import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { hashToken, randomToken } from "./crypto";
import { ROLE_HOME, isAdminRole } from "./roles";

export const SESSION_COOKIE = "af_session";
const SESSION_DAYS = 30;

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const ua = (await headers()).get("user-agent")?.slice(0, 250) ?? null;
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt, userAgent: ua } });
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof loadSessionUser>>>;

async function loadSessionUser(token: string) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          emailVerifiedAt: true,
          phoneVerifiedAt: true,
          verifiedAt: true,
          onboardingCompletedAt: true,
          dataConsentAt: true,
          isDemo: true,
          profile: { select: { fullName: true, province: true, district: true } },
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;
  return session.user;
}

/** Current user for this request (memoised per request). */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return loadSessionUser(token);
});

/** For server components / layouts: redirect when not allowed. */
export async function requirePageRole(...roles: Role[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  if (roles.length && !roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  if (!user.onboardingCompletedAt && !isAdminRole(user.role)) redirect("/onboarding");
  return user;
}

/** For server actions / route handlers: throw typed errors. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AppError("Please sign in to continue.", "UNAUTHENTICATED");
  return user;
}

export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new AppError("You do not have permission to do this.", "FORBIDDEN");
  return user;
}

export async function requireAdmin() {
  return requireRole("ADMIN", "SUPER_ADMIN");
}
