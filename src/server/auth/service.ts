import "server-only";
import type { Role, TokenType } from "@prisma/client";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError, invalid } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { hashToken, randomToken } from "@/lib/auth/crypto";
import { audit } from "@/lib/audit";
import { isValidDistrict } from "@/lib/zambia";
import {
  buyerOnboardingSchema,
  farmerOnboardingSchema,
  registerSchema,
  supplierOnboardingSchema,
  transporterOnboardingSchema,
} from "@/lib/validation/schemas";
import { sendEmail } from "@/server/notifications/email";
import { notify } from "@/server/notifications/service";

const TOKEN_TTL: Record<TokenType, number> = {
  EMAIL_VERIFY: 48 * 3600_000,
  PASSWORD_RESET: 60 * 60_000,
  PHONE_OTP: 10 * 60_000,
};

export async function issueToken(userId: string, type: TokenType) {
  // Invalidate earlier unused tokens of the same type
  await prisma.verificationToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  const token = type === "PHONE_OTP" ? String(randomInt(100000, 1000000)) : randomToken();
  await prisma.verificationToken.create({
    data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL[type]) },
  });
  return token;
}

export async function consumeToken(token: string, type: TokenType) {
  const row = await prisma.verificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) {
    throw invalid("This link is invalid or has expired. Please request a new one.");
  }
  await prisma.verificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row.userId;
}

export async function registerUser(input: z.input<typeof registerSchema>) {
  const data = registerSchema.parse(input);
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw new AppError("An account with this email already exists. Try signing in.", "CONFLICT", { email: ["Email already registered"] });
  if (data.phone) {
    const phoneTaken = await prisma.user.findUnique({ where: { phone: normalisePhone(data.phone) } });
    if (phoneTaken) throw new AppError("This phone number is already registered.", "CONFLICT", { phone: ["Phone already registered"] });
  }
  const user = await prisma.user.create({
    data: {
      email: data.email,
      phone: data.phone ? normalisePhone(data.phone) : null,
      passwordHash: await hashPassword(data.password),
      role: data.role as Role,
      dataConsentAt: new Date(),
      profile: { create: { fullName: data.fullName } },
    },
  });
  await audit({ actorId: user.id, action: "user.register", entityType: "User", entityId: user.id, metadata: { role: user.role } });
  await sendVerificationEmail(user.id, user.email);
  await notify(user.id, {
    type: "ACCOUNT",
    title: "Welcome to AgriFlow AI",
    body: "Complete your profile to unlock all features. Check your email to verify your address.",
    link: "/onboarding",
  });
  return user;
}

export async function sendVerificationEmail(userId: string, email: string) {
  const token = await issueToken(userId, "EMAIL_VERIFY");
  const link = `${env.appUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to: email,
    userId,
    subject: "Verify your AgriFlow AI email",
    text: `Welcome to AgriFlow AI Zambia.\n\nVerify your email address: ${link}\n\nThis link expires in 48 hours.`,
  });
}

export async function verifyEmail(token: string) {
  const userId = await consumeToken(token, "EMAIL_VERIFY");
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  return userId;
}

/** Returns the user when credentials are valid. Uses a constant-ish path to reduce user enumeration. */
export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : await verifyPassword(password, "$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!user || !ok) throw new AppError("Incorrect email or password.", "UNAUTHENTICATED");
  if (user.status !== "ACTIVE") throw new AppError("This account is suspended. Contact support.", "FORBIDDEN");
  return user;
}

/** Always resolves (no account enumeration). */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return;
  const token = await issueToken(user.id, "PASSWORD_RESET");
  const link = `${env.appUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    userId: user.id,
    subject: "Reset your AgriFlow AI password",
    text: `Someone requested a password reset for your AgriFlow AI account.\n\nReset your password: ${link}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
  });
  await audit({ actorId: user.id, action: "user.password_reset_requested", entityType: "User", entityId: user.id });
}

export async function resetPassword(token: string, password: string) {
  const userId = await consumeToken(token, "PASSWORD_RESET");
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.session.deleteMany({ where: { userId } }), // sign out all devices
  ]);
  await audit({ actorId: userId, action: "user.password_reset", entityType: "User", entityId: userId });
  return userId;
}

/**
 * Phone verification architecture: an OTP is issued and queued for SMS.
 * No SMS provider is connected in this build, so the message is recorded as NOT_CONFIGURED.
 */
export async function startPhoneVerification(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.phone) throw invalid("Add a phone number to your profile first.");
  const code = await issueToken(userId, "PHONE_OTP");
  await prisma.outboundMessage.create({
    data: { userId, channel: "SMS", recipient: user.phone, body: `Your AgriFlow AI code is ${code}`, status: "NOT_CONFIGURED" },
  });
  return { queued: true, smsProviderConfigured: false, devCode: env.isProduction ? undefined : code };
}

export async function confirmPhone(userId: string, code: string) {
  const owner = await consumeToken(code.trim(), "PHONE_OTP");
  if (owner !== userId) throw invalid("Invalid code.");
  await prisma.user.update({ where: { id: userId }, data: { phoneVerifiedAt: new Date() } });
}

export function normalisePhone(p: string) {
  const digits = p.replace(/[^0-9+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return "+260" + digits.slice(1);
  if (digits.startsWith("260")) return "+" + digits;
  return digits;
}

/** Progressive onboarding — saves role-specific profile and marks onboarding complete. */
export async function completeOnboarding(userId: string, role: Role, raw: Record<string, unknown>) {
  const base = { fullName: String(raw.fullName ?? ""), province: raw.province, district: raw.district };
  switch (role) {
    case "FARMER": {
      const d = farmerOnboardingSchema.parse(raw);
      assertDistrict(d.province, d.district);
      await prisma.$transaction(async (tx) => {
        await saveBase(tx, userId, d);
        await tx.farmerProfile.upsert({
          where: { userId },
          create: { userId, experienceYears: d.experienceYears, farmingType: d.farmingType, mainCrops: d.mainCrops },
          update: { experienceYears: d.experienceYears, farmingType: d.farmingType, mainCrops: d.mainCrops },
        });
        if (d.farmName && d.farmSize) {
          const existing = await tx.farm.count({ where: { ownerId: userId } });
          if (existing === 0) {
            await tx.farm.create({
              data: {
                ownerId: userId,
                name: d.farmName,
                province: d.province,
                district: d.district,
                size: d.farmSize,
                sizeUnit: d.sizeUnit,
                farmingType: d.farmingType,
              },
            });
          }
        }
        await tx.user.update({ where: { id: userId }, data: { onboardingCompletedAt: new Date() } });
      });
      break;
    }
    case "BUYER": {
      const d = buyerOnboardingSchema.parse(raw);
      assertDistrict(d.province, d.district);
      await prisma.$transaction(async (tx) => {
        await saveBase(tx, userId, d);
        await tx.buyerProfile.upsert({
          where: { userId },
          create: { userId, businessName: d.businessName, buyerType: d.buyerType, preferredCrops: d.preferredCrops },
          update: { businessName: d.businessName, buyerType: d.buyerType, preferredCrops: d.preferredCrops },
        });
        await tx.user.update({ where: { id: userId }, data: { onboardingCompletedAt: new Date() } });
      });
      break;
    }
    case "SUPPLIER": {
      const d = supplierOnboardingSchema.parse(raw);
      assertDistrict(d.province, d.district);
      await prisma.$transaction(async (tx) => {
        await saveBase(tx, userId, d);
        const p = { businessName: d.businessName, registrationNumber: d.registrationNumber, description: d.description, categories: d.categories };
        await tx.supplierProfile.upsert({ where: { userId }, create: { userId, ...p }, update: p });
        await tx.user.update({ where: { id: userId }, data: { onboardingCompletedAt: new Date() } });
      });
      break;
    }
    case "TRANSPORTER": {
      const d = transporterOnboardingSchema.parse(raw);
      assertDistrict(d.province, d.district);
      await prisma.$transaction(async (tx) => {
        await saveBase(tx, userId, d);
        const p = {
          businessName: d.businessName,
          contactPhone: d.contactPhone ? normalisePhone(d.contactPhone) : null,
          pricingModel: d.pricingModel,
          baseRate: d.baseRate,
          serviceProvinces: d.serviceProvinces,
        };
        await tx.transporterProfile.upsert({ where: { userId }, create: { userId, ...p }, update: p });
        await tx.user.update({ where: { id: userId }, data: { onboardingCompletedAt: new Date() } });
      });
      break;
    }
    default:
      void base;
      throw invalid("Administrators do not need onboarding.");
  }
}

function assertDistrict(province: Parameters<typeof isValidDistrict>[0], district: string) {
  if (!isValidDistrict(province, district)) throw invalid("Choose a district in the selected province.", { district: ["Invalid district for province"] });
}

type BaseInput = { fullName: string; phone?: string; province: import("@prisma/client").Province; district: string };
async function saveBase(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], userId: string, d: BaseInput) {
  await tx.userProfile.upsert({
    where: { userId },
    create: { userId, fullName: d.fullName, province: d.province, district: d.district },
    update: { fullName: d.fullName, province: d.province, district: d.district },
  });
  if (d.phone) {
    const phone = normalisePhone(d.phone);
    const taken = await tx.user.findFirst({ where: { phone, NOT: { id: userId } } });
    if (taken) throw new AppError("This phone number is already registered to another account.", "CONFLICT", { phone: ["Phone already registered"] });
    await tx.user.update({ where: { id: userId }, data: { phone } });
  }
}
