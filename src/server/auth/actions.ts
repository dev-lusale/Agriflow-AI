"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Role } from "@prisma/client";
import { parseInput, runAction } from "@/lib/action";
import { AppError, type ActionResult } from "@/lib/errors";
import { createSession, destroySession, getCurrentUser, requireUser } from "@/lib/auth/session";
import { ROLE_HOME, isAdminRole } from "@/lib/auth/roles";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { forgotSchema, loginSchema, registerSchema, resetSchema } from "@/lib/validation/schemas";
import * as auth from "./service";

async function clientKey() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

function safeNext(next: unknown, role: Role) {
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/auth")) return next;
  return ROLE_HOME[role];
}

export async function registerAction(fd: FormData): Promise<ActionResult> {
  const res = await runAction(async () => {
    await rateLimit(`register:${await clientKey()}`, 10, 3600);
    const input = parseInput(registerSchema, fd);
    const user = await auth.registerUser(input);
    await createSession(user.id);
    return user.role;
  });
  if (res.ok) redirect("/onboarding");
  return res;
}

export async function loginAction(fd: FormData): Promise<ActionResult> {
  const next = fd.get("next");
  let dest = "/";
  const res = await runAction(async () => {
    await rateLimit(`login:${await clientKey()}`, 20, 900);
    const { email, password } = parseInput(loginSchema, fd);
    await rateLimit(`login-email:${email}`, 10, 900);
    const user = await auth.authenticate(email, password);
    await createSession(user.id);
    dest = !user.onboardingCompletedAt && !isAdminRole(user.role) ? "/onboarding" : safeNext(next, user.role);
  });
  if (res.ok) redirect(dest);
  return res;
}

/** One-click sign-in for seeded demo accounts. Only available when DEMO_MODE=true. */
export async function demoLoginAction(fd: FormData): Promise<ActionResult> {
  if (!env.demoMode) return { ok: false, error: "Demo sign-in is disabled." };
  const role = String(fd.get("role") ?? "");
  const emails: Record<string, string> = {
    FARMER: "demo.farmer@agriflow.demo",
    BUYER: "demo.buyer@agriflow.demo",
    SUPPLIER: "demo.supplier@agriflow.demo",
    TRANSPORTER: "demo.transporter@agriflow.demo",
    ADMIN: "demo.admin@agriflow.demo",
  };
  const email = emails[role];
  if (!email) return { ok: false, error: "Unknown demo role." };
  let dest = "/";
  const res = await runAction(async () => {
    await rateLimit(`demo-login:${await clientKey()}`, 60, 900);
    const { prisma } = await import("@/lib/db");
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isDemo) throw new AppError("Demo accounts are not seeded. Run `npm run db:seed`.", "NOT_FOUND");
    await createSession(user.id);
    dest = ROLE_HOME[user.role];
  });
  if (res.ok) redirect(dest);
  return res;
}

export async function logoutAction() {
  await destroySession();
  redirect("/auth/login?signedOut=1");
}

export async function forgotPasswordAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await rateLimit(`forgot:${await clientKey()}`, 5, 900);
    const { email } = parseInput(forgotSchema, fd);
    await auth.requestPasswordReset(email);
  }, "If an account exists for that email, a reset link has been issued.");
}

export async function resetPasswordAction(fd: FormData): Promise<ActionResult> {
  const res = await runAction(async () => {
    const d = parseInput(resetSchema, fd);
    await auth.resetPassword(d.token, d.password);
  });
  if (res.ok) redirect("/auth/login?reset=1");
  return res;
}

export async function resendVerificationAction(): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    await rateLimit(`verify:${user.id}`, 5, 3600);
    if (user.emailVerifiedAt) return;
    await auth.sendVerificationEmail(user.id, user.email);
  }, env.resendApiKey ? "Verification email sent." : "Verification link issued. Email delivery is not configured on this server; see the README.");
}

export async function onboardingAction(fd: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const raw: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string") continue;
    if (k.endsWith("[]")) ((raw[k.slice(0, -2)] as string[]) ??= []).push(v);
    else if (v.trim() !== "") raw[k] = v;
  }
  for (const arr of ["mainCrops", "preferredCrops", "categories", "serviceProvinces"]) raw[arr] ??= [];
  const res = await runAction(() => auth.completeOnboarding(user.id, user.role, raw));
  if (res.ok) redirect(ROLE_HOME[user.role]);
  return res;
}

export async function startPhoneVerificationAction(): Promise<ActionResult<{ devCode?: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    await rateLimit(`otp:${user.id}`, 5, 3600);
    const r = await auth.startPhoneVerification(user.id);
    return { devCode: r.devCode };
  }, "Verification code issued. SMS delivery is not configured, so no text message was sent.");
}

export async function confirmPhoneAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    await auth.confirmPhone(user.id, String(fd.get("code") ?? ""));
  }, "Phone number verified.");
}
