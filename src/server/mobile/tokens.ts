import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { hashToken, randomToken } from "@/lib/auth/crypto";
import { AppError } from "@/lib/errors";

/**
 * Mobile app authentication.
 * - Access token: HS256 JWT, 15 minutes, signed with a key derived from AUTH_SECRET.
 * - Refresh token: random 48-byte secret, stored only as a hash, 30 days, rotated on every use.
 *   Presenting an already-used refresh token revokes its whole family (token theft detection).
 */
export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_MS = 30 * 24 * 3600 * 1000;

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const signingKey = () => createHmac("sha256", env.authSecret).update("agriflow-mobile-access-v1").digest();

export type AccessClaims = { sub: string; role: Role; fam: string; iat: number; exp: number; typ: "access" };

export function signAccessToken(userId: string, role: Role, familyId: string, now = Math.floor(Date.now() / 1000)) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const claims: AccessClaims = { sub: userId, role, fam: familyId, iat: now, exp: now + ACCESS_TTL_SECONDS, typ: "access" };
  const body = b64url(JSON.stringify(claims));
  const sig = createHmac("sha256", signingKey()).update(`${header}.${body}`).digest();
  return `${header}.${body}.${b64url(sig)}`;
}

export function verifyAccessToken(token: string, now = Math.floor(Date.now() / 1000)): AccessClaims {
  const parts = token.split(".");
  if (parts.length !== 3) throw new AppError("Invalid access token.", "UNAUTHENTICATED");
  const [h, b, s] = parts as [string, string, string];
  let header: { alg?: string };
  try {
    header = JSON.parse(Buffer.from(h, "base64url").toString());
  } catch {
    throw new AppError("Invalid access token.", "UNAUTHENTICATED");
  }
  if (header.alg !== "HS256") throw new AppError("Invalid access token.", "UNAUTHENTICATED");
  const expected = createHmac("sha256", signingKey()).update(`${h}.${b}`).digest();
  const given = Buffer.from(s, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new AppError("Invalid access token.", "UNAUTHENTICATED");
  let claims: AccessClaims;
  try {
    claims = JSON.parse(Buffer.from(b, "base64url").toString());
  } catch {
    throw new AppError("Invalid access token.", "UNAUTHENTICATED");
  }
  if (claims.typ !== "access" || typeof claims.sub !== "string") throw new AppError("Invalid access token.", "UNAUTHENTICATED");
  if (typeof claims.exp !== "number" || claims.exp <= now) throw new AppError("Access token expired.", "UNAUTHENTICATED");
  return claims;
}

export type TokenPair = { accessToken: string; refreshToken: string; accessTokenExpiresIn: number; tokenType: "Bearer" };

export async function issueTokenPair(userId: string, role: Role, deviceName?: string, familyId: string = randomUUID()): Promise<TokenPair> {
  const refreshToken = randomToken(48);
  await prisma.refreshToken.create({
    data: { userId, familyId, tokenHash: hashToken(refreshToken), deviceName: deviceName?.slice(0, 80), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
  });
  return { accessToken: signAccessToken(userId, role, familyId), refreshToken, accessTokenExpiresIn: ACCESS_TTL_SECONDS, tokenType: "Bearer" };
}

export async function rotateRefreshToken(presented: string, deviceName?: string): Promise<TokenPair> {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(presented) }, include: { user: { select: { id: true, role: true, status: true } } } });
  if (!row) throw new AppError("Please sign in again.", "UNAUTHENTICATED");
  if (row.revokedAt) {
    // Reuse of a rotated token: someone else may hold it. Revoke the whole family.
    await revokeFamily(row.familyId);
    throw new AppError("Please sign in again.", "UNAUTHENTICATED");
  }
  if (row.expiresAt < new Date() || row.user.status !== "ACTIVE") {
    await revokeFamily(row.familyId);
    throw new AppError("Please sign in again.", "UNAUTHENTICATED");
  }
  const next = await issueTokenPair(row.user.id, row.user.role, deviceName ?? row.deviceName ?? undefined, row.familyId);
  const nextRow = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(next.refreshToken) }, select: { id: true } });
  // Conditional update: if two refreshes race, only one wins; the loser's new token is revoked.
  const res = await prisma.refreshToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: new Date(), replacedById: nextRow?.id, lastUsedAt: new Date() } });
  if (res.count !== 1) {
    await revokeFamily(row.familyId);
    throw new AppError("Please sign in again.", "UNAUTHENTICATED");
  }
  return next;
}

export async function revokeFamily(familyId: string) {
  await prisma.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeByToken(presented: string) {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(presented) }, select: { familyId: true } });
  if (row) await revokeFamily(row.familyId);
}

export async function revokeAllForUser(userId: string) {
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function isFamilyActive(familyId: string) {
  const live = await prisma.refreshToken.count({ where: { familyId, revokedAt: null, expiresAt: { gt: new Date() } } });
  return live > 0;
}
