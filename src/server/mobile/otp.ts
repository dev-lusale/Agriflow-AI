import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { hashToken } from "@/lib/auth/crypto";
import { invalid } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/server/notifications/email";

/**
 * 6-digit codes e-mailed to mobile users (email verification and password reset).
 * The stored hash includes the user id and purpose, so equal codes for different users never clash.
 * Codes expire after 10 minutes; at most 5 wrong attempts per 15 minutes per user and purpose.
 */
export type OtpPurpose = "EMAIL_OTP" | "RESET_OTP";
const TTL_MS = 10 * 60_000;
export const OTP_RESEND_SECONDS = 60;

const hashFor = (userId: string, purpose: OtpPurpose, code: string) => hashToken(`${userId}:${purpose}:${code.trim()}`);

export type OtpDelivery = { delivery: "sent" | "not_configured" | "failed"; expiresInSeconds: number; resendAfterSeconds: number; devCode?: string };

export async function sendOtp(user: { id: string; email: string }, purpose: OtpPurpose): Promise<OtpDelivery> {
  // Limit how often codes can be sent (protects the inbox and the e-mail quota)
  await rateLimit(`otp-send:${purpose}:${user.id}`, 5, 3600);
  await prisma.verificationToken.updateMany({ where: { userId: user.id, type: purpose, usedAt: null }, data: { usedAt: new Date() } });
  const code = String(randomInt(100000, 1000000));
  await prisma.verificationToken.create({
    data: { userId: user.id, type: purpose, tokenHash: hashFor(user.id, purpose, code), expiresAt: new Date(Date.now() + TTL_MS) },
  });
  const isReset = purpose === "RESET_OTP";
  const res = await sendEmail({
    to: user.email,
    userId: user.id,
    subject: isReset ? "Your AgriFlow AI password reset code" : "Your AgriFlow AI verification code",
    text: isReset
      ? `Your password reset code is ${code}\n\nIt expires in 10 minutes. If you did not ask to reset your password, ignore this email.`
      : `Your AgriFlow AI verification code is ${code}\n\nIt expires in 10 minutes.`,
  });
  return {
    delivery: res.sent ? "sent" : res.reason === "NOT_CONFIGURED" ? "not_configured" : "failed",
    expiresInSeconds: TTL_MS / 1000,
    resendAfterSeconds: OTP_RESEND_SECONDS,
    // Codes are only ever revealed in local development/test, never in production.
    ...(env.isProduction || res.sent ? {} : { devCode: code }),
  };
}

export async function verifyOtp(userId: string, purpose: OtpPurpose, code: string) {
  if (!/^\d{6}$/.test(code.trim())) throw invalid("Enter the 6-digit code.", { code: ["Enter the 6-digit code"] });
  await rateLimit(`otp-verify:${purpose}:${userId}`, 5, 900);
  const row = await prisma.verificationToken.findUnique({ where: { tokenHash: hashFor(userId, purpose, code) } });
  if (!row || row.userId !== userId || row.type !== purpose || row.usedAt || row.expiresAt < new Date()) {
    throw invalid("That code is wrong or has expired. Request a new one.", { code: ["Wrong or expired code"] });
  }
  const used = await prisma.verificationToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (used.count !== 1) throw invalid("That code has already been used.", { code: ["Already used"] });
}
