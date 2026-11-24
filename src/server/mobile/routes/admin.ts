import "server-only";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { invalid } from "@/lib/errors";
import * as admin from "@/server/admin/service";
import * as analytics from "@/server/analytics/service";
import * as market from "@/server/marketplace/service";
import { Res, ADMIN_ROLES, type RouteDef } from "../http";

const ROLES: Role[] = ["FARMER", "BUYER", "SUPPLIER", "TRANSPORTER", "EXPERT", "DISTRIBUTOR", "ADMIN", "SUPER_ADMIN"];

export const adminRoutes: RouteDef[] = [
  {
    method: "GET",
    path: "/admin/overview",
    auth: ADMIN_ROLES,
    handler: async () => {
      const [stats, ai, concerns, lowStock, recent] = await Promise.all([
        analytics.platformStats(),
        analytics.aiUsageStats(30),
        analytics.topCropHealthConcerns(),
        analytics.lowStockSuppliers(),
        analytics.recentPlatformActivity(10),
      ]);
      return { stats, aiUsage: ai, cropHealthConcerns: concerns, lowStockSuppliers: lowStock, recentActivity: recent };
    },
  },
  { method: "GET", path: "/admin/analytics", auth: ADMIN_ROLES, handler: async () => ({ registrations: await analytics.registrationsByMonth(12), sales: await analytics.salesByMonth(12), crops: await analytics.cropDistribution(), provinces: await analytics.activityByProvince() }) },
  {
    method: "GET",
    path: "/admin/users",
    auth: ADMIN_ROLES,
    handler: async ({ actor, query }) => {
      const role = query.get("role") as Role | null;
      const status = query.get("status");
      return admin.listUsers(actor, {
        role: role && ROLES.includes(role) ? role : undefined,
        q: query.get("q") ?? undefined,
        page: Math.max(1, Number(query.get("page") ?? 1)),
        status: status === "ACTIVE" || status === "SUSPENDED" ? status : undefined,
      });
    },
  },
  {
    method: "POST",
    path: "/admin/users/:id/verify",
    auth: ADMIN_ROLES,
    handler: async ({ actor, params, json }) => {
      const { verified } = await json<{ verified?: boolean }>();
      return admin.setUserVerified(actor, params.id!, verified !== false);
    },
  },
  {
    method: "POST",
    path: "/admin/users/:id/status",
    auth: ADMIN_ROLES,
    handler: async ({ actor, params, json }) => {
      const { status, reason } = await json<{ status?: string; reason?: string }>();
      if (status !== "ACTIVE" && status !== "SUSPENDED") throw invalid("Status must be ACTIVE or SUSPENDED.");
      return admin.setUserStatus(actor, params.id!, status, reason);
    },
  },
  {
    method: "GET",
    path: "/admin/listings",
    auth: ADMIN_ROLES,
    handler: async ({ query }) => {
      const m = query.get("moderation");
      return prisma.produceListing.findMany({
        where: m === "FLAGGED" || m === "PENDING_REVIEW" || m === "APPROVED" || m === "REMOVED" ? { moderationStatus: m } : {},
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { crop: { select: { name: true } }, farmer: { select: { id: true, profile: { select: { fullName: true } } } } },
      });
    },
  },
  {
    method: "POST",
    path: "/admin/listings/:id/moderate",
    auth: ADMIN_ROLES,
    handler: async ({ actor, params, json }) => {
      const { decision, note } = await json<{ decision?: string; note?: string }>();
      if (decision !== "APPROVED" && decision !== "FLAGGED" && decision !== "REMOVED") throw invalid("Decision must be APPROVED, FLAGGED or REMOVED.");
      return market.moderateListing(actor, params.id!, decision, note);
    },
  },
  {
    method: "POST",
    path: "/admin/products/:id/moderate",
    auth: ADMIN_ROLES,
    handler: async ({ actor, params, json }) => {
      const { action } = await json<{ action?: string }>();
      if (!["VERIFY", "UNVERIFY", "REMOVE", "RESTORE"].includes(action ?? "")) throw invalid("Unknown action.");
      return admin.moderateProduct(actor, params.id!, action as "VERIFY");
    },
  },
  { method: "GET", path: "/admin/reports", auth: ADMIN_ROLES, handler: async ({ actor, query }) => admin.listContentReports(actor, (["OPEN", "RESOLVED", "DISMISSED"].includes(query.get("status") ?? "") ? query.get("status") : "OPEN") as "OPEN") },
  {
    method: "POST",
    path: "/admin/reports/:id/resolve",
    auth: ADMIN_ROLES,
    handler: async ({ actor, params, json }) => {
      const { status, resolution } = await json<{ status?: string; resolution?: string }>();
      if (status !== "RESOLVED" && status !== "DISMISSED") throw invalid("Status must be RESOLVED or DISMISSED.");
      return admin.resolveContentReport(actor, params.id!, status, resolution);
    },
  },
  { method: "POST", path: "/admin/market-prices", auth: ADMIN_ROLES, handler: async ({ actor, json }) => new Res(201, await market.addMarketPrice(actor, await json())) },
  {
    method: "POST",
    path: "/admin/crops",
    auth: ADMIN_ROLES,
    handler: async ({ actor, json }) => {
      const b = await json<{ id?: string; name?: string; category?: string; defaultUnit?: string; isActive?: boolean }>();
      return admin.upsertCrop(actor, { id: b.id, name: String(b.name ?? ""), category: String(b.category ?? ""), defaultUnit: String(b.defaultUnit ?? "KG"), isActive: b.isActive !== false });
    },
  },
  { method: "GET", path: "/admin/ai-usage", auth: ADMIN_ROLES, handler: async () => analytics.aiUsageStats(30) },
  {
    method: "GET",
    path: "/admin/transactions",
    auth: ADMIN_ROLES,
    handler: async () =>
      prisma.purchaseOrder.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, orderNumber: true, type: true, status: true, total: true, currency: true, createdAt: true, buyer: { select: { profile: { select: { fullName: true } } } }, seller: { select: { profile: { select: { fullName: true } } } } },
      }),
  },
];
