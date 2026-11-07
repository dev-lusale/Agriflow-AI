/**
 * Production bootstrap — safe to run repeatedly. Never deletes or overwrites user data.
 *   - Upserts reference data: crops, input product categories, Zambian districts, default settings
 *   - Creates the first SUPER_ADMIN if BOOTSTRAP_ADMIN_EMAIL does not exist yet
 *
 *   BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=... BOOTSTRAP_ADMIN_NAME="..." npx tsx prisma/bootstrap.ts
 */
import { PrismaClient, type Province, type QuantityUnit } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DISTRICTS } from "../src/lib/zambia";

const prisma = new PrismaClient();

const CROPS: [string, string, QuantityUnit][] = [
  ["Maize", "Cereal", "BAG_50KG"],
  ["Soybeans", "Legume", "KG"],
  ["Groundnuts", "Legume", "KG"],
  ["Cotton", "Cash crop", "KG"],
  ["Tobacco", "Cash crop", "KG"],
  ["Sunflower", "Oilseed", "KG"],
  ["Rice", "Cereal", "KG"],
  ["Wheat", "Cereal", "TONNE"],
  ["Cassava", "Root crop", "KG"],
  ["Beans", "Legume", "KG"],
  ["Tomatoes", "Vegetable", "CRATE"],
  ["Vegetables", "Vegetable", "KG"],
];

const CATEGORIES: [string, string, boolean][] = [
  ["Certified seeds", "seeds", false],
  ["Fertilizer", "fertilizer", false],
  ["Crop protection", "crop-protection", true],
  ["Farming equipment", "equipment", false],
  ["Agricultural tools", "tools", false],
  ["Irrigation supplies", "irrigation", false],
  ["Animal feed", "animal-feed", false],
];

const SETTINGS: Record<string, unknown> = {
  "marketplace.requireApproval": false,
  "ai.enabled": true,
  "ai.hourlyLimitPerUser": 30,
  "platform.supportEmail": "",
  "platform.maintenanceBanner": "",
};

async function main() {
  for (const [name, category, defaultUnit] of CROPS) {
    await prisma.crop.upsert({ where: { name }, create: { name, category, defaultUnit }, update: {} });
  }
  for (const [name, slug, requiresSafetyInfo] of CATEGORIES) {
    await prisma.productCategory.upsert({ where: { slug }, create: { name, slug, requiresSafetyInfo }, update: {} });
  }
  for (const province of Object.keys(DISTRICTS) as Province[]) {
    for (const d of DISTRICTS[province]) {
      await prisma.district.upsert({
        where: { province_name: { province, name: d.name } },
        create: { province, name: d.name, latitude: d.lat ?? undefined, longitude: d.lng ?? undefined },
        update: {},
      });
    }
  }
  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.systemSetting.upsert({ where: { key }, create: { key, value: value as never }, update: {} });
  }

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`Admin ${email} already exists (role ${existing.role}); not modified.`);
    } else {
      if (!password || password.length < 12) throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.");
      const now = new Date();
      await prisma.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash(password, 11),
          role: "SUPER_ADMIN",
          emailVerifiedAt: now,
          onboardingCompletedAt: now,
          dataConsentAt: now,
          verifiedAt: now,
          profile: { create: { fullName: process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "AgriFlow Administrator" } },
        },
      });
      await prisma.auditLog.create({ data: { action: "admin.bootstrap", entityType: "User", metadata: { email } } });
      console.log(`Created super administrator ${email}.`);
    }
  }
  const [crops, cats, districts, users] = await Promise.all([prisma.crop.count(), prisma.productCategory.count(), prisma.district.count(), prisma.user.count()]);
  console.log(`Reference data ready: ${crops} crops, ${cats} categories, ${districts} districts. Users: ${users}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
