import "server-only";
import { Prisma, type TransactionCategory, type TransactionType } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/action";
import { forbidden, invalid, notFound } from "@/lib/errors";
import { D, money } from "@/lib/money";
import { estimateSchema, transactionSchema } from "@/lib/validation/schemas";
import { summarizeTransactions } from "./calc";

export { summarizeTransactions };

async function assertOwnedRefs(actor: Actor, refs: { farmId?: string; fieldId?: string; cropRecordId?: string }) {
  if (refs.farmId) {
    const farm = await prisma.farm.findUnique({ where: { id: refs.farmId }, select: { ownerId: true } });
    if (!farm || farm.ownerId !== actor.id) throw forbidden("Farm not found in your account.");
  }
  if (refs.fieldId) {
    const f = await prisma.farmField.findUnique({ where: { id: refs.fieldId }, include: { farm: { select: { ownerId: true } } } });
    if (!f || f.farm.ownerId !== actor.id || (refs.farmId && f.farmId !== refs.farmId)) throw invalid("Invalid field.");
  }
  if (refs.cropRecordId) {
    const c = await prisma.cropRecord.findUnique({ where: { id: refs.cropRecordId }, include: { farm: { select: { ownerId: true } } } });
    if (!c || c.farm.ownerId !== actor.id || (refs.farmId && c.farmId !== refs.farmId)) throw invalid("Invalid crop record.");
  }
}

export async function recordTransaction(actor: Actor, input: z.input<typeof transactionSchema>) {
  if (actor.role !== "FARMER") throw forbidden("Only farmers record farm finances.");
  const d = transactionSchema.parse(input);
  await assertOwnedRefs(actor, d);
  return prisma.farmTransaction.create({ data: { ...d, amount: money(d.amount), userId: actor.id } });
}

export async function deleteTransaction(actor: Actor, id: string) {
  const t = await prisma.farmTransaction.findUnique({ where: { id } });
  if (!t || t.userId !== actor.id) throw notFound("Transaction not found.");
  if (t.orderId) throw invalid("Transactions created from marketplace orders cannot be deleted.");
  await prisma.farmTransaction.delete({ where: { id } });
}

export async function listTransactions(actor: Actor, opts: { from?: Date; to?: Date; type?: TransactionType; take?: number } = {}) {
  return prisma.farmTransaction.findMany({
    where: {
      userId: actor.id,
      ...(opts.type ? { type: opts.type } : {}),
      ...(opts.from || opts.to ? { date: { gte: opts.from, lte: opts.to } } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: opts.take ?? 500,
    include: { farm: { select: { name: true } }, field: { select: { name: true } }, cropRecord: { include: { crop: true } } },
  });
}

/** Full financial summary for a farmer computed from recorded transactions (source of truth for AI too). */
export async function financialSummary(userId: string, opts: { from?: Date; to?: Date } = {}) {
  const txns = await prisma.farmTransaction.findMany({
    where: { userId, ...(opts.from || opts.to ? { date: { gte: opts.from, lte: opts.to } } : {}) },
    include: { cropRecord: { include: { crop: true } }, field: { select: { name: true } } },
  });
  const summary = summarizeTransactions(
    txns.map((t) => ({
      type: t.type,
      category: t.category,
      amount: t.amount,
      date: t.date,
      crop: t.cropRecord?.crop.name ?? null,
      field: t.field?.name ?? null,
    })),
  );
  const estimates = await prisma.financialRecord.findMany({ where: { userId } });
  const estCost = estimates.filter((e) => e.type === "ESTIMATED_COST").reduce((a, e) => a.plus(e.amount), D(0));
  const estRevenue = estimates.filter((e) => e.type === "ESTIMATED_REVENUE").reduce((a, e) => a.plus(e.amount), D(0));
  return {
    ...summary,
    estimates: { cost: estCost.toFixed(2), revenue: estRevenue.toFixed(2), profit: estRevenue.minus(estCost).toFixed(2), count: estimates.length },
  };
}

export async function recordEstimate(actor: Actor, input: z.input<typeof estimateSchema>) {
  if (actor.role !== "FARMER") throw forbidden();
  const d = estimateSchema.parse(input);
  await assertOwnedRefs(actor, d);
  return prisma.financialRecord.create({ data: { ...d, amount: money(d.amount), userId: actor.id } });
}

export async function listEstimates(actor: Actor) {
  return prisma.financialRecord.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, include: { cropRecord: { include: { crop: true } } } });
}

export async function deleteEstimate(actor: Actor, id: string) {
  const res = await prisma.financialRecord.deleteMany({ where: { id, userId: actor.id } });
  if (!res.count) throw notFound();
}

export function transactionsToCsv(
  rows: Array<{ date: Date; type: string; category: TransactionCategory; amount: Prisma.Decimal; description: string | null; farm?: { name: string } | null; cropRecord?: { crop: { name: string } } | null }>,
) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const header = "Date,Type,Category,Amount (ZMW),Farm,Crop,Description,Recorded as";
  const lines = rows.map((r) =>
    [r.date.toISOString().slice(0, 10), r.type, r.category, r.amount.toFixed(2), r.farm?.name ?? "", r.cropRecord?.crop.name ?? "", r.description ?? "", "ACTUAL"]
      .map((x) => esc(String(x)))
      .join(","),
  );
  return [header, ...lines].join("\n");
}
