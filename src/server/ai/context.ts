import "server-only";
import { prisma } from "@/lib/db";
import { provinceLabel } from "@/lib/zambia";
import { financialSummary } from "@/server/finance/service";
import { weatherFlags } from "@/server/weather/provider";
import type { WeatherBundle } from "@/server/weather/provider";

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

/**
 * Build the farmer's context for Grok strictly from records owned by `userId`.
 * Every query is filtered by owner id; no other user's data can enter the prompt.
 * Weather comes only from cached provider readings (never invented).
 */
export async function buildFarmerContext(userId: string) {
  const [user, farms, crops, activities, finance, lowStock, openOrders, tasks] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { profile: { select: { fullName: true, province: true, district: true } }, farmerProfile: true } }),
    prisma.farm.findMany({ where: { ownerId: userId }, include: { fields: { select: { name: true, area: true, areaUnit: true, irrigation: true, soilType: true, status: true } } }, take: 10 }),
    prisma.cropRecord.findMany({
      where: { farm: { ownerId: userId } },
      orderBy: { plantingDate: "desc" },
      take: 15,
      include: { crop: true, farm: { select: { name: true } }, field: { select: { name: true } } },
    }),
    prisma.farmActivity.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 15, include: { cropRecord: { include: { crop: true } } } }),
    financialSummary(userId),
    prisma.$queryRaw<{ name: string; quantity: string; unit: string }[]>`SELECT "name", "quantity"::text, "unit" FROM "InventoryItem" WHERE "ownerId" = ${userId} AND "minStockLevel" > 0 AND "quantity" <= "minStockLevel" LIMIT 10`,
    prisma.purchaseOrder.count({ where: { sellerId: userId, status: { notIn: ["COMPLETED", "CANCELLED", "REJECTED"] } } }),
    prisma.farmTask.findMany({ where: { userId, status: "PENDING" }, orderBy: { dueDate: "asc" }, take: 8 }),
  ]);

  // Latest cached weather per farm (only real provider readings, at most 12h old)
  const weather: Array<{ farm: string; source: string; fetchedAt: string; current: unknown; next7days: unknown; flags: string[] }> = [];
  for (const f of farms.slice(0, 3)) {
    const obs = await prisma.weatherObservation.findFirst({ where: { farmId: f.id, isDemo: false, fetchedAt: { gte: new Date(Date.now() - 12 * 3600_000) } }, orderBy: { fetchedAt: "desc" } });
    if (!obs) continue;
    const fc = await prisma.weatherForecast.findMany({ where: { farmId: f.id, fetchedAt: obs.fetchedAt }, orderBy: { forecastDate: "asc" } });
    const bundle: WeatherBundle = {
      source: obs.source,
      currentKind: "modelled",
      current: { observedAt: obs.observedAt, temperatureC: num(obs.temperatureC), humidityPct: num(obs.humidityPct), precipitationMm: num(obs.precipitationMm), windSpeedKmh: num(obs.windSpeedKmh), weatherCode: obs.weatherCode, conditions: obs.conditions },
      daily: fc.map((x) => ({ date: iso(x.forecastDate)!, tempMaxC: num(x.tempMaxC), tempMinC: num(x.tempMinC), precipitationMm: num(x.precipitationMm), precipitationProbPct: x.precipitationProbPct, windMaxKmh: num(x.windMaxKmh), weatherCode: x.weatherCode, conditions: x.conditions })),
    };
    weather.push({
      farm: f.name,
      source: obs.source,
      fetchedAt: obs.fetchedAt.toISOString(),
      current: { ...bundle.current, kind: "model analysis (not a station observation)" },
      next7days: bundle.daily.map((d) => ({ date: d.date, maxC: d.tempMaxC, minC: d.tempMinC, rainMm: d.precipitationMm, rainChancePct: d.precipitationProbPct, conditions: d.conditions })),
      flags: weatherFlags(bundle).flags,
    });
  }

  return {
    today: iso(new Date()),
    farmer: {
      name: user?.profile?.fullName?.split(" ")[0] ?? "Farmer",
      province: provinceLabel(user?.profile?.province),
      district: user?.profile?.district ?? null,
      experienceYears: user?.farmerProfile?.experienceYears ?? null,
      farmingType: user?.farmerProfile?.farmingType ?? null,
      mainCrops: user?.farmerProfile?.mainCrops ?? [],
    },
    farms: farms.map((f) => ({
      name: f.name,
      province: provinceLabel(f.province),
      district: f.district,
      size: `${f.size.toString()} ${f.sizeUnit.toLowerCase()}`,
      farmingType: f.farmingType,
      fields: f.fields.map((x) => ({ name: x.name, area: `${x.area.toString()} ${x.areaUnit.toLowerCase()}`, irrigation: x.irrigation, soil: x.soilType, status: x.status })),
    })),
    crops: crops.map((c) => ({
      crop: c.crop.name,
      variety: c.variety,
      farm: c.farm.name,
      field: c.field?.name ?? null,
      plantingDate: iso(c.plantingDate),
      expectedHarvest: iso(c.expectedHarvestDate),
      growthStage: c.growthStage,
      status: c.status,
      area: c.areaPlanted?.toString() ?? null,
      estimatedYield: c.estimatedYield ? `${c.estimatedYield.toString()} ${c.yieldUnit}` : null,
      actualHarvest: c.actualHarvest ? `${c.actualHarvest.toString()} ${c.yieldUnit}` : null,
    })),
    recentActivities: activities.map((a) => ({ date: iso(a.date), type: a.type, crop: a.cropRecord?.crop.name ?? null, quantity: a.quantity ? `${a.quantity.toString()} ${a.unit ?? ""}`.trim() : null, costZMW: a.cost?.toFixed(2) ?? null, notes: a.notes?.slice(0, 160) ?? null })),
    finances_actual_recorded_ZMW: {
      totalIncome: finance.totalIncome,
      totalExpenses: finance.totalExpenses,
      grossProfit: finance.grossProfit,
      netProfit: finance.netProfit,
      byCategory: finance.byCategory,
      profitByCrop: finance.profitByCrop,
      monthly: finance.monthly.slice(-6),
      transactionCount: finance.transactionCount,
      definitions: "grossProfit = produce sales minus direct crop inputs (seeds, fertilizer, chemicals, irrigation); netProfit = all income minus all expenses",
    },
    finances_estimates_ZMW: finance.estimates,
    weather: weather.length ? weather : "No recent weather reading is cached. Tell the farmer to open the Weather page for the latest forecast.",
    lowStockInventory: lowStock,
    openMarketplaceOrders: openOrders,
    upcomingTasks: tasks.map((t) => ({ title: t.title, due: iso(t.dueDate) })),
  };
}

function num(v: { toString(): string } | null) {
  return v === null ? null : Number(v.toString());
}

export type FarmerContext = Awaited<ReturnType<typeof buildFarmerContext>>;
