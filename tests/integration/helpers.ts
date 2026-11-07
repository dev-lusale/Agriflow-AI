import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} CASCADE`);
  const maize = await prisma.crop.create({ data: { name: "Maize", category: "Cereal", defaultUnit: "BAG_50KG" } });
  const soy = await prisma.crop.create({ data: { name: "Soybeans", category: "Legume", defaultUnit: "KG" } });
  const fert = await prisma.productCategory.create({ data: { name: "Fertilizer", slug: "fertilizer" } });
  const chem = await prisma.productCategory.create({ data: { name: "Crop protection", slug: "crop-protection", requiresSafetyInfo: true } });
  return { maize, soy, fert, chem };
}

let n = 0;
export async function makeUser(role: Role, opts: { province?: "SOUTHERN" | "LUSAKA" | "CENTRAL"; district?: string } = {}) {
  n++;
  const u = await prisma.user.create({
    data: {
      email: `${role.toLowerCase()}${n}-${Date.now()}@test.local`,
      passwordHash: "x",
      role,
      onboardingCompletedAt: new Date(),
      dataConsentAt: new Date(),
      profile: { create: { fullName: `${role} User ${n}`, province: opts.province ?? "SOUTHERN", district: opts.district ?? "Choma" } },
    },
  });
  if (role === "TRANSPORTER") {
    await prisma.transporterProfile.create({ data: { userId: u.id, businessName: `Haulage ${n}`, serviceProvinces: [opts.province ?? "SOUTHERN", "LUSAKA"] } });
  }
  if (role === "SUPPLIER") await prisma.supplierProfile.create({ data: { userId: u.id, businessName: `Agro ${n}` } });
  return { id: u.id, role: u.role, email: u.email };
}
