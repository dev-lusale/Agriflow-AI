import "server-only";
import type { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/action";
import { forbidden, invalid, notFound } from "@/lib/errors";
import { D } from "@/lib/money";
import { inventoryItemSchema, stockMovementSchema } from "@/lib/validation/schemas";
import { notify } from "@/server/notifications/service";
import { applyMovement } from "./calc";

function assertInventoryRole(actor: Actor) {
  if (actor.role !== "FARMER" && actor.role !== "SUPPLIER") throw forbidden("Inventory is available to farmers and suppliers.");
}

export async function listInventory(actor: Actor) {
  const items = await prisma.inventoryItem.findMany({
    where: { ownerId: actor.id },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { farm: { select: { name: true } }, supplierProduct: { select: { id: true, name: true } } },
  });
  const valuation = items.reduce((acc, i) => acc.plus(i.unitCost ? i.quantity.times(i.unitCost) : 0), new Prisma.Decimal(0));
  const low = items.filter((i) => i.minStockLevel.gt(0) && i.quantity.lte(i.minStockLevel));
  const expiringSoon = items.filter((i) => i.expiryDate && i.expiryDate.getTime() - Date.now() < 30 * 86400_000);
  return { items, valuation: valuation.toFixed(2), low, expiringSoon };
}

export async function createInventoryItem(actor: Actor, input: z.input<typeof inventoryItemSchema>) {
  assertInventoryRole(actor);
  const d = inventoryItemSchema.parse(input);
  if (d.farmId) {
    const farm = await prisma.farm.findUnique({ where: { id: d.farmId } });
    if (!farm || farm.ownerId !== actor.id) throw forbidden("Farm not found in your account.");
  }
  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.create({ data: { ...d, ownerId: actor.id } });
    if (d.quantity > 0) {
      await tx.inventoryMovement.create({
        data: { itemId: item.id, actorId: actor.id, type: "ADDITION", quantityChange: d.quantity, balanceAfter: d.quantity, unitCost: d.unitCost, reason: "Opening stock" },
      });
    }
    return item;
  });
}

/**
 * Record a stock movement. Reductions may not take stock below zero unless it is an explicit
 * ADJUST with allowNegative (an authorised correction), which is recorded as such.
 */
export async function moveStock(actor: Actor, input: z.input<typeof stockMovementSchema>) {
  assertInventoryRole(actor);
  const d = stockMovementSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({ where: { id: d.itemId } });
    if (!item || item.ownerId !== actor.id) throw notFound("Inventory item not found.");
    const { change, balance } = applyMovement(item.quantity, d.direction, D(d.quantity), d.allowNegative);
    // conditional update guards against concurrent movements
    const res = await tx.inventoryItem.updateMany({
      where: { id: item.id, quantity: item.quantity },
      data: { quantity: balance, ...(d.direction === "IN" && d.unitCost !== undefined ? { unitCost: d.unitCost } : {}) },
    });
    if (res.count === 0) throw invalid("Stock changed while you were editing. Please try again.");
    const movement = await tx.inventoryMovement.create({
      data: {
        itemId: item.id,
        actorId: actor.id,
        type: d.direction === "IN" ? "ADDITION" : d.direction === "OUT" && !d.allowNegative ? "REDUCTION" : "ADJUSTMENT",
        quantityChange: change,
        balanceAfter: balance,
        unitCost: d.unitCost,
        reason: d.reason ?? (d.allowNegative ? "Authorised adjustment" : undefined),
      },
    });
    if (item.minStockLevel.gt(0) && balance.lte(item.minStockLevel) && item.quantity.gt(item.minStockLevel)) {
      await notify(
        actor.id,
        { type: "LOW_INVENTORY", title: `Low stock: ${item.name}`, body: `${item.name} is down to ${balance.toString()} ${item.unit} (minimum ${item.minStockLevel.toString()}).`, link: actor.role === "SUPPLIER" ? "/supplier/inventory" : "/farmer/inventory" },
        tx,
      );
    }
    return movement;
  });
}

export async function updateInventoryItem(actor: Actor, id: string, input: { minStockLevel?: number; storageLocation?: string; unitCost?: number; expiryDate?: Date | null; name?: string }) {
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item || item.ownerId !== actor.id) throw notFound("Inventory item not found.");
  return prisma.inventoryItem.update({ where: { id }, data: input });
}

export async function deleteInventoryItem(actor: Actor, id: string) {
  const item = await prisma.inventoryItem.findUnique({ where: { id }, include: { supplierProduct: true } });
  if (!item || item.ownerId !== actor.id) throw notFound("Inventory item not found.");
  if (item.supplierProduct) throw invalid("This stock is linked to a product listing. Deactivate the product instead.");
  await prisma.inventoryItem.delete({ where: { id } });
}

export async function movementHistory(actor: Actor, itemId?: string) {
  return prisma.inventoryMovement.findMany({
    where: { item: { ownerId: actor.id }, ...(itemId ? { itemId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { item: { select: { name: true, unit: true } } },
  });
}
