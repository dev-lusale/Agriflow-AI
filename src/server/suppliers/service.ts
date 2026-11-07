import "server-only";
import { Prisma, type InventoryCategory } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/action";
import { forbidden, invalid, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { supplierProductSchema } from "@/lib/validation/schemas";

function assertSupplier(actor: Actor) {
  if (actor.role !== "SUPPLIER") throw forbidden("Only supplier accounts can manage products.");
}

const INV_CATEGORY_FOR_SLUG: Record<string, InventoryCategory> = {
  seeds: "SEEDS",
  fertilizer: "FERTILIZER",
  "crop-protection": "PESTICIDE",
  equipment: "EQUIPMENT",
  tools: "TOOLS",
  irrigation: "IRRIGATION",
  "animal-feed": "FEED",
};

export async function createProduct(actor: Actor, input: z.input<typeof supplierProductSchema>, imageId?: string) {
  assertSupplier(actor);
  const d = supplierProductSchema.parse(input);
  const category = await prisma.productCategory.findUnique({ where: { id: d.categoryId } });
  if (!category?.isActive) throw invalid("Choose a valid category.");
  if (category.requiresSafetyInfo && !d.safetyInfo) {
    throw invalid("Safety and handling information is required for this category.", { safetyInfo: ["Required for crop protection products"] });
  }
  if (imageId) {
    const img = await prisma.upload.findUnique({ where: { id: imageId } });
    if (!img || img.ownerId !== actor.id) throw forbidden("Invalid image.");
  }
  const product = await prisma.$transaction(async (tx) => {
    const inv = await tx.inventoryItem.create({
      data: {
        ownerId: actor.id,
        name: d.name,
        category: INV_CATEGORY_FOR_SLUG[category.slug] ?? "OTHER",
        unit: d.unit.toLowerCase(),
        quantity: d.stock,
        minStockLevel: d.minStockLevel,
      },
    });
    if (d.stock > 0) {
      await tx.inventoryMovement.create({ data: { itemId: inv.id, actorId: actor.id, type: "ADDITION", quantityChange: d.stock, balanceAfter: d.stock, reason: "Opening stock" } });
    }
    return tx.supplierProduct.create({
      data: {
        supplierId: actor.id,
        categoryId: d.categoryId,
        inventoryItemId: inv.id,
        name: d.name,
        brand: d.brand,
        description: d.description,
        unit: d.unit,
        price: d.price,
        registrationNumber: d.registrationNumber,
        safetyInfo: d.safetyInfo,
        isActive: d.isActive,
        imageId,
      },
    });
  });
  await audit({ actorId: actor.id, action: "product.create", entityType: "SupplierProduct", entityId: product.id });
  return product;
}

export async function updateProduct(actor: Actor, id: string, input: z.input<typeof supplierProductSchema>) {
  assertSupplier(actor);
  const p = await prisma.supplierProduct.findUnique({ where: { id } });
  if (!p || p.supplierId !== actor.id) throw notFound("Product not found.");
  const d = supplierProductSchema.parse(input);
  const category = await prisma.productCategory.findUnique({ where: { id: d.categoryId } });
  if (!category) throw invalid("Choose a valid category.");
  if (category.requiresSafetyInfo && !d.safetyInfo) throw invalid("Safety and handling information is required for this category.", { safetyInfo: ["Required"] });
  // Changing the declared registration number resets admin verification
  const verification = (d.registrationNumber ?? null) !== p.registrationNumber ? "UNVERIFIED" : p.verification;
  return prisma.$transaction(async (tx) => {
    await tx.inventoryItem.update({ where: { id: p.inventoryItemId }, data: { name: d.name, minStockLevel: d.minStockLevel } });
    return tx.supplierProduct.update({
      where: { id },
      data: {
        categoryId: d.categoryId,
        name: d.name,
        brand: d.brand,
        description: d.description,
        unit: d.unit,
        price: d.price,
        registrationNumber: d.registrationNumber ?? null,
        safetyInfo: d.safetyInfo,
        isActive: d.isActive,
        verification,
      },
    });
  });
}

export async function listMyProducts(actor: Actor) {
  assertSupplier(actor);
  return prisma.supplierProduct.findMany({
    where: { supplierId: actor.id },
    orderBy: { createdAt: "desc" },
    include: { category: true, inventoryItem: true, _count: { select: { orderItems: true } } },
  });
}

/** Public catalogue for farmers. */
export async function browseProducts(filter: { q?: string; category?: string; supplier?: string } = {}) {
  return prisma.supplierProduct.findMany({
    where: {
      isActive: true,
      moderationStatus: { not: "REMOVED" },
      supplier: { status: "ACTIVE" },
      ...(filter.category ? { category: { slug: filter.category } } : {}),
      ...(filter.supplier ? { supplierId: filter.supplier } : {}),
      ...(filter.q
        ? {
            OR: [
              { name: { contains: filter.q, mode: "insensitive" } },
              { brand: { contains: filter.q, mode: "insensitive" } },
              { description: { contains: filter.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ category: { name: "asc" } }, { price: "asc" }],
    include: {
      category: true,
      inventoryItem: { select: { quantity: true } },
      supplier: { select: { id: true, verifiedAt: true, supplierProfile: { select: { businessName: true } }, profile: { select: { district: true, province: true } } } },
    },
    take: 200,
  });
}

export async function getProduct(id: string) {
  return prisma.supplierProduct.findUnique({
    where: { id },
    include: {
      category: true,
      inventoryItem: { select: { quantity: true } },
      supplier: { select: { id: true, verifiedAt: true, supplierProfile: true, profile: { select: { district: true, province: true } } } },
    },
  });
}

export async function listSuppliers() {
  return prisma.user.findMany({
    where: { role: "SUPPLIER", status: "ACTIVE", supplierProfile: { isNot: null } },
    select: {
      id: true,
      verifiedAt: true,
      supplierProfile: true,
      profile: { select: { district: true, province: true } },
      _count: { select: { supplierProducts: { where: { isActive: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function supplierSales(actor: Actor) {
  assertSupplier(actor);
  const orders = await prisma.purchaseOrder.findMany({ where: { sellerId: actor.id, type: "INPUT" }, include: { items: true }, orderBy: { createdAt: "asc" } });
  const completed = orders.filter((o) => o.status === "COMPLETED");
  const revenue = completed.reduce((a, o) => a.plus(o.total), new Prisma.Decimal(0));
  const monthly = new Map<string, number>();
  for (const o of completed) {
    const k = (o.completedAt ?? o.createdAt).toISOString().slice(0, 7);
    monthly.set(k, (monthly.get(k) ?? 0) + Number(o.total));
  }
  const byProduct = new Map<string, number>();
  for (const o of completed) for (const i of o.items) byProduct.set(i.description, (byProduct.get(i.description) ?? 0) + Number(i.lineTotal));
  const open = ["PENDING", "ACCEPTED", "CONFIRMED", "PROCESSING", "READY_FOR_PICKUP", "IN_TRANSIT", "DELIVERED"];
  return {
    orders: orders.length,
    pending: orders.filter((o) => open.includes(o.status)).length,
    completed: completed.length,
    revenue: revenue.toFixed(2),
    monthly: [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total })),
    byProduct: [...byProduct.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
  };
}
