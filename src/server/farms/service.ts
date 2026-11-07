import "server-only";
import type { z } from "zod";
import { prisma, type Tx } from "@/lib/db";
import { forbidden, invalid, notFound } from "@/lib/errors";
import type { Actor } from "@/lib/action";
import { audit } from "@/lib/audit";
import { isValidDistrict } from "@/lib/zambia";
import { activitySchema, cropRecordSchema, farmSchema, fieldSchema, noteSchema, taskSchema } from "@/lib/validation/schemas";
import type { ActivityType, TransactionCategory } from "@prisma/client";

// ───────── ownership guards (every farm-scoped query goes through these) ─────────

export async function getOwnedFarm(actor: Actor, farmId: string, tx: Tx = prisma) {
  const farm = await tx.farm.findUnique({ where: { id: farmId } });
  if (!farm) throw notFound("Farm not found.");
  if (farm.ownerId !== actor.id) throw forbidden("This farm belongs to another user.");
  return farm;
}

async function assertFieldInFarm(fieldId: string | undefined, farmId: string, tx: Tx = prisma) {
  if (!fieldId) return;
  const f = await tx.farmField.findUnique({ where: { id: fieldId }, select: { farmId: true } });
  if (!f || f.farmId !== farmId) throw invalid("The selected field does not belong to this farm.", { fieldId: ["Invalid field"] });
}

async function assertCropRecordInFarm(cropRecordId: string | undefined, farmId: string, tx: Tx = prisma) {
  if (!cropRecordId) return;
  const c = await tx.cropRecord.findUnique({ where: { id: cropRecordId }, select: { farmId: true } });
  if (!c || c.farmId !== farmId) throw invalid("The selected crop does not belong to this farm.", { cropRecordId: ["Invalid crop"] });
}

function requireFarmer(actor: Actor) {
  if (actor.role !== "FARMER") throw forbidden("Only farmer accounts can manage farms.");
}

// ───────── farms ─────────

export async function listFarms(actor: Actor) {
  return prisma.farm.findMany({
    where: { ownerId: actor.id },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { fields: true, cropRecords: true } },
      cropRecords: { where: { status: { in: ["PLANNED", "GROWING"] } }, include: { crop: true }, take: 5 },
    },
  });
}

export async function createFarm(actor: Actor, input: z.input<typeof farmSchema>) {
  requireFarmer(actor);
  const d = farmSchema.parse(input);
  if (!isValidDistrict(d.province, d.district)) throw invalid("Choose a district in the selected province.", { district: ["Invalid district"] });
  const farm = await prisma.farm.create({ data: { ...d, ownerId: actor.id } });
  await audit({ actorId: actor.id, action: "farm.create", entityType: "Farm", entityId: farm.id });
  return farm;
}

export async function updateFarm(actor: Actor, farmId: string, input: z.input<typeof farmSchema>) {
  await getOwnedFarm(actor, farmId);
  const d = farmSchema.parse(input);
  if (!isValidDistrict(d.province, d.district)) throw invalid("Choose a district in the selected province.", { district: ["Invalid district"] });
  return prisma.farm.update({
    where: { id: farmId },
    data: { ...d, latitude: d.latitude ?? null, longitude: d.longitude ?? null },
  });
}

export async function deleteFarm(actor: Actor, farmId: string) {
  await getOwnedFarm(actor, farmId);
  const openOrders = await prisma.produceListing.count({
    where: { farmId, orderItems: { some: { order: { status: { notIn: ["COMPLETED", "CANCELLED", "REJECTED"] } } } } },
  });
  if (openOrders) throw invalid("This farm has listings with open orders. Complete or cancel them first.");
  await prisma.farm.delete({ where: { id: farmId } });
  await audit({ actorId: actor.id, action: "farm.delete", entityType: "Farm", entityId: farmId });
}

export async function getFarmDetail(actor: Actor, farmId: string) {
  await getOwnedFarm(actor, farmId);
  return prisma.farm.findUniqueOrThrow({
    where: { id: farmId },
    include: {
      fields: { orderBy: { name: "asc" }, include: { cropRecords: { where: { status: { in: ["PLANNED", "GROWING"] } }, include: { crop: true } } } },
      cropRecords: { orderBy: { plantingDate: "desc" }, include: { crop: true, field: true } },
      activities: { orderBy: { date: "desc" }, take: 10, include: { field: true, cropRecord: { include: { crop: true } } } },
      tasks: { where: { status: "PENDING" }, orderBy: { dueDate: "asc" }, take: 8 },
    },
  });
}

// ───────── fields ─────────

export async function listFields(actor: Actor) {
  return prisma.farmField.findMany({
    where: { farm: { ownerId: actor.id } },
    orderBy: [{ farm: { name: "asc" } }, { name: "asc" }],
    include: { farm: { select: { id: true, name: true } }, cropRecords: { where: { status: { in: ["PLANNED", "GROWING"] } }, include: { crop: true } } },
  });
}

export async function createField(actor: Actor, input: z.input<typeof fieldSchema>) {
  requireFarmer(actor);
  const d = fieldSchema.parse(input);
  await getOwnedFarm(actor, d.farmId);
  return prisma.farmField.create({ data: d });
}

export async function updateField(actor: Actor, fieldId: string, input: z.input<typeof fieldSchema>) {
  const d = fieldSchema.parse(input);
  const field = await prisma.farmField.findUnique({ where: { id: fieldId }, include: { farm: true } });
  if (!field || field.farm.ownerId !== actor.id) throw notFound("Field not found.");
  await getOwnedFarm(actor, d.farmId);
  return prisma.farmField.update({ where: { id: fieldId }, data: d });
}

export async function deleteField(actor: Actor, fieldId: string) {
  const field = await prisma.farmField.findUnique({ where: { id: fieldId }, include: { farm: true } });
  if (!field || field.farm.ownerId !== actor.id) throw notFound("Field not found.");
  await prisma.farmField.delete({ where: { id: fieldId } });
}

// ───────── crop records ─────────

export async function listCropRecords(actor: Actor, filter: { status?: string } = {}) {
  return prisma.cropRecord.findMany({
    where: { farm: { ownerId: actor.id }, ...(filter.status ? { status: filter.status as never } : {}) },
    orderBy: [{ status: "asc" }, { plantingDate: "desc" }],
    include: { crop: true, farm: { select: { id: true, name: true, district: true } }, field: { select: { id: true, name: true } } },
  });
}

export async function createCropRecord(actor: Actor, input: z.input<typeof cropRecordSchema>) {
  requireFarmer(actor);
  const d = cropRecordSchema.parse(input);
  await getOwnedFarm(actor, d.farmId);
  await assertFieldInFarm(d.fieldId, d.farmId);
  const crop = await prisma.crop.findUnique({ where: { id: d.cropId } });
  if (!crop || !crop.isActive) throw invalid("Choose a valid crop.", { cropId: ["Invalid crop"] });
  return prisma.$transaction(async (tx) => {
    const rec = await tx.cropRecord.create({ data: d });
    if (d.fieldId && (d.status === "GROWING" || d.plantingDate)) {
      await tx.farmField.update({ where: { id: d.fieldId }, data: { status: d.status === "HARVESTED" ? "HARVESTED" : "PLANTED" } });
    }
    // Auto-create reminders on the farm calendar
    if (d.expectedHarvestDate) {
      await tx.farmTask.create({
        data: {
          userId: actor.id,
          farmId: d.farmId,
          fieldId: d.fieldId,
          cropRecordId: rec.id,
          title: `Expected ${crop.name} harvest`,
          type: "HARVESTING",
          dueDate: d.expectedHarvestDate,
          source: "SYSTEM",
        },
      });
    }
    return rec;
  });
}

export async function updateCropRecord(actor: Actor, id: string, input: z.input<typeof cropRecordSchema>) {
  const rec = await prisma.cropRecord.findUnique({ where: { id }, include: { farm: true } });
  if (!rec || rec.farm.ownerId !== actor.id) throw notFound("Crop record not found.");
  const d = cropRecordSchema.parse(input);
  await getOwnedFarm(actor, d.farmId);
  await assertFieldInFarm(d.fieldId, d.farmId);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.cropRecord.update({ where: { id }, data: { ...d, fieldId: d.fieldId ?? null } });
    if (d.fieldId && d.status === "HARVESTED") await tx.farmField.update({ where: { id: d.fieldId }, data: { status: "HARVESTED" } });
    return updated;
  });
}

export async function deleteCropRecord(actor: Actor, id: string) {
  const rec = await prisma.cropRecord.findUnique({ where: { id }, include: { farm: true } });
  if (!rec || rec.farm.ownerId !== actor.id) throw notFound("Crop record not found.");
  await prisma.cropRecord.delete({ where: { id } });
}

// ───────── activities ─────────

const ACTIVITY_EXPENSE_CATEGORY: Partial<Record<ActivityType, TransactionCategory>> = {
  LAND_PREPARATION: "LABOUR",
  PLANTING: "SEEDS",
  FERTILIZER_APPLICATION: "FERTILIZER",
  IRRIGATION: "IRRIGATION",
  WEED_MANAGEMENT: "LABOUR",
  PEST_MANAGEMENT: "CHEMICALS",
  DISEASE_TREATMENT: "CHEMICALS",
  HARVESTING: "LABOUR",
  STORAGE: "STORAGE",
};

export async function listActivities(actor: Actor, opts: { farmId?: string; take?: number } = {}) {
  return prisma.farmActivity.findMany({
    where: { userId: actor.id, ...(opts.farmId ? { farmId: opts.farmId } : {}) },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: opts.take ?? 200,
    include: { farm: { select: { name: true } }, field: { select: { name: true } }, cropRecord: { include: { crop: true } }, transaction: true },
  });
}

/** Idempotent when clientId is supplied (offline sync can safely retry). */
export async function recordActivity(actor: Actor, input: z.input<typeof activitySchema>) {
  requireFarmer(actor);
  const d = activitySchema.parse(input);
  if (d.clientId) {
    const existing = await prisma.farmActivity.findUnique({ where: { userId_clientId: { userId: actor.id, clientId: d.clientId } } });
    if (existing) return existing;
  }
  return prisma.$transaction(async (tx) => {
    await getOwnedFarm(actor, d.farmId, tx);
    await assertFieldInFarm(d.fieldId, d.farmId, tx);
    await assertCropRecordInFarm(d.cropRecordId, d.farmId, tx);
    const { recordExpense, ...rest } = d;
    const activity = await tx.farmActivity.create({ data: { ...rest, userId: actor.id } });
    if (recordExpense && d.cost && d.cost > 0) {
      await tx.farmTransaction.create({
        data: {
          userId: actor.id,
          farmId: d.farmId,
          fieldId: d.fieldId,
          cropRecordId: d.cropRecordId,
          activityId: activity.id,
          type: "EXPENSE",
          category: ACTIVITY_EXPENSE_CATEGORY[d.type] ?? "OTHER_EXPENSE",
          amount: d.cost,
          date: d.date,
          description: `Activity: ${d.type.replaceAll("_", " ").toLowerCase()}${d.notes ? " — " + d.notes.slice(0, 120) : ""}`,
        },
      });
    }
    return activity;
  });
}

export async function deleteActivity(actor: Actor, id: string) {
  const a = await prisma.farmActivity.findUnique({ where: { id } });
  if (!a || a.userId !== actor.id) throw notFound("Activity not found.");
  await prisma.$transaction([prisma.farmTransaction.deleteMany({ where: { activityId: id, userId: actor.id } }), prisma.farmActivity.delete({ where: { id } })]);
}

// ───────── tasks & calendar ─────────

export async function createTask(actor: Actor, input: z.input<typeof taskSchema>, source = "USER") {
  requireFarmer(actor);
  const d = taskSchema.parse(input);
  if (d.clientId) {
    const existing = await prisma.farmTask.findUnique({ where: { userId_clientId: { userId: actor.id, clientId: d.clientId } } });
    if (existing) return existing;
  }
  if (d.farmId) {
    await getOwnedFarm(actor, d.farmId);
    await assertFieldInFarm(d.fieldId, d.farmId);
    await assertCropRecordInFarm(d.cropRecordId, d.farmId);
  } else if (d.fieldId || d.cropRecordId) {
    throw invalid("Select a farm for this task.");
  }
  return prisma.farmTask.create({ data: { ...d, userId: actor.id, source } });
}

export async function setTaskStatus(actor: Actor, id: string, status: "PENDING" | "DONE" | "CANCELLED") {
  const t = await prisma.farmTask.findUnique({ where: { id } });
  if (!t || t.userId !== actor.id) throw notFound("Task not found.");
  return prisma.farmTask.update({
    where: { id },
    data: { status, completedAt: status === "DONE" ? new Date() : null, version: { increment: 1 } },
  });
}

export async function listTasks(actor: Actor, range?: { from: Date; to: Date }) {
  return prisma.farmTask.findMany({
    where: { userId: actor.id, ...(range ? { dueDate: { gte: range.from, lte: range.to } } : {}) },
    orderBy: { dueDate: "asc" },
    include: { farm: { select: { name: true } } },
  });
}

export type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  kind: "TASK" | "PLANTING" | "HARVEST" | "ACTIVITY";
  status?: string;
  farm?: string;
  taskId?: string;
};

export async function calendarEvents(actor: Actor, from: Date, to: Date): Promise<CalendarEvent[]> {
  const [tasks, crops, activities] = await Promise.all([
    prisma.farmTask.findMany({ where: { userId: actor.id, dueDate: { gte: from, lte: to } }, include: { farm: { select: { name: true } } } }),
    prisma.cropRecord.findMany({
      where: {
        farm: { ownerId: actor.id },
        OR: [{ plantingDate: { gte: from, lte: to } }, { expectedHarvestDate: { gte: from, lte: to } }],
      },
      include: { crop: true, farm: { select: { name: true } } },
    }),
    prisma.farmActivity.findMany({ where: { userId: actor.id, date: { gte: from, lte: to } }, include: { farm: { select: { name: true } } } }),
  ]);
  const events: CalendarEvent[] = [];
  for (const t of tasks)
    events.push({ id: "t" + t.id, taskId: t.id, date: t.dueDate.toISOString().slice(0, 10), title: t.title, kind: "TASK", status: t.status, farm: t.farm?.name });
  for (const c of crops) {
    if (c.plantingDate && c.plantingDate >= from && c.plantingDate <= to)
      events.push({ id: "p" + c.id, date: c.plantingDate.toISOString().slice(0, 10), title: `Planting: ${c.crop.name}${c.variety ? ` (${c.variety})` : ""}`, kind: "PLANTING", farm: c.farm.name });
    if (c.expectedHarvestDate && c.expectedHarvestDate >= from && c.expectedHarvestDate <= to && c.status !== "HARVESTED")
      events.push({ id: "h" + c.id, date: c.expectedHarvestDate.toISOString().slice(0, 10), title: `Expected harvest: ${c.crop.name}`, kind: "HARVEST", farm: c.farm.name });
  }
  for (const a of activities)
    events.push({ id: "a" + a.id, date: a.date.toISOString().slice(0, 10), title: a.type.replaceAll("_", " ").toLowerCase().replace(/^./, (s) => s.toUpperCase()), kind: "ACTIVITY", farm: a.farm.name });
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

// ───────── notes (offline-capable) ─────────

export async function listNotes(actor: Actor) {
  return prisma.farmNote.findMany({ where: { userId: actor.id }, orderBy: { updatedAt: "desc" }, include: { farm: { select: { name: true } } } });
}

export async function createNote(actor: Actor, input: z.input<typeof noteSchema>) {
  const d = noteSchema.parse(input);
  if (d.clientId) {
    const existing = await prisma.farmNote.findUnique({ where: { userId_clientId: { userId: actor.id, clientId: d.clientId } } });
    if (existing) return existing;
  }
  if (d.farmId) await getOwnedFarm(actor, d.farmId);
  return prisma.farmNote.create({ data: { ...d, userId: actor.id } });
}

/** Optimistic concurrency: fails with a conflict when the note changed since `baseVersion`. */
export async function updateNote(actor: Actor, id: string, input: { title: string; body: string; baseVersion: number }) {
  const note = await prisma.farmNote.findUnique({ where: { id } });
  if (!note || note.userId !== actor.id) throw notFound("Note not found.");
  const res = await prisma.farmNote.updateMany({
    where: { id, userId: actor.id, version: input.baseVersion },
    data: { title: input.title.slice(0, 140), body: input.body.slice(0, 5000), version: { increment: 1 } },
  });
  if (res.count === 0) {
    const current = await prisma.farmNote.findUniqueOrThrow({ where: { id } });
    return { conflict: true as const, current };
  }
  return { conflict: false as const, note: await prisma.farmNote.findUniqueOrThrow({ where: { id } }) };
}

export async function deleteNote(actor: Actor, id: string) {
  const res = await prisma.farmNote.deleteMany({ where: { id, userId: actor.id } });
  if (!res.count) throw notFound("Note not found.");
}

// ───────── dashboard summary ─────────

export async function farmerOverview(actor: Actor) {
  const now = new Date();
  const in14 = new Date(now.getTime() + 14 * 86400_000);
  const [farms, activeCrops, tasks, openOrders, lowStock, unread, recentActivities, listings] = await Promise.all([
    prisma.farm.findMany({ where: { ownerId: actor.id }, select: { id: true, name: true, size: true, sizeUnit: true, district: true, province: true, latitude: true, longitude: true } }),
    prisma.cropRecord.findMany({
      where: { farm: { ownerId: actor.id }, status: { in: ["PLANNED", "GROWING"] } },
      include: { crop: true, farm: { select: { name: true } }, field: { select: { name: true } } },
      orderBy: { expectedHarvestDate: "asc" },
    }),
    prisma.farmTask.findMany({ where: { userId: actor.id, status: "PENDING", dueDate: { lte: in14 } }, orderBy: { dueDate: "asc" }, take: 6, include: { farm: { select: { name: true } } } }),
    prisma.purchaseOrder.count({ where: { sellerId: actor.id, status: { notIn: ["COMPLETED", "CANCELLED", "REJECTED"] } } }),
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint AS count FROM "InventoryItem" WHERE "ownerId" = ${actor.id} AND "quantity" <= "minStockLevel" AND "minStockLevel" > 0`,
    prisma.notification.count({ where: { userId: actor.id, readAt: null } }),
    prisma.farmActivity.findMany({ where: { userId: actor.id }, orderBy: { date: "desc" }, take: 5, include: { farm: { select: { name: true } } } }),
    prisma.produceListing.count({ where: { farmerId: actor.id, status: "ACTIVE" } }),
  ]);
  return { farms, activeCrops, tasks, openOrders, lowStock: Number(lowStock[0]?.count ?? 0), unread, recentActivities, listings };
}
