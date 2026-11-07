"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { requireAdmin, requireRole } from "@/lib/auth/session";
import { aiChatSchema, reportRequestSchema } from "@/lib/validation/schemas";
import * as ai from "@/server/ai/service";
import { saveImage } from "@/server/storage/service";
import { invalid } from "@/lib/errors";

export async function farmerChatAction(input: { conversationId?: string; message: string }) {
  return runAction(async () => {
    const actor = await requireRole("FARMER");
    const d = aiChatSchema.parse(input);
    return ai.farmerChat(actor, d);
  });
}

export async function adminChatAction(input: { conversationId?: string; message: string }) {
  return runAction(async () => {
    const actor = await requireAdmin();
    const d = aiChatSchema.parse(input);
    return ai.adminChat(actor, d);
  });
}

export async function addSuggestedTaskAction(messageId: string, index: number, farmId?: string) {
  return runAction(async () => {
    const actor = await requireRole("FARMER");
    await ai.addSuggestedTask(actor, messageId, index, farmId);
    revalidatePath("/farmer", "layout");
  }, "Task added to your calendar.");
}

export async function deleteAIConversationAction(id: string) {
  return runAction(async () => {
    const actor = await requireRole("FARMER", "ADMIN", "SUPER_ADMIN");
    await ai.deleteConversation(actor, id);
  }, "Conversation deleted.");
}

export async function assessCropHealthAction(fd: FormData) {
  return runAction(async () => {
    const actor = await requireRole("FARMER");
    const file = fd.get("image");
    let imageId: string | undefined;
    if (file instanceof File && file.size > 0) imageId = (await saveImage(actor, file, "CROP_IMAGE")).id;
    const cropId = String(fd.get("cropId") ?? "");
    if (!cropId) throw invalid("Choose a crop.", { cropId: ["Required"] });
    const str = (k: string) => {
      const v = fd.get(k);
      return typeof v === "string" && v.trim() ? v.trim() : undefined;
    };
    const a = await ai.assessCropHealth(actor, { cropId, farmId: str("farmId"), cropRecordId: str("cropRecordId"), symptoms: String(fd.get("symptoms") ?? ""), imageId });
    revalidatePath("/farmer/crop-health");
    return { id: a.id, status: a.status };
  });
}

export async function retryAssessmentAction(id: string) {
  return runAction(async () => {
    const actor = await requireRole("FARMER");
    await ai.retryAssessment(actor, id);
    revalidatePath("/farmer/crop-health");
  }, "Assessment re-run.");
}

export async function cropAdviceAction(cropRecordId: string) {
  return runAction(async () => ai.cropAdvice(await requireRole("FARMER"), cropRecordId));
}

export async function generateReportAction(fd: FormData) {
  return runAction(async () => {
    const actor = await requireRole("FARMER");
    const { type } = reportRequestSchema.parse({ type: fd.get("type") });
    const r = await ai.generateFarmerReport(actor, type);
    revalidatePath("/farmer/reports");
    return { id: r.id };
  }, "Report generated.");
}

export async function generateAdminReportAction(fd: FormData) {
  return runAction(async () => {
    const actor = await requireAdmin();
    const type = fd.get("type") === "ADMIN_MARKETPLACE" ? "ADMIN_MARKETPLACE" : "ADMIN_WEEKLY";
    const r = await ai.generateAdminReport(actor, type);
    revalidatePath("/admin/reports");
    return { id: r.id };
  }, "Report generated.");
}

export async function explainMarketAction(cropId: string) {
  return runAction(async () => {
    const { requireUser } = await import("@/lib/auth/session");
    return ai.explainMarket(await requireUser(), cropId);
  });
}
