import "server-only";
import { prisma } from "@/lib/db";
import type { FarmOpt } from "@/components/farm/forms";

/** Serializable farm/field/crop options for client forms (owner-scoped). */
export async function farmOptions(userId: string): Promise<FarmOpt[]> {
  const farms = await prisma.farm.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      fields: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      cropRecords: { where: { status: { in: ["PLANNED", "GROWING", "HARVESTED"] } }, orderBy: { plantingDate: "desc" }, select: { id: true, variety: true, plantingDate: true, crop: { select: { name: true } } } },
    },
  });
  return farms.map((f) => ({
    id: f.id,
    name: f.name,
    fields: f.fields,
    crops: f.cropRecords.map((c) => ({ id: c.id, label: `${c.crop.name}${c.variety ? ` (${c.variety})` : ""}${c.plantingDate ? ` · ${c.plantingDate.toISOString().slice(0, 7)}` : ""}` })),
  }));
}

export async function cropCatalog() {
  return prisma.crop.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}
