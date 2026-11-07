"use server";

import { revalidatePath } from "next/cache";
import { parseInput, runAction } from "@/lib/action";
import { requireAdmin, requireRole } from "@/lib/auth/session";
import { invalid } from "@/lib/errors";
import { marketPriceSchema } from "@/lib/validation/schemas";
import * as admin from "@/server/admin/service";
import { moderateListing, addMarketPrice } from "@/server/marketplace/service";
import { setSetting, SETTING_DEFAULTS, type SettingKey } from "@/server/admin/settings";
import { transitionOrder } from "@/server/orders/service";

const done = () => revalidatePath("/admin", "layout");

export async function verifyUserAction(userId: string, verified: boolean) {
  return runAction(async () => {
    await admin.setUserVerified(await requireAdmin(), userId, verified);
    done();
  }, verified ? "Account verified." : "Verification removed.");
}

export async function setUserStatusAction(userId: string, status: "ACTIVE" | "SUSPENDED", reason?: string) {
  return runAction(async () => {
    await admin.setUserStatus(await requireAdmin(), userId, status, reason);
    done();
  }, status === "SUSPENDED" ? "Account suspended and signed out." : "Account reactivated.");
}

export async function createAdminAction(fd: FormData) {
  return runAction(async () => {
    const actor = await requireRole("SUPER_ADMIN");
    await admin.createAdmin(actor, {
      email: String(fd.get("email") ?? ""),
      fullName: String(fd.get("fullName") ?? ""),
      password: String(fd.get("password") ?? ""),
      role: fd.get("role") === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN",
    });
    done();
  }, "Administrator created.");
}

export async function setAdminRoleAction(userId: string, role: "ADMIN" | "SUPER_ADMIN") {
  return runAction(async () => {
    await admin.setUserRole(await requireRole("SUPER_ADMIN"), userId, role);
    done();
  }, "Permissions updated.");
}

export async function moderateListingAction(id: string, decision: "APPROVED" | "FLAGGED" | "REMOVED", note?: string) {
  return runAction(async () => {
    await moderateListing(await requireAdmin(), id, decision, note);
    done();
  }, `Listing ${decision.toLowerCase()}.`);
}

export async function moderateProductAction(id: string, action: "VERIFY" | "UNVERIFY" | "REMOVE" | "RESTORE") {
  return runAction(async () => {
    await admin.moderateProduct(await requireAdmin(), id, action);
    done();
  }, "Product updated.");
}

export async function resolveReportAction(id: string, status: "RESOLVED" | "DISMISSED", resolution?: string) {
  return runAction(async () => {
    await admin.resolveContentReport(await requireAdmin(), id, status, resolution);
    done();
  }, "Report closed.");
}

export async function upsertCropAction(fd: FormData) {
  return runAction(async () => {
    await admin.upsertCrop(await requireAdmin(), {
      id: (fd.get("id") as string) || undefined,
      name: String(fd.get("name") ?? ""),
      category: String(fd.get("category") ?? "Other"),
      defaultUnit: String(fd.get("defaultUnit") ?? "KG"),
      isActive: fd.get("isActive") === "on",
    });
    done();
  }, "Crop saved.");
}

export async function upsertCategoryAction(fd: FormData) {
  return runAction(async () => {
    await admin.upsertCategory(await requireAdmin(), { id: (fd.get("id") as string) || undefined, name: String(fd.get("name") ?? ""), requiresSafetyInfo: fd.get("requiresSafetyInfo") === "on", isActive: fd.get("isActive") === "on" });
    done();
  }, "Category saved.");
}

export async function setDistrictActiveAction(id: string, active: boolean) {
  return runAction(async () => {
    await admin.setDistrictActive(await requireAdmin(), id, active);
    done();
  }, "Region updated.");
}

export async function addMarketPriceAction(fd: FormData) {
  return runAction(async () => {
    await addMarketPrice(await requireAdmin(), parseInput(marketPriceSchema, fd));
    revalidatePath("/marketplace/prices");
    done();
  }, "Market price recorded.");
}

export async function saveSettingAction(fd: FormData) {
  return runAction(async () => {
    const actor = await requireAdmin();
    const key = String(fd.get("key")) as SettingKey;
    if (!(key in SETTING_DEFAULTS)) throw invalid("Unknown setting.");
    const def = SETTING_DEFAULTS[key];
    const raw = fd.get("value");
    const value = typeof def === "boolean" ? raw === "on" : typeof def === "number" ? Number(raw) : String(raw ?? "").slice(0, 500);
    if (typeof value === "number" && (!Number.isFinite(value) || value < 0 || value > 10000)) throw invalid("Enter a valid number.");
    await setSetting(actor.id, key, value);
    done();
  }, "Setting saved.");
}

export async function resolveDisputeAction(orderId: string, to: "COMPLETED" | "CANCELLED", note?: string) {
  return runAction(async () => {
    await transitionOrder(await requireAdmin(), orderId, to, note ?? "Resolved by administrator");
    done();
  }, "Dispute resolved.");
}
