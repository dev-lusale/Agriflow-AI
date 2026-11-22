import "server-only";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/action";
import { AppError, forbidden, invalid, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { expertReviewSchema } from "@/lib/validation/schemas";
import { notify, notifyMany } from "@/server/notifications/service";

/**
 * Expert second opinions on crop-health cases.
 * - Only the farmer who owns an assessment can send it for review.
 * - Only experts verified by an administrator can see the review queue.
 * - Experts see the crop, photo, symptoms, AI result and district — never the farmer's name or contacts.
 */

async function assertVerifiedExpert(actor: Actor) {
  if (actor.role !== "EXPERT") throw forbidden("Only agricultural expert accounts can review cases.");
  const u = await prisma.user.findUnique({ where: { id: actor.id }, select: { verifiedAt: true, status: true } });
  if (!u || u.status !== "ACTIVE") throw forbidden();
  if (!u.verifiedAt) throw new AppError("Your expert account is waiting for verification by an administrator.", "FORBIDDEN");
}

export async function expertStatus(actor: Actor) {
  const u = await prisma.user.findUnique({ where: { id: actor.id }, select: { verifiedAt: true, expertProfile: true } });
  return { verified: Boolean(u?.verifiedAt), profile: u?.expertProfile ?? null };
}

export async function requestExpertReview(actor: Actor, assessmentId: string) {
  if (actor.role !== "FARMER") throw forbidden("Only farmers can request an expert review.");
  const a = await prisma.cropHealthAssessment.findUnique({ where: { id: assessmentId } });
  if (!a || a.userId !== actor.id) throw notFound("Assessment not found.");
  if (a.status !== "COMPLETED") throw invalid("Wait for the AI check to finish before asking an expert.");
  if (a.expertReviewStatus !== "NONE") throw invalid("This case has already been sent to an expert.");
  const updated = await prisma.cropHealthAssessment.update({
    where: { id: a.id },
    data: { expertReviewStatus: "REQUESTED", reviewRequestedAt: new Date() },
  });
  const experts = await prisma.user.findMany({ where: { role: "EXPERT", status: "ACTIVE", verifiedAt: { not: null } }, select: { id: true } });
  await notifyMany(
    experts.map((e) => e.id),
    { type: "ACCOUNT", title: "New crop-health case to review", body: "A farmer asked for a second opinion.", link: "/expert/dashboard" },
  );
  await audit({ actorId: actor.id, action: "assessment.expert_review_requested", entityType: "CropHealthAssessment", entityId: a.id });
  return { id: updated.id, expertReviewStatus: updated.expertReviewStatus, verifiedExperts: experts.length };
}

const caseSelect = {
  id: true,
  symptoms: true,
  possibleIssue: true,
  confidence: true,
  result: true,
  imageId: true,
  expertReviewStatus: true,
  reviewRequestedAt: true,
  expertNote: true,
  expertReviewedAt: true,
  reviewerId: true,
  createdAt: true,
  crop: { select: { name: true } },
  farm: { select: { province: true, district: true } },
} as const;

export async function listReviewQueue(actor: Actor, opts: { take?: number } = {}) {
  await assertVerifiedExpert(actor);
  const take = Math.min(opts.take ?? 50, 100);
  const [open, mine] = await Promise.all([
    prisma.cropHealthAssessment.findMany({ where: { expertReviewStatus: "REQUESTED" }, orderBy: { reviewRequestedAt: "asc" }, take, select: caseSelect }),
    prisma.cropHealthAssessment.findMany({ where: { reviewerId: actor.id }, orderBy: { expertReviewedAt: "desc" }, take, select: caseSelect }),
  ]);
  return { open, answered: mine };
}

export async function submitExpertReview(actor: Actor, assessmentId: string, input: unknown) {
  await assertVerifiedExpert(actor);
  const { note } = expertReviewSchema.parse(input);
  const a = await prisma.cropHealthAssessment.findUnique({ where: { id: assessmentId }, select: { id: true, userId: true, expertReviewStatus: true, crop: { select: { name: true } } } });
  if (!a) throw notFound("Case not found.");
  if (a.expertReviewStatus !== "REQUESTED") throw invalid("This case is not waiting for a review (another expert may have answered it).");
  // Conditional update so two experts cannot answer the same case.
  const res = await prisma.cropHealthAssessment.updateMany({
    where: { id: a.id, expertReviewStatus: "REQUESTED" },
    data: { expertReviewStatus: "ANSWERED", reviewerId: actor.id, expertNote: note, expertReviewedAt: new Date() },
  });
  if (res.count !== 1) throw invalid("Another expert has just answered this case.");
  await notify(a.userId, {
    type: "AI_REPORT",
    title: `An expert reviewed your ${a.crop.name} case`,
    body: note.length > 140 ? note.slice(0, 137) + "…" : note,
    link: `/farmer/crop-health/${a.id}`,
  });
  await audit({ actorId: actor.id, action: "assessment.expert_review_submitted", entityType: "CropHealthAssessment", entityId: a.id });
  return { id: a.id, expertReviewStatus: "ANSWERED" as const };
}
