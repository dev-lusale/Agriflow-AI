import "server-only";
import { prisma } from "@/lib/db";
import { invalid, notFound } from "@/lib/errors";
import { aiChatSchema } from "@/lib/validation/schemas";
import * as farms from "@/server/farms/service";
import { cropCatalog } from "@/server/farms/options";
import * as ai from "@/server/ai/service";
import * as experts from "@/server/experts/service";
import { saveImage } from "@/server/storage/service";
import { applySyncBatch } from "@/server/sync/service";
import { isAIConfigured } from "@/lib/env";
import type { RouteDef } from "../http";

const F = ["FARMER"] as const;

export const farmRoutes: RouteDef[] = [
  { method: "GET", path: "/crops", auth: true, handler: async () => cropCatalog() },
  { method: "GET", path: "/farms", auth: [...F], handler: async ({ actor }) => farms.listFarms(actor) },
  { method: "POST", path: "/farms", auth: [...F], handler: async ({ actor, json }) => farms.createFarm(actor, await json()) },
  { method: "GET", path: "/farms/:id", auth: [...F], handler: async ({ actor, params }) => farms.getFarmDetail(actor, params.id!) },
  { method: "PATCH", path: "/farms/:id", auth: [...F], handler: async ({ actor, params, json }) => farms.updateFarm(actor, params.id!, await json()) },
  { method: "DELETE", path: "/farms/:id", auth: [...F], handler: async ({ actor, params }) => (await farms.deleteFarm(actor, params.id!), { ok: true }) },
  { method: "GET", path: "/fields", auth: [...F], handler: async ({ actor }) => farms.listFields(actor) },
  { method: "POST", path: "/fields", auth: [...F], handler: async ({ actor, json }) => farms.createField(actor, await json()) },
  { method: "PATCH", path: "/fields/:id", auth: [...F], handler: async ({ actor, params, json }) => farms.updateField(actor, params.id!, await json()) },
  { method: "DELETE", path: "/fields/:id", auth: [...F], handler: async ({ actor, params }) => (await farms.deleteField(actor, params.id!), { ok: true }) },
  { method: "GET", path: "/crop-records", auth: [...F], handler: async ({ actor, query }) => farms.listCropRecords(actor, { status: query.get("status") ?? undefined }) },
  { method: "POST", path: "/crop-records", auth: [...F], handler: async ({ actor, json }) => farms.createCropRecord(actor, await json()) },
  { method: "PATCH", path: "/crop-records/:id", auth: [...F], handler: async ({ actor, params, json }) => farms.updateCropRecord(actor, params.id!, await json()) },
  { method: "DELETE", path: "/crop-records/:id", auth: [...F], handler: async ({ actor, params }) => (await farms.deleteCropRecord(actor, params.id!), { ok: true }) },
  { method: "GET", path: "/activities", auth: [...F], handler: async ({ actor, query }) => farms.listActivities(actor, { farmId: query.get("farmId") ?? undefined, take: Math.min(Number(query.get("take") ?? 50), 200) }) },
  { method: "POST", path: "/activities", auth: [...F], handler: async ({ actor, json }) => farms.recordActivity(actor, await json()) },
  { method: "DELETE", path: "/activities/:id", auth: [...F], handler: async ({ actor, params }) => (await farms.deleteActivity(actor, params.id!), { ok: true }) },
  { method: "GET", path: "/tasks", auth: [...F], handler: async ({ actor }) => farms.listTasks(actor) },
  { method: "POST", path: "/tasks", auth: [...F], handler: async ({ actor, json }) => farms.createTask(actor, await json()) },
  {
    method: "POST",
    path: "/tasks/:id/status",
    auth: [...F],
    handler: async ({ actor, params, json }) => {
      const { status } = await json<{ status?: string }>();
      if (status !== "PENDING" && status !== "DONE" && status !== "CANCELLED") throw invalid("Invalid status.");
      return farms.setTaskStatus(actor, params.id!, status);
    },
  },
  // Offline queue (same contract as the website's /api/sync)
  {
    method: "POST",
    path: "/sync",
    auth: [...F],
    handler: async ({ actor, json }) => {
      return { results: await applySyncBatch(actor, await json()) };
    },
  },
];

export const aiRoutes: RouteDef[] = [
  { method: "GET", path: "/ai/status", auth: true, handler: async () => ({ configured: isAIConfigured() }) },
  { method: "GET", path: "/ai/conversations", auth: [...F], handler: async ({ actor }) => ai.listConversations(actor, "FARMER_ASSISTANT") },
  { method: "GET", path: "/ai/conversations/:id", auth: [...F], handler: async ({ actor, params }) => ai.getConversationMessages(actor, params.id!) },
  { method: "DELETE", path: "/ai/conversations/:id", auth: [...F], handler: async ({ actor, params }) => (await ai.deleteConversation(actor, params.id!), { ok: true }) },
  {
    method: "POST",
    path: "/ai/chat",
    auth: [...F],
    handler: async ({ actor, json }) => {
      const d = aiChatSchema.parse(await json());
      return ai.farmerChat(actor, { conversationId: d.conversationId, message: d.message });
    },
  },
  {
    method: "POST",
    path: "/ai/messages/:id/suggested-tasks/:index",
    auth: [...F],
    handler: async ({ actor, params, json }) => {
      const { farmId } = await json<{ farmId?: string }>().catch(() => ({ farmId: undefined }));
      return ai.addSuggestedTask(actor, params.id!, Number(params.index), farmId);
    },
  },
  {
    method: "GET",
    path: "/crop-health",
    auth: [...F],
    handler: async ({ actor }) =>
      prisma.cropHealthAssessment.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 50, include: { crop: { select: { id: true, name: true } }, farm: { select: { id: true, name: true } } } }),
  },
  {
    method: "GET",
    path: "/crop-health/:id",
    auth: [...F],
    handler: async ({ actor, params }) => {
      const a = await prisma.cropHealthAssessment.findUnique({ where: { id: params.id! }, include: { crop: { select: { id: true, name: true } }, farm: { select: { id: true, name: true } } } });
      if (!a || a.userId !== actor.id) throw notFound("Assessment not found.");
      return a;
    },
  },
  {
    method: "POST",
    path: "/crop-health",
    auth: [...F],
    handler: async ({ actor, form }) => {
      const fd = await form();
      const file = fd.get("image");
      let imageId: string | undefined;
      if (file instanceof File && file.size > 0) imageId = (await saveImage(actor, file, "CROP_IMAGE")).id;
      const str = (k: string) => {
        const v = fd.get(k);
        return typeof v === "string" && v.trim() ? v.trim() : undefined;
      };
      const cropId = str("cropId");
      if (!cropId) throw invalid("Choose a crop.", { cropId: ["Required"] });
      return ai.assessCropHealth(actor, { cropId, farmId: str("farmId"), cropRecordId: str("cropRecordId"), symptoms: String(fd.get("symptoms") ?? ""), imageId });
    },
  },
  { method: "POST", path: "/crop-health/:id/retry", auth: [...F], handler: async ({ actor, params }) => ai.retryAssessment(actor, params.id!) },
  { method: "POST", path: "/crop-health/:id/expert-review", auth: [...F], handler: async ({ actor, params }) => experts.requestExpertReview(actor, params.id!) },
  { method: "POST", path: "/crop-records/:id/advice", auth: [...F], handler: async ({ actor, params }) => ai.cropAdvice(actor, params.id!) },
  // Experts
  { method: "GET", path: "/expert/status", auth: ["EXPERT"], handler: async ({ actor }) => experts.expertStatus(actor) },
  { method: "GET", path: "/expert/cases", auth: ["EXPERT"], handler: async ({ actor }) => experts.listReviewQueue(actor) },
  { method: "POST", path: "/expert/cases/:id/review", auth: ["EXPERT"], handler: async ({ actor, params, json }) => experts.submitExpertReview(actor, params.id!, await json()) },
];
