import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { dispatch, ROUTES } from "@/server/mobile/router";
import { signAccessToken, verifyAccessToken } from "@/server/mobile/tokens";
import { makeUser, resetDb } from "./helpers";

let ref: Awaited<ReturnType<typeof resetDb>>;
beforeAll(async () => {
  ref = await resetDb();
});

type Opts = { method?: string; body?: unknown; token?: string; headers?: Record<string, string> };
async function call(path: string, o: Opts = {}) {
  const url = new URL(`http://localhost/api/v1${path}`);
  const headers: Record<string, string> = { "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}`, ...(o.headers ?? {}) };
  if (o.token) headers.authorization = `Bearer ${o.token}`;
  let body: BodyInit | undefined;
  if (o.body instanceof FormData) body = o.body;
  else if (o.body !== undefined) {
    body = JSON.stringify(o.body);
    headers["content-type"] = "application/json";
  }
  const res = await dispatch(new Request(url, { method: o.method ?? (o.body ? "POST" : "GET"), headers, body }), path.split("?")[0]!.split("/").filter(Boolean));
  const text = await res.text();
  let json: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

const uniq = () => Math.random().toString(36).slice(2, 8);
const registration = (role = "FARMER") => ({
  fullName: "Mwila Banda",
  email: `mwila.${uniq()}@test.local`,
  phone: `+26097${Math.floor(1000000 + Math.random() * 8999999)}`,
  password: "Harvest2026",
  confirmPassword: "Harvest2026",
  country: "ZM",
  province: "SOUTHERN",
  district: "Choma",
  role,
  acceptTerms: true,
  deviceName: "Test phone",
});

describe("mobile auth (JWT access + rotating refresh tokens)", () => {
  it("registers, then verifies the e-mail with the 6-digit code", async () => {
    const reg = await call("/auth/register", { body: registration() });
    expect(reg.status).toBe(201);
    expect(reg.json.accessToken).toBeTruthy();
    expect(reg.json.refreshToken).toBeTruthy();
    expect(reg.json.user.role).toBe("FARMER");
    expect(reg.json.user.profile).toMatchObject({ province: "SOUTHERN", district: "Choma" });
    // No e-mail provider in tests: the API says so honestly (and exposes the code only outside production)
    expect(reg.json.verification.delivery).toBe("not_configured");
    const code = reg.json.verification.devCode as string;
    expect(code).toMatch(/^\d{6}$/);
    const bad = await call("/auth/verify-email", { token: reg.json.accessToken, body: { code: code === "000000" ? "111111" : "000000" } });
    expect(bad.status).toBe(400);
    const ok = await call("/auth/verify-email", { token: reg.json.accessToken, body: { code } });
    expect(ok.json).toEqual({ verified: true });
    const me = await call("/me", { token: reg.json.accessToken });
    expect(me.json.emailVerified).toBe(true);
  });

  it("validates registration input", async () => {
    const r = await call("/auth/register", { body: { ...registration(), password: "short", confirmPassword: "nomatch", acceptTerms: false, district: "Kitwe" } });
    expect(r.status).toBe(400);
    expect(Object.keys(r.json.error.fieldErrors)).toEqual(expect.arrayContaining(["password", "acceptTerms"]));
    const wrongDistrict = await call("/auth/register", { body: { ...registration(), district: "Kitwe" } });
    expect(wrongDistrict.status).toBe(400);
    expect(wrongDistrict.json.error.fieldErrors.district).toBeTruthy();
  });

  it("logs in, rejects wrong passwords and duplicate e-mails", async () => {
    const r = registration("BUYER");
    await call("/auth/register", { body: r });
    expect((await call("/auth/register", { body: r })).status).toBe(409);
    expect((await call("/auth/login", { body: { email: r.email, password: "WrongPass1" } })).status).toBe(401);
    const ok = await call("/auth/login", { body: { email: r.email.toUpperCase(), password: r.password } });
    expect(ok.status).toBe(200);
    expect(ok.json.user.role).toBe("BUYER");
  });

  it("rotates refresh tokens and revokes the family when an old one is reused", async () => {
    const reg = await call("/auth/register", { body: registration() });
    const first = reg.json.refreshToken;
    const r1 = await call("/auth/refresh", { body: { refreshToken: first } });
    expect(r1.status).toBe(200);
    expect(r1.json.refreshToken).not.toBe(first);
    // Reusing the rotated token = possible theft → whole family revoked
    expect((await call("/auth/refresh", { body: { refreshToken: first } })).status).toBe(401);
    expect((await call("/auth/refresh", { body: { refreshToken: r1.json.refreshToken } })).status).toBe(401);
    // …and the access token stops working immediately too
    expect((await call("/me", { token: r1.json.accessToken })).status).toBe(401);
  });

  it("logout revokes the session at once", async () => {
    const reg = await call("/auth/register", { body: registration() });
    expect((await call("/me", { token: reg.json.accessToken })).status).toBe(200);
    await call("/auth/logout", { body: { refreshToken: reg.json.refreshToken } });
    expect((await call("/me", { token: reg.json.accessToken })).status).toBe(401);
  });

  it("rejects tampered, expired and missing access tokens", async () => {
    const u = await makeUser("FARMER");
    const valid = signAccessToken(u.id, "FARMER", "fam");
    const [h, b, s] = valid.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(b!, "base64url").toString()), role: "SUPER_ADMIN" })).toString("base64url");
    expect(() => verifyAccessToken(`${h}.${forged}.${s}`)).toThrow();
    expect(() => verifyAccessToken(signAccessToken(u.id, "FARMER", "fam", Math.floor(Date.now() / 1000) - 3600))).toThrow(/expired/i);
    expect((await call("/me")).status).toBe(401);
    expect((await call("/me", { token: "not.a.jwt" })).status).toBe(401);
  });

  it("resets a forgotten password with an e-mailed code, without revealing whether the account exists", async () => {
    const r = registration();
    const reg = await call("/auth/register", { body: r });
    const unknown = await call("/auth/forgot-password", { body: { email: "nobody@test.local" } });
    const known = await call("/auth/forgot-password", { body: { email: r.email } });
    expect(unknown.status).toBe(200);
    expect(known.json.message).toBe(unknown.json.message);
    // Read the code from the test database the way an inbox would receive it
    const msg = await prisma.outboundMessage.findFirst({ where: { recipient: r.email, subject: { contains: "reset" } }, orderBy: { createdAt: "desc" } });
    const code = /(\d{6})/.exec(msg!.body)![1]!;
    const reset = await call("/auth/reset-password", { body: { email: r.email, code, password: "NewHarvest99", confirmPassword: "NewHarvest99" } });
    expect(reset.status).toBe(200);
    // Old sessions are signed out; new password works; code cannot be reused
    expect((await call("/me", { token: reg.json.accessToken })).status).toBe(401);
    expect((await call("/auth/login", { body: { email: r.email, password: "NewHarvest99" } })).status).toBe(200);
    expect((await call("/auth/reset-password", { body: { email: r.email, code, password: "Another123", confirmPassword: "Another123" } })).status).toBe(400);
  });

  it("reports which social sign-in providers are configured (none by default)", async () => {
    const c = await call("/auth/config");
    expect(c.json.socialProviders).toEqual({ google: false, apple: false, facebook: false });
  });
});

describe("mobile API authorisation and data isolation", () => {
  async function tokenFor(role: Parameters<typeof makeUser>[0]) {
    const u = await makeUser(role);
    const reg = await prisma.refreshToken.create({ data: { userId: u.id, familyId: `fam-${u.id}`, tokenHash: `h-${u.id}`, expiresAt: new Date(Date.now() + 3600_000) } });
    return { user: u, token: signAccessToken(u.id, u.role, reg.familyId) };
  }

  it("enforces roles on the server", async () => {
    const buyer = await tokenFor("BUYER");
    expect((await call("/farms", { token: buyer.token })).status).toBe(403);
    expect((await call("/admin/overview", { token: buyer.token })).status).toBe(403);
    expect((await call("/expert/cases", { token: buyer.token })).status).toBe(403);
  });

  it("keeps each farmer's farms private", async () => {
    const a = await tokenFor("FARMER");
    const b = await tokenFor("FARMER");
    const created = await call("/farms", { token: a.token, body: { name: "Mukuni Farm", province: "SOUTHERN", district: "Choma", size: 4.5, sizeUnit: "HECTARES" } });
    expect(created.status).toBe(200);
    expect((await call(`/farms/${created.json.id}`, { token: a.token })).status).toBe(200);
    expect((await call(`/farms/${created.json.id}`, { token: b.token })).status).toBeGreaterThanOrEqual(403);
    const listB = await call("/farms", { token: b.token });
    expect(listB.json.find((f: { id: string }) => f.id === created.json.id)).toBeUndefined();
    const dash = await call("/dashboard", { token: a.token });
    expect(dash.json.farm.farmCount).toBe(1);
    expect(dash.json.farm.totalHectares).toBe(4.5);
  });

  it("only lets verified experts see and answer cases the farmer sent", async () => {
    const farmer = await tokenFor("FARMER");
    const expert = await tokenFor("EXPERT");
    const a = await prisma.cropHealthAssessment.create({ data: { userId: farmer.user.id, cropId: ref.maize.id, symptoms: "Yellow streaks on lower leaves", status: "COMPLETED", possibleIssue: "Nitrogen deficiency", confidence: "MEDIUM" } });
    // Not yet verified → no access
    expect((await call("/expert/cases", { token: expert.token })).status).toBe(403);
    await prisma.user.update({ where: { id: expert.user.id }, data: { verifiedAt: new Date() } });
    // Not sent for review → not visible
    expect((await call("/expert/cases", { token: expert.token })).json.open).toHaveLength(0);
    const req = await call(`/crop-health/${a.id}/expert-review`, { token: farmer.token, body: {} });
    expect(req.json.expertReviewStatus).toBe("REQUESTED");
    const queue = await call("/expert/cases", { token: expert.token });
    expect(queue.json.open).toHaveLength(1);
    // No farmer identity in the case payload
    expect(JSON.stringify(queue.json.open[0])).not.toContain(farmer.user.email);
    expect((await call(`/expert/cases/${a.id}/review`, { token: expert.token, body: { note: "short" } })).status).toBe(400);
    const ans = await call(`/expert/cases/${a.id}/review`, { token: expert.token, body: { note: "Looks like nitrogen deficiency. Top-dress with urea at 100 kg/ha after rain." } });
    expect(ans.json.expertReviewStatus).toBe("ANSWERED");
    const n = await prisma.notification.findFirst({ where: { userId: farmer.user.id, title: { contains: "expert reviewed" } } });
    expect(n).toBeTruthy();
    // Cannot be answered twice
    expect((await call(`/expert/cases/${a.id}/review`, { token: expert.token, body: { note: "A second opinion that should be refused by the API." } })).status).toBe(400);
  });

  it("gives distributors both seller and carrier permissions", async () => {
    const d = await tokenFor("DISTRIBUTOR");
    await prisma.supplierProfile.create({ data: { userId: d.user.id, businessName: "Kafue Agro Distributors" } });
    expect((await call("/seller/products", { token: d.token })).status).toBe(200);
    expect((await call("/deliveries/open", { token: d.token })).status).toBe(200);
    expect((await call("/inventory", { token: d.token })).status).toBe(200);
    expect((await call("/finance/summary", { token: d.token })).status).toBe(403);
  });

  it("answers unknown endpoints and wrong methods clearly", async () => {
    const f = await tokenFor("FARMER");
    expect((await call("/does-not-exist", { token: f.token })).status).toBe(404);
    expect((await call("/farms", { token: f.token, method: "PUT" })).status).toBe(405);
  });

  it("never returns a fake AI answer when Grok is not configured", async () => {
    const f = await tokenFor("FARMER");
    expect((await call("/ai/status", { token: f.token })).json).toEqual({ configured: false });
    const r = await call("/ai/chat", { token: f.token, body: { message: "When should I plant maize in Choma?" } });
    expect(r.status).toBe(200);
    expect(r.json.mode).toBe("fallback");
  });

  it("registers every route with an explicit auth rule", () => {
    for (const r of ROUTES) expect(r.auth === false || r.auth === true || Array.isArray(r.auth)).toBe(true);
    const publicPaths = ROUTES.filter((r) => r.auth === false).map((r) => `${r.method} ${r.path}`).sort();
    expect(publicPaths).toEqual(
      ["GET /auth/config", "GET /health", "GET /meta/regions", "POST /auth/forgot-password", "POST /auth/login", "POST /auth/logout", "POST /auth/refresh", "POST /auth/register", "POST /auth/reset-password"].sort(),
    );
  });
});
