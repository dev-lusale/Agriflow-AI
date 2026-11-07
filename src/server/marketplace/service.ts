import "server-only";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/action";
import { forbidden, invalid, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { isValidDistrict } from "@/lib/zambia";
import { listingFilterSchema, listingSchema, marketPriceSchema } from "@/lib/validation/schemas";
import { getSetting } from "@/server/admin/settings";

export const PAGE_SIZE = 12;

async function visibleModeration(): Promise<Prisma.ProduceListingWhereInput> {
  const requireApproval = await getSetting<boolean>("marketplace.requireApproval", false);
  return requireApproval ? { moderationStatus: "APPROVED" } : { moderationStatus: { in: ["APPROVED", "PENDING_REVIEW"] } };
}

/** Public marketplace search. Only active, non-removed listings with stock are returned. */
export async function searchListings(raw: Record<string, unknown>) {
  const f = listingFilterSchema.parse(raw);
  const where: Prisma.ProduceListingWhereInput = {
    status: "ACTIVE",
    quantityAvailable: { gt: 0 },
    ...(await visibleModeration()),
    ...(f.crop ? { crop: { name: { equals: f.crop, mode: "insensitive" } } } : {}),
    ...(f.province ? { province: f.province } : {}),
    ...(f.district ? { district: { equals: f.district, mode: "insensitive" } } : {}),
    ...(f.minPrice !== undefined || f.maxPrice !== undefined ? { pricePerUnit: { gte: f.minPrice, lte: f.maxPrice } } : {}),
    ...(f.minQty !== undefined ? { quantityAvailable: { gte: f.minQty } } : {}),
    ...(f.q
      ? {
          OR: [
            { title: { contains: f.q, mode: "insensitive" } },
            { variety: { contains: f.q, mode: "insensitive" } },
            { description: { contains: f.q, mode: "insensitive" } },
            { crop: { name: { contains: f.q, mode: "insensitive" } } },
            { district: { contains: f.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const orderBy: Prisma.ProduceListingOrderByWithRelationInput =
    f.sort === "price_asc" ? { pricePerUnit: "asc" } : f.sort === "price_desc" ? { pricePerUnit: "desc" } : f.sort === "qty_desc" ? { quantityAvailable: "desc" } : { createdAt: "desc" };
  const [total, items] = await Promise.all([
    prisma.produceListing.count({ where }),
    prisma.produceListing.findMany({
      where,
      orderBy,
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: listingCardInclude,
    }),
  ]);
  return { total, items, page: f.page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), filters: f };
}

export const listingCardInclude = {
  crop: true,
  images: { orderBy: { position: "asc" as const }, take: 1 },
  farmer: { select: { id: true, verifiedAt: true, profile: { select: { fullName: true } } } },
} satisfies Prisma.ProduceListingInclude;

export async function getPublicListing(id: string) {
  const listing = await prisma.produceListing.findUnique({
    where: { id },
    include: {
      crop: true,
      images: { orderBy: { position: "asc" } },
      farm: { select: { name: true, district: true, province: true } },
      farmer: {
        select: {
          id: true,
          verifiedAt: true,
          createdAt: true,
          profile: { select: { fullName: true, district: true, province: true } },
          _count: { select: { ordersAsSeller: { where: { status: "COMPLETED" } } } },
        },
      },
    },
  });
  if (!listing || listing.moderationStatus === "REMOVED" || listing.status === "DRAFT") return null;
  return listing;
}

export async function listMyListings(actor: Actor) {
  return prisma.produceListing.findMany({
    where: { farmerId: actor.id },
    orderBy: { createdAt: "desc" },
    include: { crop: true, images: { take: 1 }, _count: { select: { orderItems: true } } },
  });
}

export async function createListing(actor: Actor, input: z.input<typeof listingSchema>, imageIds: string[] = []) {
  if (actor.role !== "FARMER") throw forbidden("Only farmers can list produce.");
  const d = listingSchema.parse(input);
  if (!isValidDistrict(d.province, d.district)) throw invalid("Choose a district in the selected province.", { district: ["Invalid district"] });
  if (d.farmId) {
    const farm = await prisma.farm.findUnique({ where: { id: d.farmId } });
    if (!farm || farm.ownerId !== actor.id) throw forbidden("Farm not found in your account.");
  }
  const crop = await prisma.crop.findUnique({ where: { id: d.cropId } });
  if (!crop?.isActive) throw invalid("Choose a valid crop.");
  const images = imageIds.length ? await prisma.upload.findMany({ where: { id: { in: imageIds }, ownerId: actor.id, kind: "LISTING_PHOTO" } }) : [];
  const { quantity, ...rest } = d;
  const listing = await prisma.produceListing.create({
    data: {
      ...rest,
      farmerId: actor.id,
      quantityAvailable: quantity,
      totalQuantity: quantity,
      images: { create: images.map((img, i) => ({ uploadId: img.id, position: i })) },
    },
  });
  await audit({ actorId: actor.id, action: "listing.create", entityType: "ProduceListing", entityId: listing.id });
  return listing;
}

export async function updateListing(actor: Actor, id: string, input: z.input<typeof listingSchema>) {
  const existing = await prisma.produceListing.findUnique({ where: { id } });
  if (!existing || existing.farmerId !== actor.id) throw notFound("Listing not found.");
  if (existing.moderationStatus === "REMOVED") throw forbidden("This listing was removed by a moderator.");
  const d = listingSchema.parse(input);
  if (!isValidDistrict(d.province, d.district)) throw invalid("Choose a district in the selected province.");
  const { quantity, ...rest } = d;
  // Quantity edits adjust remaining stock; committed stock is preserved.
  const committed = existing.totalQuantity.minus(existing.quantityAvailable);
  if (committed.greaterThan(quantity)) throw invalid(`Total quantity cannot be below the ${committed.toString()} already sold or reserved.`);
  const available = existing.quantityAvailable.plus(quantity).minus(existing.totalQuantity);
  return prisma.produceListing.update({
    where: { id },
    data: {
      ...rest,
      totalQuantity: quantity,
      quantityAvailable: available,
      status: available.lte(0) ? "SOLD_OUT" : rest.status,
    },
  });
}

export async function setListingStatus(actor: Actor, id: string, status: "ACTIVE" | "INACTIVE") {
  const existing = await prisma.produceListing.findUnique({ where: { id } });
  if (!existing || existing.farmerId !== actor.id) throw notFound("Listing not found.");
  if (status === "ACTIVE" && existing.quantityAvailable.lte(0)) throw invalid("Add stock before reactivating this listing.");
  return prisma.produceListing.update({ where: { id }, data: { status } });
}

// ───────── moderation (admin) ─────────

export async function moderateListing(actor: Actor, id: string, decision: "APPROVED" | "FLAGGED" | "REMOVED", note?: string) {
  if (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") throw forbidden();
  const listing = await prisma.produceListing.update({ where: { id }, data: { moderationStatus: decision, moderationNote: note ?? null } });
  await audit({ actorId: actor.id, action: `listing.moderate.${decision.toLowerCase()}`, entityType: "ProduceListing", entityId: id, metadata: { note: note ?? null } });
  if (decision !== "APPROVED") {
    const { notify } = await import("@/server/notifications/service");
    await notify(listing.farmerId, {
      type: "MODERATION",
      title: decision === "REMOVED" ? "Listing removed" : "Listing flagged for review",
      body: `Your listing "${listing.title}" was ${decision.toLowerCase()} by a moderator.${note ? " Reason: " + note : ""}`,
      link: "/farmer/listings",
    });
  }
  return listing;
}

export async function reportContent(actor: Actor, entityType: "LISTING" | "PRODUCT" | "USER" | "MESSAGE", entityId: string, reason: string) {
  if (reason.trim().length < 5) throw invalid("Please describe the problem.");
  return prisma.contentReport.create({ data: { reporterId: actor.id, entityType, entityId, reason: reason.slice(0, 1000) } });
}

// ───────── market prices ─────────

export async function marketPriceSeries(cropId: string, province?: string) {
  return prisma.marketPrice.findMany({
    where: { cropId, ...(province ? { province: province as never } : {}) },
    orderBy: { observedOn: "asc" },
    include: { crop: true },
    take: 500,
  });
}

export async function latestMarketPrices() {
  const rows = await prisma.marketPrice.findMany({ orderBy: { observedOn: "desc" }, include: { crop: true }, take: 400 });
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const k = `${r.cropId}:${r.province}:${r.unit}`;
    if (!latest.has(k)) latest.set(k, r);
  }
  return [...latest.values()];
}

/** Aggregated asking prices from live listings — labelled as user-submitted offers, not market prices. */
export async function listingPriceStats() {
  const rows = await prisma.produceListing.groupBy({
    by: ["cropId", "unit"],
    where: { status: "ACTIVE", moderationStatus: { not: "REMOVED" } },
    _avg: { pricePerUnit: true },
    _min: { pricePerUnit: true },
    _max: { pricePerUnit: true },
    _count: true,
    _sum: { quantityAvailable: true },
  });
  const crops = await prisma.crop.findMany({ where: { id: { in: rows.map((r) => r.cropId) } } });
  return rows.map((r) => ({ ...r, crop: crops.find((c) => c.id === r.cropId)! }));
}

export async function addMarketPrice(actor: Actor, input: z.input<typeof marketPriceSchema>) {
  if (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") throw forbidden();
  const d = marketPriceSchema.parse(input);
  const row = await prisma.marketPrice.create({ data: { ...d, verifiedById: d.sourceType === "VERIFIED_OBSERVATION" ? actor.id : null } });
  await audit({ actorId: actor.id, action: "market_price.create", entityType: "MarketPrice", entityId: row.id, metadata: { sourceType: d.sourceType } });
  return row;
}
