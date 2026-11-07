"use server";

import { revalidatePath } from "next/cache";
import { parseInput, runAction } from "@/lib/action";
import { requireRole, requireUser } from "@/lib/auth/session";
import { deliveryRequestSchema, deliveryUpdateSchema, estimateSchema, inventoryItemSchema, stockMovementSchema, supplierProductSchema, transactionSchema, vehicleSchema } from "@/lib/validation/schemas";
import * as inventory from "@/server/inventory/service";
import * as suppliers from "@/server/suppliers/service";
import * as logistics from "@/server/logistics/service";
import * as finance from "@/server/finance/service";
import * as notifications from "@/server/notifications/service";
import { saveImage } from "@/server/storage/service";
import type { NotificationType } from "@prisma/client";

// ───────── inventory ─────────
export async function createInventoryItemAction(fd: FormData) {
  return runAction(async () => {
    await inventory.createInventoryItem(await requireRole("FARMER", "SUPPLIER"), parseInput(inventoryItemSchema, fd));
    revalidatePath("/", "layout");
  }, "Item added.");
}

export async function moveStockAction(fd: FormData) {
  return runAction(async () => {
    await inventory.moveStock(await requireRole("FARMER", "SUPPLIER"), parseInput(stockMovementSchema, fd));
    revalidatePath("/", "layout");
  }, "Stock updated.");
}

export async function deleteInventoryItemAction(id: string) {
  return runAction(async () => {
    await inventory.deleteInventoryItem(await requireRole("FARMER", "SUPPLIER"), id);
    revalidatePath("/", "layout");
  }, "Item deleted.");
}

// ───────── supplier products ─────────
export async function createProductAction(fd: FormData) {
  return runAction(async () => {
    const actor = await requireRole("SUPPLIER");
    const img = fd.get("image");
    const imageId = img instanceof File && img.size > 0 ? (await saveImage(actor, img, "PRODUCT_PHOTO")).id : undefined;
    await suppliers.createProduct(actor, parseInput(supplierProductSchema, fd), imageId);
    revalidatePath("/supplier", "layout");
  }, "Product published.");
}

export async function updateProductAction(id: string, fd: FormData) {
  return runAction(async () => {
    await suppliers.updateProduct(await requireRole("SUPPLIER"), id, parseInput(supplierProductSchema, fd));
    revalidatePath("/supplier", "layout");
  }, "Product updated.");
}

// ───────── logistics ─────────
export async function requestDeliveryAction(fd: FormData) {
  return runAction(async () => {
    const d = await logistics.requestDelivery(await requireRole("FARMER", "BUYER", "SUPPLIER"), parseInput(deliveryRequestSchema, fd));
    revalidatePath("/", "layout");
    return { id: d.id };
  }, "Delivery requested. Transporters in the area have been notified.");
}

export async function updateDeliveryAction(fd: FormData) {
  return runAction(async () => {
    const actor = await requireUser();
    const proof = fd.get("proof");
    const proofId = proof instanceof File && proof.size > 0 ? (await saveImage(actor, proof, "PROOF_OF_DELIVERY")).id : undefined;
    await logistics.updateDelivery(actor, parseInput(deliveryUpdateSchema, fd), proofId);
    revalidatePath("/", "layout");
  }, "Delivery updated.");
}

export async function declineDeliveryAction(id: string, reason?: string) {
  return runAction(async () => {
    await logistics.declineDelivery(await requireRole("TRANSPORTER"), id, reason);
    revalidatePath("/transporter", "layout");
  }, "Request declined.");
}

export async function addVehicleAction(fd: FormData) {
  return runAction(async () => {
    await logistics.addVehicle(await requireRole("TRANSPORTER"), parseInput(vehicleSchema, fd));
    revalidatePath("/transporter/vehicles");
  }, "Vehicle added.");
}

export async function setVehicleActiveAction(id: string, active: boolean) {
  return runAction(async () => {
    await logistics.setVehicleActive(await requireRole("TRANSPORTER"), id, active);
    revalidatePath("/transporter/vehicles");
  }, active ? "Vehicle activated." : "Vehicle deactivated.");
}

// ───────── finance ─────────
export async function recordTransactionAction(fd: FormData) {
  return runAction(async () => {
    await finance.recordTransaction(await requireRole("FARMER"), parseInput(transactionSchema, fd));
    revalidatePath("/farmer", "layout");
  }, "Transaction recorded.");
}

export async function deleteTransactionAction(id: string) {
  return runAction(async () => {
    await finance.deleteTransaction(await requireRole("FARMER"), id);
    revalidatePath("/farmer", "layout");
  }, "Transaction deleted.");
}

export async function recordEstimateAction(fd: FormData) {
  return runAction(async () => {
    await finance.recordEstimate(await requireRole("FARMER"), parseInput(estimateSchema, fd));
    revalidatePath("/farmer/finances");
  }, "Estimate saved.");
}

export async function deleteEstimateAction(id: string) {
  return runAction(async () => {
    await finance.deleteEstimate(await requireRole("FARMER"), id);
    revalidatePath("/farmer/finances");
  }, "Estimate deleted.");
}

// ───────── notifications ─────────
export async function markNotificationReadAction(id: string) {
  return runAction(async () => {
    await notifications.markRead((await requireUser()).id, id);
    revalidatePath("/", "layout");
  });
}

export async function markAllNotificationsReadAction() {
  return runAction(async () => {
    await notifications.markAllRead((await requireUser()).id);
    revalidatePath("/", "layout");
  }, "All notifications marked as read.");
}

export async function setNotificationPreferenceAction(fd: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    const type = String(fd.get("type")) as NotificationType;
    if (!notifications.PREFERENCE_TYPES.some((p) => p.type === type)) throw new Error("Invalid type");
    await notifications.setPreference(user.id, type, { inApp: fd.get("inApp") === "on", email: fd.get("email") === "on", sms: fd.get("sms") === "on", whatsapp: fd.get("whatsapp") === "on" });
    revalidatePath("/", "layout");
  }, "Preference saved.");
}
