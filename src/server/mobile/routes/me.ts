import "server-only";
import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { invalid } from "@/lib/errors";
import { districtCentre, isValidDistrict } from "@/lib/zambia";
import { profileUpdateSchema } from "@/lib/validation/schemas";
import { completeOnboarding, normalisePhone } from "@/server/auth/service";
import { saveImage } from "@/server/storage/service";
import { farmerOverview } from "@/server/farms/service";
import { latestMarketPrices } from "@/server/marketplace/service";
import { listTransactions } from "@/server/finance/service";
import { getPreferences, listNotifications, markAllRead, markRead, setPreference, unreadCount } from "@/server/notifications/service";
import { weatherAt, weatherForFarm } from "@/server/weather/service";
import { weatherFlags } from "@/server/weather/provider";
import type { RouteDef } from "../http";

export async function loadMe(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      verifiedAt: true,
      onboardingCompletedAt: true,
      createdAt: true,
      profile: { select: { fullName: true, province: true, district: true, bio: true, avatarId: true } },
      farmerProfile: { select: { farmingType: true, experienceYears: true, mainCrops: true } },
      buyerProfile: { select: { businessName: true, buyerType: true, preferredCrops: true } },
      supplierProfile: { select: { businessName: true, categories: true } },
      transporterProfile: { select: { businessName: true, serviceProvinces: true, isAvailable: true } },
      expertProfile: { select: { organisation: true, qualification: true, specialisations: true } },
    },
  });
  return {
    ...u,
    avatarUrl: u.profile?.avatarId ? `/api/v1/uploads/${u.profile.avatarId}` : null,
    emailVerified: Boolean(u.emailVerifiedAt),
    onboardingCompleted: Boolean(u.onboardingCompletedAt) || u.role === "ADMIN" || u.role === "SUPER_ADMIN",
  };
}

async function weatherSummary(actor: { id: string; role: import("@prisma/client").Role }, farmId: string | null, province: string | null, district: string | null) {
  try {
    if (farmId) {
      const w = await weatherForFarm(actor, farmId);
      return w.ok ? { ...w, flags: weatherFlags(w.data) } : w;
    }
    if (province && district) {
      const c = districtCentre(province as never, district);
      if (c) {
        const w = await weatherAt({ lat: c.lat, lng: c.lng, basis: "district_centre", label: `${district} town area (approximate)` });
        return w.ok ? { ...w, flags: weatherFlags(w.data) } : w;
      }
    }
    return { ok: false, reason: "NO_LOCATION", message: "Add a farm with GPS coordinates, or set your district, to see weather." };
  } catch {
    return { ok: false, reason: "PROVIDER_ERROR", message: "Weather is temporarily unavailable." };
  }
}

const NOTIFICATION_TYPES: NotificationType[] = [
  "BUYER_INQUIRY", "PURCHASE_REQUEST", "ORDER_ACCEPTED", "ORDER_REJECTED", "ORDER_UPDATE", "NEGOTIATION_OFFER", "NEW_MESSAGE",
  "DELIVERY_UPDATE", "DELIVERY_REQUEST", "LOW_INVENTORY", "WEATHER_ALERT", "TASK_REMINDER", "HARVEST_REMINDER", "AI_REPORT", "ACCOUNT", "MODERATION",
];

export const meRoutes: RouteDef[] = [
  { method: "GET", path: "/me", auth: true, handler: async ({ user }) => loadMe(user.id) },
  {
    method: "PATCH",
    path: "/me",
    auth: true,
    handler: async ({ user, json }) => {
      const d = profileUpdateSchema.parse(await json());
      const current = await prisma.userProfile.findUnique({ where: { userId: user.id } });
      const province = d.province ?? current?.province ?? undefined;
      const district = d.district ?? current?.district ?? undefined;
      if (province && district && !isValidDistrict(province, district)) throw invalid("Choose a district in the selected province.", { district: ["Invalid district for province"] });
      if (d.phone) {
        const phone = normalisePhone(d.phone);
        const taken = await prisma.user.findFirst({ where: { phone, NOT: { id: user.id } }, select: { id: true } });
        if (taken) throw invalid("This phone number is already registered to another account.", { phone: ["Phone already registered"] });
        await prisma.user.update({ where: { id: user.id }, data: { phone, phoneVerifiedAt: null } });
      }
      await prisma.userProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, fullName: d.fullName ?? "", province, district },
        update: { fullName: d.fullName, province, district },
      });
      return loadMe(user.id);
    },
  },
  {
    method: "POST",
    path: "/me/onboarding",
    auth: true,
    handler: async ({ user, json }) => {
      await completeOnboarding(user.id, user.role, await json());
      return loadMe(user.id);
    },
  },
  {
    method: "POST",
    path: "/me/avatar",
    auth: true,
    handler: async ({ actor, form }) => {
      const file = (await form()).get("image");
      if (!(file instanceof File) || file.size === 0) throw invalid("Choose a photo.", { image: ["Required"] });
      const up = await saveImage(actor, file, "AVATAR");
      await prisma.userProfile.update({ where: { userId: actor.id }, data: { avatarId: up.id } });
      return loadMe(actor.id);
    },
  },
  {
    method: "POST",
    path: "/me/push-token",
    auth: true,
    handler: async ({ user, json }) => {
      const { token, platform } = await json<{ token?: string; platform?: string }>();
      if (!token || token.length < 20 || token.length > 4096) throw invalid("Invalid push token.");
      await prisma.pushDevice.upsert({
        where: { token },
        create: { userId: user.id, token, platform: platform === "ios" ? "ios" : "android" },
        update: { userId: user.id, platform: platform === "ios" ? "ios" : "android" },
      });
      return { ok: true };
    },
  },
  {
    method: "DELETE",
    path: "/me/push-token",
    auth: true,
    handler: async ({ user, json }) => {
      const { token } = await json<{ token?: string }>();
      if (token) await prisma.pushDevice.deleteMany({ where: { token, userId: user.id } });
      return { ok: true };
    },
  },
  {
    method: "GET",
    path: "/dashboard",
    auth: true,
    handler: async ({ user, actor }) => {
      const profile = await prisma.userProfile.findUnique({ where: { userId: user.id }, select: { fullName: true, province: true, district: true, avatarId: true } });
      const [unread, notifications, prices] = await Promise.all([
        unreadCount(user.id),
        listNotifications(user.id, { take: 5 }),
        latestMarketPrices().then((rows) => rows.slice(0, 6)),
      ]);
      const base = {
        greetingName: profile?.fullName?.split(" ")[0] ?? "",
        role: user.role,
        location: profile?.province && profile?.district ? { province: profile.province, district: profile.district } : null,
        avatarUrl: profile?.avatarId ? `/api/v1/uploads/${profile.avatarId}` : null,
        unreadNotifications: unread,
        notifications,
        marketPrices: prices.map((p) => ({ id: p.id, crop: p.crop.name, province: p.province, market: p.marketName, unit: p.unit, priceZmw: p.price, observedOn: p.observedOn, sourceType: p.sourceType, sourceName: p.sourceName })),
      };
      if (user.role !== "FARMER") {
        const weather = await weatherSummary(actor, null, profile?.province ?? null, profile?.district ?? null);
        return { ...base, weather, farm: null };
      }
      const [o, txns] = await Promise.all([farmerOverview(actor), listTransactions(actor, { take: 5 })]);
      const totalHa = o.farms.reduce((sum, f) => sum + Number(f.size) * (f.sizeUnit === "ACRES" ? 0.404686 : 1), 0);
      const weather = await weatherSummary(actor, o.farms[0]?.id ?? null, profile?.province ?? null, profile?.district ?? null);
      return {
        ...base,
        weather,
        farm: {
          farms: o.farms,
          farmCount: o.farms.length,
          totalHectares: Math.round(totalHa * 100) / 100,
          activeCrops: o.activeCrops.map((c) => ({ id: c.id, crop: c.crop.name, farm: c.farm.name, field: c.field?.name ?? null, status: c.status, plantingDate: c.plantingDate, expectedHarvestDate: c.expectedHarvestDate, areaPlanted: c.areaPlanted })),
          upcomingTasks: o.tasks,
          recentActivities: o.recentActivities,
          openOrders: o.openOrders,
          lowStock: o.lowStock,
          activeListings: o.listings,
        },
        recentTransactions: txns,
      };
    },
  },
  {
    method: "GET",
    path: "/weather",
    auth: true,
    handler: async ({ actor, query }) => {
      const farmId = query.get("farmId");
      if (farmId) {
        const w = await weatherForFarm(actor, farmId);
        return w.ok ? { ...w, flags: weatherFlags(w.data) } : w;
      }
      const lat = Number(query.get("lat"));
      const lng = Number(query.get("lng"));
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && query.get("lat") && query.get("lng")) {
        const w = await weatherAt({ lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100, basis: "farm_gps", label: "Your current location" });
        return w.ok ? { ...w, flags: weatherFlags(w.data) } : w;
      }
      const province = query.get("province");
      const district = query.get("district");
      return weatherSummary(actor, null, province, district);
    },
  },
  { method: "GET", path: "/notifications", auth: true, handler: async ({ user, query }) => ({ items: await listNotifications(user.id, { unreadOnly: query.get("unread") === "1", take: Math.min(Number(query.get("take") ?? 50), 100) }), unread: await unreadCount(user.id) }) },
  { method: "POST", path: "/notifications/read-all", auth: true, handler: async ({ user }) => (await markAllRead(user.id), { ok: true }) },
  { method: "POST", path: "/notifications/:id/read", auth: true, handler: async ({ user, params }) => (await markRead(user.id, params.id!), { ok: true }) },
  {
    method: "GET",
    path: "/notification-preferences",
    auth: true,
    handler: async ({ user }) => {
      const prefs = await getPreferences(user.id);
      return { types: NOTIFICATION_TYPES, preferences: prefs };
    },
  },
  {
    method: "PUT",
    path: "/notification-preferences/:type",
    auth: true,
    handler: async ({ user, params, json }) => {
      const type = params.type as NotificationType;
      if (!NOTIFICATION_TYPES.includes(type)) throw invalid("Unknown notification type.");
      const b = await json<{ inApp?: boolean; email?: boolean; sms?: boolean; whatsapp?: boolean }>();
      await setPreference(user.id, type, { inApp: b.inApp !== false, email: Boolean(b.email), sms: Boolean(b.sms), whatsapp: Boolean(b.whatsapp) });
      return { ok: true };
    },
  },
];
