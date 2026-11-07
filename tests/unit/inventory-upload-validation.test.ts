import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { applyMovement } from "@/server/inventory/calc";
import { sniffImageType, validateImageUpload, MAX_UPLOAD_BYTES } from "@/server/storage/validate";
import { farmSchema, registerSchema, transactionSchema, cropRecordSchema } from "@/lib/validation/schemas";
import { canAccessPath } from "@/lib/auth/roles";

const D = (v: string | number) => new Prisma.Decimal(v);

describe("inventory arithmetic", () => {
  it("adds and reduces stock", () => {
    expect(applyMovement(D(10), "IN", D(5)).balance.toString()).toBe("15");
    expect(applyMovement(D(10), "OUT", D(4)).balance.toString()).toBe("6");
  });
  it("sets counted level on ADJUST", () => {
    const r = applyMovement(D(10), "ADJUST", D(7));
    expect(r.change.toString()).toBe("-3");
    expect(r.balance.toString()).toBe("7");
  });
  it("prevents negative stock unless explicitly authorised", () => {
    expect(() => applyMovement(D(3), "OUT", D(5))).toThrow(/Not enough stock/);
    expect(applyMovement(D(3), "OUT", D(5), true).balance.toString()).toBe("-2");
  });
  it("rejects zero quantity", () => {
    expect(() => applyMovement(D(3), "IN", D(0))).toThrow();
  });
});

describe("file upload validation", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  it("detects types from magic bytes", () => {
    expect(sniffImageType(jpeg)).toBe("image/jpeg");
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(webp)).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
  it("rejects disguised, empty and oversized files", () => {
    expect(validateImageUpload(new TextEncoder().encode("MZ executable"), "image/jpeg")).toMatchObject({ ok: false });
    expect(validateImageUpload(new Uint8Array(), "image/png")).toMatchObject({ ok: false });
    expect(validateImageUpload(png, "image/jpeg")).toMatchObject({ ok: false, error: expect.stringMatching(/does not match/) });
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set(jpeg);
    expect(validateImageUpload(big)).toMatchObject({ ok: false });
  });
  it("accepts valid images and can disallow webp", () => {
    expect(validateImageUpload(jpeg, "image/jpeg")).toEqual({ ok: true, mimeType: "image/jpeg" });
    expect(validateImageUpload(webp, "image/webp", { allowWebp: false })).toMatchObject({ ok: false });
  });
});

describe("input validation", () => {
  it("requires consent and a strong password at registration", () => {
    const base = { fullName: "Test User", email: "t@example.com", password: "password1", role: "FARMER" };
    expect(registerSchema.safeParse({ ...base, consent: "on" }).success).toBe(true);
    expect(registerSchema.safeParse(base).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "short", consent: "on" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, role: "ADMIN", consent: "on" }).success).toBe(false); // cannot self-register as admin
  });
  it("keeps GPS within Zambia and requires both coordinates", () => {
    const farm = { name: "F", province: "SOUTHERN", district: "Choma", size: "5" };
    expect(farmSchema.safeParse(farm).success).toBe(true);
    expect(farmSchema.safeParse({ ...farm, latitude: "-16.8", longitude: "26.9" }).success).toBe(true);
    expect(farmSchema.safeParse({ ...farm, latitude: "51.5", longitude: "-0.1" }).success).toBe(false);
    expect(farmSchema.safeParse({ ...farm, latitude: "-16.8" }).success).toBe(false);
  });
  it("rejects income categories on expenses", () => {
    expect(transactionSchema.safeParse({ type: "EXPENSE", category: "PRODUCE_SALE", amount: "10", date: "2026-01-01" }).success).toBe(false);
    expect(transactionSchema.safeParse({ type: "EXPENSE", category: "FERTILIZER", amount: "10", date: "2026-01-01" }).success).toBe(true);
  });
  it("requires harvest after planting", () => {
    expect(cropRecordSchema.safeParse({ farmId: "f", cropId: "c", plantingDate: "2026-12-01", expectedHarvestDate: "2026-11-01" }).success).toBe(false);
  });
});

describe("role areas", () => {
  it("maps URL areas to roles", () => {
    expect(canAccessPath("FARMER", "/farmer/dashboard")).toBe(true);
    expect(canAccessPath("BUYER", "/farmer/dashboard")).toBe(false);
    expect(canAccessPath("FARMER", "/admin")).toBe(false);
    expect(canAccessPath("SUPER_ADMIN", "/admin/settings")).toBe(true);
    expect(canAccessPath("BUYER", "/marketplace")).toBe(true);
  });
});
