import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { provinceLabel } from "@/lib/zambia";

const HECTARES_PER_ACRE = new Prisma.Decimal("0.40468564224");

/** Platform-wide aggregate statistics. All values come from database queries — no hard-coded numbers. */
export async function platformStats() {
  const [roleCounts, farms, activeCrops, listings, activeListings, orderStatus, completedSales, deliveryStatus, pendingModeration, openReports, assessments] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: true, where: { status: "ACTIVE" } }),
    prisma.farm.findMany({ select: { size: true, sizeUnit: true, province: true } }),
    prisma.cropRecord.count({ where: { status: { in: ["PLANNED", "GROWING"] } } }),
    prisma.produceListing.count(),
    prisma.produceListing.count({ where: { status: "ACTIVE", moderationStatus: { not: "REMOVED" } } }),
    prisma.purchaseOrder.groupBy({ by: ["status"], _count: true }),
    prisma.purchaseOrder.aggregate({ where: { status: "COMPLETED" }, _sum: { total: true }, _count: true }),
    prisma.delivery.groupBy({ by: ["status"], _count: true }),
    prisma.produceListing.count({ where: { moderationStatus: "PENDING_REVIEW" } }),
    prisma.contentReport.count({ where: { status: "OPEN" } }),
    prisma.cropHealthAssessment.count(),
  ]);
  const count = (r: string) => roleCounts.find((x) => x.role === r)?._count ?? 0;
  const hectares = farms.reduce((a, f) => a.plus(f.sizeUnit === "ACRES" ? f.size.times(HECTARES_PER_ACRE) : f.size), new Prisma.Decimal(0));
  const ordersBy = Object.fromEntries(orderStatus.map((o) => [o.status, o._count]));
  const active = ["PENDING", "NEGOTIATING", "ACCEPTED", "CONFIRMED", "PROCESSING", "READY_FOR_PICKUP", "IN_TRANSIT", "DELIVERED", "DISPUTED"].reduce((a, s) => a + (ordersBy[s] ?? 0), 0);
  return {
    farmers: count("FARMER"),
    buyers: count("BUYER"),
    suppliers: count("SUPPLIER"),
    transporters: count("TRANSPORTER"),
    admins: count("ADMIN") + count("SUPER_ADMIN"),
    farms: farms.length,
    registeredHectares: hectares.toDecimalPlaces(1).toNumber(),
    activeCropRecords: activeCrops,
    totalListings: listings,
    activeListings,
    activeOrders: active,
    completedOrders: ordersBy.COMPLETED ?? 0,
    pendingOrders: (ordersBy.PENDING ?? 0) + (ordersBy.NEGOTIATING ?? 0),
    disputedOrders: ordersBy.DISPUTED ?? 0,
    completedSalesValue: (completedSales._sum.total ?? new Prisma.Decimal(0)).toFixed(2),
    ordersByStatus: orderStatus.map((o) => ({ status: o.status, count: o._count })),
    deliveriesByStatus: deliveryStatus.map((d) => ({ status: d.status, count: d._count })),
    listingsPendingReview: pendingModeration,
    openContentReports: openReports,
    cropHealthAssessments: assessments,
    currency: "ZMW",
  };
}

export async function registrationsByMonth(months = 12) {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - months + 1, 1);
  since.setUTCHours(0, 0, 0, 0);
  const rows = await prisma.$queryRaw<{ month: string; role: string; count: bigint }[]>`
    SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month, "role"::text AS role, COUNT(*)::bigint AS count
    FROM "User" WHERE "createdAt" >= ${since} GROUP BY 1, 2 ORDER BY 1`;
  const map = new Map<string, Record<string, number>>();
  for (let i = 0; i < months; i++) {
    const d = new Date(since);
    d.setUTCMonth(since.getUTCMonth() + i);
    map.set(d.toISOString().slice(0, 7), { FARMER: 0, BUYER: 0, SUPPLIER: 0, TRANSPORTER: 0 });
  }
  for (const r of rows) {
    const m = map.get(r.month);
    if (m && r.role in m) m[r.role] = Number(r.count);
  }
  return [...map.entries()].map(([month, v]) => ({ month, ...v }));
}

export async function cropDistribution() {
  const rows = await prisma.cropRecord.groupBy({ by: ["cropId"], _count: true, where: { status: { in: ["PLANNED", "GROWING", "HARVESTED"] } } });
  const crops = await prisma.crop.findMany({ where: { id: { in: rows.map((r) => r.cropId) } } });
  return rows.map((r) => ({ crop: crops.find((c) => c.id === r.cropId)?.name ?? "Unknown", records: r._count })).sort((a, b) => b.records - a.records);
}

export async function produceAvailability() {
  const rows = await prisma.produceListing.groupBy({
    by: ["cropId", "unit"],
    where: { status: "ACTIVE", moderationStatus: { not: "REMOVED" } },
    _sum: { quantityAvailable: true },
    _count: true,
  });
  const crops = await prisma.crop.findMany({ where: { id: { in: rows.map((r) => r.cropId) } } });
  return rows
    .map((r) => ({ crop: crops.find((c) => c.id === r.cropId)?.name ?? "Unknown", unit: r.unit, quantity: Number(r._sum.quantityAvailable ?? 0), listings: r._count }))
    .sort((a, b) => b.listings - a.listings);
}

export async function salesByMonth(months = 12) {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - months + 1, 1);
  const rows = await prisma.$queryRaw<{ month: string; total: Prisma.Decimal; count: bigint }[]>`
    SELECT to_char(date_trunc('month', COALESCE("completedAt", "createdAt")), 'YYYY-MM') AS month, SUM("total") AS total, COUNT(*)::bigint AS count
    FROM "PurchaseOrder" WHERE "status" = 'COMPLETED' AND COALESCE("completedAt", "createdAt") >= ${since} GROUP BY 1 ORDER BY 1`;
  return rows.map((r) => ({ month: r.month, total: Number(r.total ?? 0), orders: Number(r.count) }));
}

export async function activityByProvince() {
  const [farms, listings, users] = await Promise.all([
    prisma.farm.groupBy({ by: ["province"], _count: true }),
    prisma.produceListing.groupBy({ by: ["province"], _count: true, where: { status: "ACTIVE" } }),
    prisma.userProfile.groupBy({ by: ["province"], _count: true, where: { user: { role: "FARMER" } } }),
  ]);
  const provinces = ["LUSAKA", "COPPERBELT", "SOUTHERN", "CENTRAL", "EASTERN", "NORTHERN", "LUAPULA", "MUCHINGA", "WESTERN", "NORTH_WESTERN"] as const;
  return provinces.map((p) => ({
    province: provinceLabel(p),
    farmers: users.find((u) => u.province === p)?._count ?? 0,
    farms: farms.find((f) => f.province === p)?._count ?? 0,
    listings: listings.find((l) => l.province === p)?._count ?? 0,
  }));
}

export async function recentPlatformActivity(take = 12) {
  return prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take, include: { actor: { select: { role: true, profile: { select: { fullName: true } } } } } });
}

export async function topCropHealthConcerns() {
  const rows = await prisma.cropHealthAssessment.groupBy({ by: ["possibleIssue"], _count: true, where: { possibleIssue: { not: null } }, orderBy: { _count: { possibleIssue: "desc" } }, take: 8 });
  return rows.map((r) => ({ issue: r.possibleIssue!, count: r._count }));
}

export async function lowStockSuppliers() {
  const rows = await prisma.$queryRaw<{ business: string | null; item: string; quantity: Prisma.Decimal; min: Prisma.Decimal }[]>`
    SELECT sp."businessName" AS business, ii."name" AS item, ii."quantity" AS quantity, ii."minStockLevel" AS min
    FROM "InventoryItem" ii JOIN "User" u ON u."id" = ii."ownerId" LEFT JOIN "SupplierProfile" sp ON sp."userId" = u."id"
    WHERE u."role" = 'SUPPLIER' AND ii."minStockLevel" > 0 AND ii."quantity" <= ii."minStockLevel" ORDER BY ii."quantity" ASC LIMIT 20`;
  return rows.map((r) => ({ supplier: r.business ?? "Supplier", item: r.item, quantity: Number(r.quantity), minimum: Number(r.min) }));
}

export async function aiUsageStats(days = 30) {
  const since = new Date(Date.now() - days * 86400_000);
  const [byFeature, byStatus, tokens] = await Promise.all([
    prisma.aIUsage.groupBy({ by: ["feature"], _count: true, where: { createdAt: { gte: since } } }),
    prisma.aIUsage.groupBy({ by: ["status"], _count: true, where: { createdAt: { gte: since } } }),
    prisma.aIUsage.aggregate({ where: { createdAt: { gte: since } }, _sum: { inputTokens: true, outputTokens: true }, _avg: { latencyMs: true } }),
  ]);
  return {
    byFeature: byFeature.map((f) => ({ feature: f.feature, count: f._count })),
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    inputTokens: tokens._sum.inputTokens ?? 0,
    outputTokens: tokens._sum.outputTokens ?? 0,
    avgLatencyMs: Math.round(tokens._avg.latencyMs ?? 0),
  };
}

/** Compact, PII-free aggregate snapshot handed to Grok for admin business intelligence. */
export async function adminAIContext() {
  const since30 = new Date(Date.now() - 30 * 86400_000);
  const since7 = new Date(Date.now() - 7 * 86400_000);
  const [stats, crops, availability, provinces, sales, concerns, lowStock, newUsers30, newListings7, orders30, marketPrices] = await Promise.all([
    platformStats(),
    cropDistribution(),
    produceAvailability(),
    activityByProvince(),
    salesByMonth(6),
    topCropHealthConcerns(),
    lowStockSuppliers(),
    prisma.user.groupBy({ by: ["role"], _count: true, where: { createdAt: { gte: since30 } } }),
    prisma.produceListing.count({ where: { createdAt: { gte: since7 } } }),
    prisma.purchaseOrder.aggregate({ where: { createdAt: { gte: since30 } }, _count: true, _sum: { total: true } }),
    prisma.marketPrice.count(),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    totals: stats,
    last30Days: {
      newRegistrationsByRole: newUsers30.map((r) => ({ role: r.role, count: r._count })),
      ordersCreated: orders30._count,
      orderValueCreatedZMW: (orders30._sum.total ?? new Prisma.Decimal(0)).toFixed(2),
    },
    last7Days: { newListings: newListings7 },
    cropDistribution: crops,
    produceAvailability: availability,
    activityByProvince: provinces,
    completedSalesByMonth: sales,
    topCropHealthConcerns: concerns,
    suppliersLowStock: lowStock,
    marketPriceRecords: marketPrices,
  };
}
