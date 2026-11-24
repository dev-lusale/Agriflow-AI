import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError, invalid } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isValidDistrict } from "@/lib/zambia";
import { changePasswordSchema, mobileLoginSchema, mobileRegisterSchema, mobileResetSchema } from "@/lib/validation/schemas";
import { authenticate, registerUser } from "@/server/auth/service";
import { Res, type RouteDef } from "../http";
import { issueTokenPair, revokeAllForUser, revokeByToken, rotateRefreshToken } from "../tokens";
import { sendOtp, verifyOtp } from "../otp";
import { loadMe } from "./me";

/**
 * Client IP for rate limits. Requests that come through the Cloudflare relay (used where mobile
 * networks cannot reach Vercel directly) carry the phone's real IP plus a shared secret; without
 * the secret the header is ignored, so it cannot be spoofed.
 */
const ip = (req: Request) => {
  const secret = process.env.RELAY_SECRET;
  const relayed = req.headers.get("x-agriflow-client-ip");
  if (secret && relayed && req.headers.get("x-agriflow-relay-secret") === secret) return relayed.trim();
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
};

export const socialProviders = () => ({
  // OAuth sign-in is only offered once the owner configures each provider (see docs/MOBILE_APP.md).
  google: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID),
  apple: Boolean(process.env.APPLE_OAUTH_CLIENT_ID),
  facebook: Boolean(process.env.FACEBOOK_APP_ID),
});

export const authRoutes: RouteDef[] = [
  {
    method: "GET",
    path: "/auth/config",
    auth: false,
    handler: async () => ({
      socialProviders: socialProviders(),
      emailDelivery: env.resendApiKey ? "configured" : "not_configured",
      passwordRules: { minLength: 8, requiresLetter: true, requiresNumber: true },
      roles: ["FARMER", "SUPPLIER", "BUYER", "EXPERT", "DISTRIBUTOR", "TRANSPORTER"],
    }),
  },
  {
    method: "POST",
    path: "/auth/register",
    auth: false,
    handler: async ({ req, json }) => {
      await rateLimit(`register:${ip(req)}`, 10, 3600);
      const d = mobileRegisterSchema.parse(await json());
      if (!isValidDistrict(d.province, d.district)) throw invalid("Choose a district in the selected province.", { district: ["Invalid district for province"] });
      const user = await registerUser({ fullName: d.fullName, email: d.email, phone: d.phone, password: d.password, role: d.role, consent: true }, { sendLinkEmail: false });
      await prisma.userProfile.update({ where: { userId: user.id }, data: { province: d.province, district: d.district } });
      const verification = await sendOtp({ id: user.id, email: user.email }, "EMAIL_OTP").catch(() => ({ delivery: "failed" as const, expiresInSeconds: 600, resendAfterSeconds: 60 }));
      const tokens = await issueTokenPair(user.id, user.role, d.deviceName);
      return new Res(201, { ...tokens, user: await loadMe(user.id), verification });
    },
  },
  {
    method: "POST",
    path: "/auth/login",
    auth: false,
    handler: async ({ req, json }) => {
      const d = mobileLoginSchema.parse(await json());
      await rateLimit(`login:${d.email}`, 10, 900);
      await rateLimit(`login-ip:${ip(req)}`, 30, 900);
      const user = await authenticate(d.email, d.password);
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      const tokens = await issueTokenPair(user.id, user.role, d.deviceName);
      return { ...tokens, user: await loadMe(user.id) };
    },
  },
  {
    method: "POST",
    path: "/auth/refresh",
    auth: false,
    handler: async ({ req, json }) => {
      const { refreshToken, deviceName } = await json<{ refreshToken?: string; deviceName?: string }>();
      if (!refreshToken || typeof refreshToken !== "string") throw new AppError("Please sign in again.", "UNAUTHENTICATED");
      await rateLimit(`refresh-ip:${ip(req)}`, 120, 900);
      return rotateRefreshToken(refreshToken, deviceName);
    },
  },
  {
    method: "POST",
    path: "/auth/logout",
    auth: false,
    handler: async ({ json }) => {
      const { refreshToken } = await json<{ refreshToken?: string }>().catch(() => ({ refreshToken: undefined }));
      if (refreshToken) await revokeByToken(refreshToken);
      return { ok: true };
    },
  },
  {
    method: "POST",
    path: "/auth/logout-all",
    auth: true,
    handler: async ({ user }) => {
      await revokeAllForUser(user.id);
      await prisma.session.deleteMany({ where: { userId: user.id } });
      return { ok: true };
    },
  },
  {
    method: "POST",
    path: "/auth/verify-email/send",
    auth: true,
    handler: async ({ user }) => {
      if (user.emailVerifiedAt) return { alreadyVerified: true };
      return sendOtp({ id: user.id, email: user.email }, "EMAIL_OTP");
    },
  },
  {
    method: "POST",
    path: "/auth/verify-email",
    auth: true,
    handler: async ({ user, json }) => {
      const { code } = await json<{ code?: string }>();
      if (user.emailVerifiedAt) return { verified: true };
      await verifyOtp(user.id, "EMAIL_OTP", String(code ?? ""));
      await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
      await audit({ actorId: user.id, action: "user.email_verified", entityType: "User", entityId: user.id });
      return { verified: true };
    },
  },
  {
    method: "POST",
    path: "/auth/forgot-password",
    auth: false,
    handler: async ({ req, json }) => {
      const { email } = await json<{ email?: string }>();
      const e = String(email ?? "").toLowerCase().trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw invalid("Enter a valid email address", { email: ["Enter a valid email address"] });
      await rateLimit(`forgot-ip:${ip(req)}`, 10, 900);
      const user = await prisma.user.findUnique({ where: { email: e }, select: { id: true, email: true, status: true } });
      // Same answer whether or not the account exists (no account enumeration).
      if (user && user.status === "ACTIVE") await sendOtp(user, "RESET_OTP").catch(() => undefined);
      return {
        message: "If an account exists for this email, a 6-digit reset code has been sent.",
        emailDelivery: env.resendApiKey ? "configured" : "not_configured",
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
      };
    },
  },
  {
    method: "POST",
    path: "/auth/reset-password",
    auth: false,
    handler: async ({ json }) => {
      const d = mobileResetSchema.parse(await json());
      const user = await prisma.user.findUnique({ where: { email: d.email }, select: { id: true } });
      if (!user) throw invalid("That code is wrong or has expired. Request a new one.", { code: ["Wrong or expired code"] });
      await verifyOtp(user.id, "RESET_OTP", d.code);
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(d.password) } }),
        prisma.session.deleteMany({ where: { userId: user.id } }),
      ]);
      await revokeAllForUser(user.id);
      await audit({ actorId: user.id, action: "user.password_reset", entityType: "User", entityId: user.id, metadata: { via: "mobile" } });
      return { ok: true, message: "Password changed. Sign in with your new password." };
    },
  },
  {
    method: "POST",
    path: "/me/password",
    auth: true,
    handler: async ({ user, json }) => {
      const d = changePasswordSchema.parse(await json());
      await rateLimit(`chpw:${user.id}`, 5, 900);
      const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
      if (!(await verifyPassword(d.currentPassword, row.passwordHash))) throw invalid("Your current password is wrong.", { currentPassword: ["Wrong password"] });
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(d.newPassword) } });
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await audit({ actorId: user.id, action: "user.password_changed", entityType: "User", entityId: user.id });
      return { ok: true };
    },
  },
];
