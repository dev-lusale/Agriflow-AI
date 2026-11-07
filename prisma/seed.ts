/**
 * AgriFlow AI Zambia — demo seed.
 * Creates FICTIONAL people, businesses and data for local / controlled demos.
 * Every seeded user has isDemo=true; weather and market prices are flagged as demo data.
 *
 *   npm run db:seed          (requires DEMO_PASSWORD in .env)
 *
 * WARNING: wipes all application tables first. Refuses to run with NODE_ENV=production unless SEED_ALLOW_PRODUCTION=true.
 */
import { PrismaClient, Prisma, type Province, type QuantityUnit, type OrderStatus, type DeliveryStatus, type ActivityType, type TransactionCategory } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DISTRICTS } from "../src/lib/zambia";

const prisma = new PrismaClient();
const D = (v: number | string) => new Prisma.Decimal(v);

// Deterministic PRNG so demos are reproducible
let s = 20261107;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;
const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
const round2 = (n: number) => Math.round(n * 100) / 100;
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

const FIRST = ["Mwila", "Chanda", "Mutale", "Bwalya", "Mulenga", "Natasha", "Chilufya", "Musonda", "Kalaba", "Thandiwe", "Lungu", "Mapalo", "Chipo", "Inonge", "Mubanga", "Kunda", "Nalukui", "Sibeso", "Mwansa", "Chileshe", "Tiyamike", "Lubinda", "Mukuka", "Namwinga", "Chisanga", "Mwaka", "Kasonde", "Mbuyoti", "Nchimunya", "Hachilala"];
const LAST = ["Banda", "Phiri", "Mwale", "Zulu", "Tembo", "Mwape", "Chola", "Sakala", "Simukonda", "Mumba", "Nkhoma", "Lungu", "Daka", "Mbewe", "Hamoonga", "Siamwiza", "Kapambwe", "Nyirenda", "Mulenga", "Chirwa"];
const PROVINCE_LIST = Object.keys(DISTRICTS) as Province[];

async function wipe() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} CASCADE`);
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
    throw new Error("Refusing to seed a production environment. Set SEED_ALLOW_PRODUCTION=true for a controlled demo deployment.");
  }
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 8) throw new Error("Set DEMO_PASSWORD (8+ chars) in .env before seeding.");
  console.log("Seeding AgriFlow AI demo data…");
  await wipe();
  const passwordHash = await bcrypt.hash(password, 11);
  const now = new Date();

  // ───────── reference data ─────────
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
  const crops: Record<string, string> = {};
  for (const [name, category, defaultUnit] of CROPS) crops[name] = (await prisma.crop.create({ data: { name, category, defaultUnit } })).id;

  await prisma.district.createMany({
    data: PROVINCE_LIST.flatMap((p) => DISTRICTS[p].map((d) => ({ province: p, name: d.name, latitude: d.lat ?? undefined, longitude: d.lng ?? undefined }))),
  });

  const CATS: [string, string, boolean][] = [
    ["Certified seeds", "seeds", false],
    ["Fertilizer", "fertilizer", false],
    ["Crop protection", "crop-protection", true],
    ["Farming equipment", "equipment", false],
    ["Agricultural tools", "tools", false],
    ["Irrigation supplies", "irrigation", false],
    ["Animal feed", "animal-feed", false],
  ];
  const cats: Record<string, string> = {};
  for (const [name, slug, requiresSafetyInfo] of CATS) cats[slug] = (await prisma.productCategory.create({ data: { name, slug, requiresSafetyInfo } })).id;

  await prisma.systemSetting.createMany({
    data: [
      { key: "marketplace.requireApproval", value: false },
      { key: "ai.enabled", value: true },
      { key: "ai.hourlyLimitPerUser", value: 30 },
      { key: "platform.supportEmail", value: "support@agriflow.example" },
    ],
  });

  // ───────── users ─────────
  type U = { id: string; name: string; province: Province; district: string };
  async function makeUser(opts: { email: string; role: "FARMER" | "BUYER" | "SUPPLIER" | "TRANSPORTER" | "ADMIN" | "SUPER_ADMIN"; name: string; province: Province; district: string; phone?: string; createdAt?: Date; verified?: boolean }): Promise<U> {
    const u = await prisma.user.create({
      data: {
        email: opts.email,
        phone: opts.phone,
        passwordHash,
        role: opts.role,
        isDemo: true,
        emailVerifiedAt: opts.createdAt ?? now,
        onboardingCompletedAt: opts.createdAt ?? now,
        dataConsentAt: opts.createdAt ?? now,
        verifiedAt: opts.verified ? (opts.createdAt ?? now) : null,
        createdAt: opts.createdAt ?? now,
        profile: { create: { fullName: opts.name, province: opts.province, district: opts.district } },
      },
    });
    return { id: u.id, name: opts.name, province: opts.province, district: opts.district };
  }
  const randomLoc = (p?: Province) => {
    const province = p ?? pick(PROVINCE_LIST);
    const district = pick(DISTRICTS[province].filter((d) => d.lat !== null)).name;
    return { province, district };
  };
  const usedNames = new Set<string>();
  const personName = () => {
    let n = "";
    do n = `${pick(FIRST)} ${pick(LAST)}`;
    while (usedNames.has(n));
    usedNames.add(n);
    return n;
  };
  const createdSpread = (i: number, total: number) => daysAgo(Math.round(330 - (i / total) * 320) + int(0, 6));

  const admin = await makeUser({ email: "demo.admin@agriflow.demo", role: "ADMIN", name: "Agnes Demo-Admin", province: "LUSAKA", district: "Lusaka", verified: true, createdAt: daysAgo(360) });
  await makeUser({ email: "superadmin@agriflow.demo", role: "SUPER_ADMIN", name: "Platform Owner (Demo)", province: "LUSAKA", district: "Lusaka", verified: true, createdAt: daysAgo(365) });

  // Farmers (30) — first is the demo farmer from Choma
  const farmerBias: Province[] = ["SOUTHERN", "CENTRAL", "EASTERN", "SOUTHERN", "LUSAKA", "COPPERBELT", "NORTHERN", "EASTERN", "CENTRAL", "MUCHINGA", "LUAPULA", "WESTERN", "NORTH_WESTERN"];
  const demoFarmer = await makeUser({ email: "demo.farmer@agriflow.demo", role: "FARMER", name: "Joseph Mwale", province: "SOUTHERN", district: "Choma", phone: "+260970000101", verified: true, createdAt: daysAgo(340) });
  await prisma.farmerProfile.create({ data: { userId: demoFarmer.id, experienceYears: 12, farmingType: "EMERGENT", mainCrops: ["Maize", "Soybeans", "Tomatoes"], cooperativeName: "Choma Farmers Cooperative (fictional)" } });
  const farmers: U[] = [demoFarmer];
  for (let i = 1; i < 30; i++) {
    const loc = randomLoc(farmerBias[i % farmerBias.length]);
    const name = personName();
    const u = await makeUser({ email: `farmer${i}@agriflow.demo`, role: "FARMER", name, ...loc, phone: `+2609700002${String(i).padStart(2, "0")}`, verified: rnd() > 0.4, createdAt: createdSpread(i, 30) });
    await prisma.farmerProfile.create({ data: { userId: u.id, experienceYears: int(1, 30), farmingType: pick(["SMALLHOLDER", "SMALLHOLDER", "EMERGENT", "COMMERCIAL", "COOPERATIVE"] as const), mainCrops: [pick(["Maize", "Soybeans", "Groundnuts"]), pick(["Beans", "Sunflower", "Cotton", "Tomatoes", "Cassava"])] } });
    farmers.push(u);
  }

  // Buyers (10)
  const BUYER_BIZ = ["Lusaka Grain Traders (Demo)", "Copperbelt Millers (Demo)", "Kafue Agro Processors (Demo)", "Eastern Produce Exporters (Demo)", "Kabwe Feed Mills (Demo)", "Fresh Basket Retail (Demo)", "Mongu Rice Buyers (Demo)", "Solwezi Food Supplies (Demo)", "Chipata Oilseed Co. (Demo)", "Livingstone Hospitality Group (Demo)"];
  const buyerLoc: Province[] = ["LUSAKA", "COPPERBELT", "LUSAKA", "EASTERN", "CENTRAL", "LUSAKA", "WESTERN", "NORTH_WESTERN", "EASTERN", "SOUTHERN"];
  const buyers: U[] = [];
  for (let i = 0; i < 10; i++) {
    const loc = randomLoc(buyerLoc[i]);
    const u = await makeUser({ email: i === 0 ? "demo.buyer@agriflow.demo" : `buyer${i}@agriflow.demo`, role: "BUYER", name: i === 0 ? "Ruth Banda" : personName(), ...loc, phone: `+2609600003${String(i).padStart(2, "0")}`, verified: i < 6, createdAt: createdSpread(i, 10) });
    await prisma.buyerProfile.create({ data: { userId: u.id, businessName: BUYER_BIZ[i], buyerType: pick(["Trader", "Processor / miller", "Retailer", "Exporter"]), preferredCrops: [pick(["Maize", "Soybeans"]), pick(["Groundnuts", "Beans", "Tomatoes"])] } });
    buyers.push(u);
  }

  // Suppliers (5)
  const SUPPLIERS = [
    ["Zambezi Agro-Dealers (Demo)", "LUSAKA"],
    ["Southern Seed & Fertilizer (Demo)", "SOUTHERN"],
    ["Copperbelt Farm Supplies (Demo)", "COPPERBELT"],
    ["Eastern Irrigation Centre (Demo)", "EASTERN"],
    ["Central Implements Ltd (Demo)", "CENTRAL"],
  ] as const;
  const suppliers: U[] = [];
  for (let i = 0; i < 5; i++) {
    const loc = randomLoc(SUPPLIERS[i]![1] as Province);
    const u = await makeUser({ email: i === 0 ? "demo.supplier@agriflow.demo" : `supplier${i}@agriflow.demo`, role: "SUPPLIER", name: i === 0 ? "Peter Zulu" : personName(), ...loc, verified: i < 3, createdAt: createdSpread(i, 5) });
    await prisma.supplierProfile.create({ data: { userId: u.id, businessName: SUPPLIERS[i]![0], description: "Fictional agro-dealer created for demonstration. Supplies seed, fertilizer and farm equipment.", categories: ["Certified seeds", "Fertilizer"] } });
    suppliers.push(u);
  }

  // Transporters (5)
  const TRANSPORTERS: [string, Province[]][] = [
    ["Mwale Haulage (Demo)", ["SOUTHERN", "LUSAKA", "CENTRAL"]],
    ["Great North Logistics (Demo)", ["NORTHERN", "MUCHINGA", "LUAPULA", "COPPERBELT"]],
    ["Eastern Link Transport (Demo)", ["EASTERN", "LUSAKA"]],
    ["Copperbelt Cargo (Demo)", ["COPPERBELT", "NORTH_WESTERN", "CENTRAL"]],
    ["Barotse Movers (Demo)", ["WESTERN", "SOUTHERN"]],
  ];
  const transporters: U[] = [];
  for (let i = 0; i < 5; i++) {
    const [biz, provs] = TRANSPORTERS[i]!;
    const loc = randomLoc(provs[0]);
    const u = await makeUser({ email: i === 0 ? "demo.transporter@agriflow.demo" : `transporter${i}@agriflow.demo`, role: "TRANSPORTER", name: i === 0 ? "Daniel Phiri" : personName(), ...loc, verified: i < 4, createdAt: createdSpread(i, 5) });
    await prisma.transporterProfile.create({ data: { userId: u.id, businessName: biz, contactPhone: `+2609500004${i}0`, pricingModel: pick(["PER_KM", "PER_TONNE", "NEGOTIABLE"] as const), baseRate: D(int(8, 25)), serviceProvinces: provs } });
    await prisma.vehicle.createMany({
      data: [
        { ownerId: u.id, type: "MEDIUM_TRUCK", registration: `DEMO ${1000 + i * 7}`, capacityKg: 7000, description: "7-tonne truck with tarpaulin" },
        { ownerId: u.id, type: i % 2 ? "PICKUP" : "HEAVY_TRUCK", registration: `DEMO ${2000 + i * 7}`, capacityKg: i % 2 ? 1200 : 30000 },
      ],
    });
    transporters.push(u);
  }

  // ───────── farms, fields, crops (20 farms, 40 crop records) ─────────
  type FarmRef = { id: string; ownerId: string; province: Province; district: string; name: string };
  const farms: FarmRef[] = [];
  const fieldsByFarm = new Map<string, string[]>();

  // Demo farmer: Choma maize farm (5 ha) + irrigated vegetable plot in Kalomo
  const choma = await prisma.farm.create({
    data: { ownerId: demoFarmer.id, name: "Mwale Family Farm", province: "SOUTHERN", district: "Choma", location: "Off Choma–Namwala road, 12 km from town", size: D(5), farmingType: "EMERGENT", description: "Rain-fed maize and soybean rotation. Conservation farming (ripping) since 2021.", createdAt: daysAgo(338) },
  });
  const kalomo = await prisma.farm.create({
    data: { ownerId: demoFarmer.id, name: "Kalomo River Plot", province: "SOUTHERN", district: "Kalomo", location: "Near the river, Kalomo", size: D(1.5), farmingType: "EMERGENT", description: "Irrigated tomatoes and vegetables for local markets.", createdAt: daysAgo(300) },
  });
  const fA = await prisma.farmField.create({ data: { farmId: choma.id, name: "Field A (upper)", area: D(3), soilType: "Sandy loam", irrigation: "RAINFED", status: "PREPARING" } });
  const fB = await prisma.farmField.create({ data: { farmId: choma.id, name: "Field B (lower)", area: D(2), soilType: "Clay loam", irrigation: "RAINFED", status: "PREPARING" } });
  const fC = await prisma.farmField.create({ data: { farmId: kalomo.id, name: "Drip block 1", area: D(1), soilType: "Loam", irrigation: "IRRIGATED", status: "PLANTED" } });
  farms.push({ id: choma.id, ownerId: demoFarmer.id, province: "SOUTHERN", district: "Choma", name: choma.name }, { id: kalomo.id, ownerId: demoFarmer.id, province: "SOUTHERN", district: "Kalomo", name: kalomo.name });
  fieldsByFarm.set(choma.id, [fA.id, fB.id]);
  fieldsByFarm.set(kalomo.id, [fC.id]);

  const prevMaize = await prisma.cropRecord.create({
    data: { farmId: choma.id, fieldId: fA.id, cropId: crops.Maize!, variety: "SC 513 (medium maturity)", areaPlanted: D(3), plantingDate: day("2025-12-02"), expectedHarvestDate: day("2026-04-20"), growthStage: "HARVESTED", status: "HARVESTED", estimatedYield: D(360), actualHarvest: D(342), yieldUnit: "BAG_50KG", notes: "2025/26 season. Top-dressed late after heavy January rains." },
  });
  const prevSoy = await prisma.cropRecord.create({
    data: { farmId: choma.id, fieldId: fB.id, cropId: crops.Soybeans!, variety: "Safari", areaPlanted: D(2), plantingDate: day("2025-12-12"), expectedHarvestDate: day("2026-04-15"), growthStage: "HARVESTED", status: "HARVESTED", estimatedYield: D(4400), actualHarvest: D(4100), yieldUnit: "KG", notes: "Inoculated seed. Some pod shattering at harvest." },
  });
  const newMaize = await prisma.cropRecord.create({
    data: { farmId: choma.id, fieldId: fB.id, cropId: crops.Maize!, variety: "SC 513 (medium maturity)", areaPlanted: D(2), plantingDate: day("2026-12-01"), expectedHarvestDate: day("2027-04-20"), growthStage: "PLANNED", status: "PLANNED", estimatedYield: D(240), yieldUnit: "BAG_50KG", notes: "2026/27 rotation: maize after soybeans on Field B. Planting planned with the first effective rains." },
  });
  const newSoy = await prisma.cropRecord.create({
    data: { farmId: choma.id, fieldId: fA.id, cropId: crops.Soybeans!, variety: "Safari", areaPlanted: D(3), plantingDate: day("2026-12-08"), expectedHarvestDate: day("2027-04-12"), growthStage: "PLANNED", status: "PLANNED", estimatedYield: D(6300), yieldUnit: "KG" },
  });
  const tomatoes = await prisma.cropRecord.create({
    data: { farmId: kalomo.id, fieldId: fC.id, cropId: crops.Tomatoes!, variety: "Tengeru 97", areaPlanted: D(1), plantingDate: day("2026-09-10"), expectedHarvestDate: day("2026-12-05"), growthStage: "FLOWERING", status: "GROWING", estimatedYield: D(900), yieldUnit: "CRATE", notes: "Drip irrigated. Scouting twice a week for Tuta absoluta." },
  });

  // 18 more farms for other farmers + 35 more crop records (total 40)
  const cropPool = ["Maize", "Maize", "Soybeans", "Groundnuts", "Beans", "Sunflower", "Cotton", "Tobacco", "Rice", "Wheat", "Cassava", "Vegetables"];
  for (let i = 1; i <= 18; i++) {
    const owner = farmers[i]!;
    const size = round2(pick([1.5, 2, 3, 4, 5, 8, 12, 20, 45, 120]) * (0.8 + rnd() * 0.4));
    const farm = await prisma.farm.create({
      data: { ownerId: owner.id, name: `${owner.name.split(" ")[1]} ${pick(["Farm", "Fields", "Homestead", "Estate", "Gardens"])}`, province: owner.province, district: owner.district, size: D(size), sizeUnit: rnd() > 0.85 ? "ACRES" : "HECTARES", farmingType: size > 40 ? "COMMERCIAL" : size > 8 ? "EMERGENT" : "SMALLHOLDER", createdAt: daysAgo(int(30, 320)) },
    });
    farms.push({ id: farm.id, ownerId: owner.id, province: owner.province, district: owner.district, name: farm.name });
    const fids: string[] = [];
    for (let f = 0; f < (size > 5 ? 2 : 1); f++) {
      fids.push((await prisma.farmField.create({ data: { farmId: farm.id, name: `Field ${f + 1}`, area: D(round2(size / (size > 5 ? 2 : 1))), irrigation: rnd() > 0.8 ? "IRRIGATED" : "RAINFED", status: "PLANTED" } })).id);
    }
    fieldsByFarm.set(farm.id, fids);
  }
  let cropCount = 5;
  const otherFarms = farms.slice(2);
  while (cropCount < 40) {
    const farm = otherFarms[cropCount % otherFarms.length]!;
    const cropName = pick(cropPool);
    const harvested = rnd() > 0.45;
    const plant = harvested ? day(`2025-${pick(["11", "12"])}-${String(int(1, 28)).padStart(2, "0")}`) : day(`2026-${pick(["09", "10", "11"])}-${String(int(1, 28)).padStart(2, "0")}`);
    const harvest = new Date(plant.getTime() + int(110, 150) * 86400_000);
    const est = int(800, 9000);
    await prisma.cropRecord.create({
      data: {
        farmId: farm.id,
        fieldId: pick(fieldsByFarm.get(farm.id)!),
        cropId: crops[cropName]!,
        plantingDate: plant,
        expectedHarvestDate: harvest,
        status: harvested ? "HARVESTED" : plant > now ? "PLANNED" : "GROWING",
        growthStage: harvested ? "HARVESTED" : plant > now ? "PLANNED" : pick(["GERMINATION", "VEGETATIVE"] as const),
        estimatedYield: D(est),
        actualHarvest: harvested ? D(Math.round(est * (0.75 + rnd() * 0.35))) : null,
        yieldUnit: "KG",
      },
    });
    cropCount++;
  }

  // ───────── demo farmer: activities, tasks, notes, finances ─────────
  const acts: [string, ActivityType, string, number | null, string | null, number | null, string, string?][] = [
    ["2025-10-25", "LAND_PREPARATION", choma.id, null, null, 2400, "Ripping Field A and B with hired oxen team", fA.id],
    ["2025-12-02", "PLANTING", choma.id, 75, "kg seed", 4125, "Planted SC 513 at 75 × 25 cm with basal Compound D", fA.id],
    ["2025-12-02", "FERTILIZER_APPLICATION", choma.id, 24, "50 kg bags Compound D", 21600, "Basal dressing", fA.id],
    ["2025-12-12", "PLANTING", choma.id, 160, "kg seed", 4800, "Soybean Safari, inoculated", fB.id],
    ["2026-01-14", "FERTILIZER_APPLICATION", choma.id, 24, "50 kg bags Urea", 22800, "Top-dressing (delayed by rains)", fA.id],
    ["2026-01-20", "WEED_MANAGEMENT", choma.id, null, null, 3000, "Second weeding, 6 casual workers × 2 days", fA.id],
    ["2026-01-28", "PEST_MANAGEMENT", choma.id, null, null, 950, "Scouted for fall armyworm; spot treatment on ~10% of plants with a registered product per label", fA.id],
    ["2026-04-22", "HARVESTING", choma.id, 342, "50 kg bags", 6500, "Harvest and shelling", fA.id],
    ["2026-04-28", "STORAGE", choma.id, 342, "50 kg bags", 2600, "Hermetic bags + pallets in home store", fA.id],
    ["2026-09-12", "PLANTING", kalomo.id, 1, "ha transplanted", 3200, "Transplanted Tengeru 97 seedlings", fC.id],
    ["2026-10-02", "IRRIGATION", kalomo.id, 18, "hours pumping", 1100, "Drip schedule every 2 days", fC.id],
    ["2026-10-20", "LAND_PREPARATION", choma.id, null, null, 2600, "Ripping lines for 2026/27 season", fA.id],
    ["2026-10-30", "INSPECTION", kalomo.id, null, null, null, "Leaf curl on a few plants; monitoring", fC.id],
  ];
  const actCat: Partial<Record<ActivityType, TransactionCategory>> = { LAND_PREPARATION: "LABOUR", PLANTING: "SEEDS", FERTILIZER_APPLICATION: "FERTILIZER", IRRIGATION: "IRRIGATION", WEED_MANAGEMENT: "LABOUR", PEST_MANAGEMENT: "CHEMICALS", HARVESTING: "LABOUR", STORAGE: "STORAGE" };
  for (const [date, type, farmId, qty, unit, cost, notes, fieldId] of acts) {
    const cropRecordId = farmId === kalomo.id ? tomatoes.id : date < "2026-06-01" ? (fieldId === fB.id ? prevSoy.id : prevMaize.id) : null;
    const a = await prisma.farmActivity.create({ data: { userId: demoFarmer.id, farmId, fieldId, cropRecordId, type, date: day(date), quantity: qty !== null ? D(qty) : null, unit, cost: cost !== null ? D(cost) : null, notes } });
    if (cost) {
      await prisma.farmTransaction.create({ data: { userId: demoFarmer.id, farmId, fieldId, cropRecordId, activityId: a.id, type: "EXPENSE", category: actCat[type] ?? "OTHER_EXPENSE", amount: D(cost), date: day(date), description: `Activity: ${notes}`, isDemo: true } });
    }
  }
  const extraTx: [string, "INCOME" | "EXPENSE", TransactionCategory, number, string, string | null][] = [
    ["2025-11-20", "EXPENSE", "TRANSPORT", 1800, "Transport of inputs from Choma town", null],
    ["2026-02-15", "EXPENSE", "FUEL", 1200, "Fuel for knapsack sprayer trips and motorbike", null],
    ["2026-05-18", "INCOME", "PRODUCE_SALE", 51300, "Sold 150 × 50 kg maize to local aggregator (K342/bag)", prevMaize.id],
    ["2026-05-30", "INCOME", "PRODUCE_SALE", 49200, "Sold 4.1 t soybeans to Choma Farmers Cooperative", prevSoy.id],
    ["2026-07-10", "INCOME", "OTHER_INCOME", 3500, "Hired out oxen for ripping", null],
    ["2026-08-05", "EXPENSE", "EQUIPMENT", 6800, "Drip irrigation kit (Kalomo plot)", null],
    ["2026-09-08", "EXPENSE", "SEEDS", 1400, "Tomato seedlings", tomatoes.id],
    ["2026-10-14", "EXPENSE", "CHEMICALS", 780, "Registered insecticide for Tuta absoluta (per label)", tomatoes.id],
    ["2026-10-25", "EXPENSE", "LABOUR", 2100, "Staking and pruning tomatoes", tomatoes.id],
  ];
  for (const [date, type, category, amount, description, cropRecordId] of extraTx) {
    await prisma.farmTransaction.create({ data: { userId: demoFarmer.id, farmId: cropRecordId === tomatoes.id ? kalomo.id : choma.id, cropRecordId, type, category, amount: D(amount), date: day(date), description, isDemo: true } });
  }
  await prisma.financialRecord.createMany({
    data: [
      { userId: demoFarmer.id, farmId: choma.id, cropRecordId: newMaize.id, type: "ESTIMATED_COST", category: "FERTILIZER", amount: D(31000), season: "2026/27", description: "Compound D + Urea for 2 ha maize" },
      { userId: demoFarmer.id, farmId: choma.id, cropRecordId: newMaize.id, type: "ESTIMATED_COST", category: "SEEDS", amount: D(2900), season: "2026/27" },
      { userId: demoFarmer.id, farmId: choma.id, cropRecordId: newMaize.id, type: "ESTIMATED_REVENUE", category: "PRODUCE_SALE", amount: D(84000), season: "2026/27", description: "240 bags × K350 (assumption)" },
      { userId: demoFarmer.id, farmId: kalomo.id, cropRecordId: tomatoes.id, type: "ESTIMATED_REVENUE", category: "PRODUCE_SALE", amount: D(126000), season: "2026/27", description: "900 crates × K140 (assumption)" },
    ],
  });
  const taskSeeds: [string, string, ActivityType, string | null][] = [
    [ymd(daysAgo(-2)), "Scout tomatoes for Tuta absoluta and leaf curl", "INSPECTION", kalomo.id],
    [ymd(daysAgo(-5)), "Buy Compound D and Urea before prices rise", "FERTILIZER_APPLICATION", choma.id],
    [ymd(daysAgo(-9)), "Check rain gauge; plant when ~25–30 mm received", "PLANTING", choma.id],
    [ymd(daysAgo(-14)), "Service knapsack sprayer", "OTHER", choma.id],
    [ymd(daysAgo(3)), "Clean grain store and fumigate empty store (per label)", "STORAGE", choma.id],
  ];
  for (const [date, title, type, farmId] of taskSeeds) {
    await prisma.farmTask.create({ data: { userId: demoFarmer.id, farmId, title, type, dueDate: day(date), status: date < ymd(now) ? "DONE" : "PENDING", completedAt: date < ymd(now) ? daysAgo(2) : null } });
  }
  await prisma.farmTask.create({ data: { userId: demoFarmer.id, farmId: kalomo.id, cropRecordId: tomatoes.id, title: "Expected Tomatoes harvest", type: "HARVESTING", dueDate: day("2026-12-05"), source: "SYSTEM" } });
  await prisma.farmNote.create({ data: { userId: demoFarmer.id, farmId: choma.id, title: "Lessons from 2025/26", body: "Top-dressing was 2 weeks late because of heavy rain. Next season: buy urea early and split application. Soy yield fell short due to pod shattering; harvest earlier." } });

  // ───────── inventory (farmer + supplier) ─────────
  async function invItem(ownerId: string, name: string, category: Prisma.InventoryItemCreateInput["category"], unit: string, opening: number, unitCost: number | null, min: number, moves: number[], farmId?: string, expiry?: Date) {
    const item = await prisma.inventoryItem.create({ data: { ownerId, farmId, name, category, unit, quantity: D(0), unitCost: unitCost !== null ? D(unitCost) : null, minStockLevel: D(min), storageLocation: farmId ? "Farm store" : "Warehouse", expiryDate: expiry } });
    let bal = 0;
    for (const [i, q] of [opening, ...moves].entries()) {
      bal = round2(bal + q);
      await prisma.inventoryMovement.create({ data: { itemId: item.id, actorId: ownerId, type: i === 0 ? "ADDITION" : q > 0 ? "PURCHASE" : "USAGE", quantityChange: D(q), balanceAfter: D(bal), unitCost: unitCost !== null ? D(unitCost) : null, reason: i === 0 ? "Opening stock" : q > 0 ? "Restocked" : "Used on farm", createdAt: daysAgo(120 - i * 15) } });
    }
    await prisma.inventoryItem.update({ where: { id: item.id }, data: { quantity: D(bal) } });
    return item;
  }
  await invItem(demoFarmer.id, "Hybrid maize seed SC 513 (25 kg)", "SEEDS", "bag", 4, 1450, 2, [-2, 1], choma.id);
  await invItem(demoFarmer.id, "Compound D (50 kg)", "FERTILIZER", "bag", 10, 900, 12, [-4], choma.id);
  await invItem(demoFarmer.id, "Urea (50 kg)", "FERTILIZER", "bag", 6, 950, 10, [-3], choma.id);
  await invItem(demoFarmer.id, "Shelled maize (50 kg bags)", "HARVESTED_PRODUCE", "bag", 342, 330, 0, [-150, -40], choma.id);
  await invItem(demoFarmer.id, "Hermetic storage bags", "TOOLS", "unit", 60, 45, 20, [-38], choma.id);
  await invItem(demoFarmer.id, "Insecticide for Tuta absoluta (registered, 1 L)", "PESTICIDE", "litre", 2, 390, 1, [-1], kalomo.id, day("2027-08-30"));

  // Supplier products (20)
  const PRODUCTS: [number, string, string, string, QuantityUnit, number, number, string | null][] = [
    [0, "seeds", "SC 513 hybrid maize seed (25 kg)", "Demo SeedCo", "BAG_25KG", 1450, 220, null],
    [0, "seeds", "Safari soybean seed (50 kg)", "Demo Seeds", "BAG_50KG", 2350, 80, null],
    [0, "fertilizer", "Compound D basal fertilizer (50 kg)", "Demo Fert", "BAG_50KG", 920, 400, null],
    [0, "fertilizer", "Urea 46% N top-dressing (50 kg)", "Demo Fert", "BAG_50KG", 960, 9, null],
    [0, "crop-protection", "Fall armyworm insecticide (1 L)", "Demo AgroChem", "LITRE", 420, 45, "Toxic if swallowed. Wear gloves, mask and long sleeves. Do not spray in wind. Observe the pre-harvest interval on the label. Keep away from children and water sources."],
    [1, "seeds", "Groundnut seed MGV-5 (kg)", "Demo Seeds", "KG", 38, 600, null],
    [1, "seeds", "Bean seed (kg)", "Demo Seeds", "KG", 45, 300, null],
    [1, "fertilizer", "Gypsum for groundnuts (50 kg)", "Demo Minerals", "BAG_50KG", 310, 120, null],
    [1, "fertilizer", "Agricultural lime (50 kg)", "Demo Minerals", "BAG_50KG", 180, 15, null],
    [2, "tools", "Hand hoe (forged)", "Demo Tools", "UNIT", 120, 150, null],
    [2, "equipment", "16 L knapsack sprayer", "Demo Equip", "UNIT", 850, 25, null],
    [2, "tools", "Hermetic grain bags (pack of 10)", "Demo Storage", "BOX", 380, 60, null],
    [2, "animal-feed", "Broiler starter feed (50 kg)", "Demo Feeds", "BAG_50KG", 640, 8, null],
    [3, "irrigation", "Drip kit, 0.25 ha", "Demo Irrigation", "UNIT", 6800, 12, null],
    [3, "irrigation", "Treadle pump", "Demo Irrigation", "UNIT", 2400, 6, null],
    [3, "irrigation", "Solar water pump kit", "Demo Solar", "UNIT", 15500, 3, null],
    [4, "equipment", "Ox-drawn ripper", "Demo Implements", "UNIT", 2900, 10, null],
    [4, "equipment", "Maize sheller (manual)", "Demo Implements", "UNIT", 1750, 7, null],
    [4, "crop-protection", "Grain storage protectant dust (kg)", "Demo AgroChem", "KG", 95, 40, "Use only on stored grain as directed on label. Wear gloves and a dust mask. Do not use on grain intended for immediate consumption before the label waiting period."],
    [4, "tools", "Moisture meter (grain)", "Demo Instruments", "UNIT", 3200, 4, null],
  ];
  const products: { id: string; supplierId: string; price: number; name: string; unit: QuantityUnit; invId: string; catSlug: string }[] = [];
  for (const [si, slug, name, brand, unit, price, stock, safety] of PRODUCTS) {
    const sup = suppliers[si]!;
    const minLevel = Math.max(5, Math.round(stock * 0.2));
    const inv = await invItem(sup.id, name, slug === "seeds" ? "SEEDS" : slug === "fertilizer" ? "FERTILIZER" : slug === "crop-protection" ? "PESTICIDE" : slug === "irrigation" ? "IRRIGATION" : slug === "animal-feed" ? "FEED" : slug === "tools" ? "TOOLS" : "EQUIPMENT", unit.toLowerCase(), stock + 10, null, minLevel, [-10]);
    const p = await prisma.supplierProduct.create({
      data: { supplierId: sup.id, categoryId: cats[slug]!, inventoryItemId: inv.id, name, brand, unit, price: D(price), description: `Fictional demo product: ${name}.`, safetyInfo: safety, registrationNumber: safety ? `DEMO-REG-${int(1000, 9999)}` : null, verification: safety && rnd() > 0.5 ? "VERIFIED" : "UNVERIFIED", isDemo: true },
    });
    products.push({ id: p.id, supplierId: sup.id, price, name, unit, invId: inv.id, catSlug: slug });
  }

  // ───────── listings (30) ─────────
  const LISTING_TEMPLATES: [string, string, QuantityUnit, [number, number], [number, number]][] = [
    ["Maize", "White maize, sun-dried, 12.5% moisture", "BAG_50KG", [280, 380], [40, 600]],
    ["Soybeans", "Clean soybeans, bagged", "KG", [10, 14], [1000, 20000]],
    ["Groundnuts", "Shelled groundnuts, hand-sorted", "KG", [18, 26], [200, 3000]],
    ["Beans", "Sugar beans, new season", "KG", [25, 35], [100, 2000]],
    ["Sunflower", "Sunflower seed for oil pressing", "KG", [8, 11], [500, 8000]],
    ["Rice", "Mongu rice, paddy-cleaned", "KG", [20, 28], [200, 3000]],
    ["Tomatoes", "Fresh tomatoes, firm and ripe", "CRATE", [120, 220], [20, 200]],
    ["Vegetables", "Rape and cabbage, mixed bundles", "KG", [8, 15], [100, 800]],
    ["Wheat", "Irrigated wheat, milling grade", "TONNE", [6500, 8500], [5, 60]],
    ["Cassava", "Dried cassava chips", "KG", [5, 8], [500, 5000]],
  ];
  const listings: { id: string; farmerId: string; price: number; unit: QuantityUnit; title: string; cropId: string; farmId: string; qty: number }[] = [];
  // Demo farmer's listings
  const dfl = [
    await prisma.produceListing.create({ data: { farmerId: demoFarmer.id, farmId: choma.id, cropId: crops.Maize!, title: "White maize, SC 513, 50 kg bags", variety: "SC 513", quantityAvailable: D(152), totalQuantity: D(152), unit: "BAG_50KG", pricePerUnit: D(350), minOrderQuantity: D(10), province: "SOUTHERN", district: "Choma", pickupLocation: "Mwale Family Farm store, Choma", qualityGrade: "GRADE_A", harvestDate: day("2026-04-22"), description: "Dried to about 12.5% moisture and stored in hermetic bags. Clean, free of weevils. Buyer can inspect before loading.", status: "ACTIVE", moderationStatus: "APPROVED", isDemo: true, createdAt: daysAgo(20) } }),
    await prisma.produceListing.create({ data: { farmerId: demoFarmer.id, farmId: kalomo.id, cropId: crops.Tomatoes!, title: "Fresh Tengeru tomatoes (pre-order for December)", variety: "Tengeru 97", quantityAvailable: D(300), totalQuantity: D(300), unit: "CRATE", pricePerUnit: D(150), province: "SOUTHERN", district: "Kalomo", pickupLocation: "Kalomo River Plot", qualityGrade: "GRADE_A", harvestDate: day("2026-12-05"), description: "Drip-irrigated tomatoes, harvest from early December. Pre-orders welcome.", status: "ACTIVE", moderationStatus: "PENDING_REVIEW", isDemo: true, createdAt: daysAgo(3) } }),
  ];
  dfl.forEach((l) => listings.push({ id: l.id, farmerId: demoFarmer.id, price: Number(l.pricePerUnit), unit: l.unit, title: l.title, cropId: l.cropId, farmId: l.farmId!, qty: Number(l.quantityAvailable) }));
  for (let i = 0; i < 28; i++) {
    const farm = otherFarms[i % otherFarms.length]!;
    const [cropName, title, unit, [pmin, pmax], [qmin, qmax]] = LISTING_TEMPLATES[i % LISTING_TEMPLATES.length]!;
    const price = round2(pmin + rnd() * (pmax - pmin));
    const qty = int(qmin, qmax);
    const l = await prisma.produceListing.create({
      data: {
        farmerId: farm.ownerId,
        farmId: farm.id,
        cropId: crops[cropName]!,
        title,
        quantityAvailable: D(qty),
        totalQuantity: D(qty),
        unit,
        pricePerUnit: D(price),
        province: farm.province,
        district: farm.district,
        pickupLocation: `${farm.name}, ${farm.district}`,
        qualityGrade: pick(["GRADE_A", "GRADE_B", "UNGRADED"] as const),
        harvestDate: daysAgo(int(10, 200)),
        description: `Fictional demo listing from ${farm.name}.`,
        status: "ACTIVE",
        moderationStatus: i % 9 === 0 ? "PENDING_REVIEW" : i === 13 ? "FLAGGED" : "APPROVED",
        isDemo: true,
        createdAt: daysAgo(int(1, 90)),
      },
    });
    listings.push({ id: l.id, farmerId: farm.ownerId, price, unit, title, cropId: l.cropId, farmId: farm.id, qty });
  }

  // ───────── orders (15) with negotiations, events and deliveries (10) ─────────
  const FLOW: OrderStatus[] = ["PENDING", "ACCEPTED", "CONFIRMED", "PROCESSING", "READY_FOR_PICKUP", "IN_TRANSIT", "DELIVERED", "COMPLETED"];
  let orderSeq = 1;
  async function makeOrder(o: { type: "PRODUCE" | "INPUT"; buyerId: string; sellerId: string; status: OrderStatus; desc: string; qty: number; price: number; unit: QuantityUnit; listingId?: string; productId?: string; daysBack: number; negotiated?: { offers: [string, number, number, string][] }; cancelReason?: string }) {
    const created = daysAgo(o.daysBack);
    const total = D(round2(o.qty * o.price));
    const reached = o.status === "CANCELLED" || o.status === "REJECTED" || o.status === "DISPUTED" || o.status === "NEGOTIATING" ? [] : FLOW.slice(0, FLOW.indexOf(o.status) + 1);
    const order = await prisma.purchaseOrder.create({
      data: {
        orderNumber: `${o.type === "PRODUCE" ? "AF" : "IN"}-DEMO-${String(orderSeq++).padStart(4, "0")}`,
        type: o.type,
        buyerId: o.buyerId,
        sellerId: o.sellerId,
        status: o.status,
        subtotal: total,
        total,
        deliveryAddress: "Buyer warehouse (demo address)",
        isDemo: true,
        stockReserved: ["CONFIRMED", "PROCESSING", "READY_FOR_PICKUP", "IN_TRANSIT", "DELIVERED", "COMPLETED", "DISPUTED"].includes(o.status),
        acceptedAt: reached.includes("ACCEPTED") ? new Date(created.getTime() + 86400_000) : null,
        confirmedAt: reached.includes("CONFIRMED") ? new Date(created.getTime() + 2 * 86400_000) : null,
        completedAt: o.status === "COMPLETED" ? new Date(created.getTime() + 9 * 86400_000) : null,
        cancelledAt: o.status === "CANCELLED" ? new Date(created.getTime() + 86400_000) : null,
        cancelReason: o.cancelReason,
        createdAt: created,
        items: { create: { listingId: o.listingId, supplierProductId: o.productId, description: o.desc, quantity: D(o.qty), unit: o.unit, unitPrice: D(o.price), lineTotal: total } },
      },
    });
    let prev: OrderStatus | null = null;
    for (const [i, st] of (reached.length ? reached : ["PENDING" as OrderStatus, o.status]).entries()) {
      await prisma.orderEvent.create({ data: { orderId: order.id, actorId: st === "PENDING" || st === "CONFIRMED" || st === "COMPLETED" ? o.buyerId : o.sellerId, fromStatus: prev, toStatus: st, note: i === 0 ? "Purchase request submitted" : o.cancelReason && st === "CANCELLED" ? o.cancelReason : null, createdAt: new Date(created.getTime() + i * 86400_000) } });
      prev = st;
    }
    if (o.negotiated) {
      for (const [i, [by, price, qty, msg]] of o.negotiated.offers.entries()) {
        const last = i === o.negotiated.offers.length - 1;
        await prisma.negotiation.create({ data: { orderId: order.id, offeredById: by, pricePerUnit: D(price), quantity: D(qty), message: msg, isInitial: i === 0, status: last ? (o.status === "NEGOTIATING" ? "OPEN" : "ACCEPTED") : "SUPERSEDED", createdAt: new Date(created.getTime() + i * 3600_000) } });
      }
    } else if (o.type === "PRODUCE") {
      await prisma.negotiation.create({ data: { orderId: order.id, offeredById: o.buyerId, pricePerUnit: D(o.price), quantity: D(o.qty), isInitial: true, status: o.status === "PENDING" ? "OPEN" : o.status === "REJECTED" ? "REJECTED" : "ACCEPTED", createdAt: created } });
    }
    const conv = await prisma.conversation.create({ data: { subject: `Order ${order.orderNumber}`, orderId: order.id, listingId: o.listingId, participants: { create: [{ userId: o.buyerId, lastReadAt: now }, { userId: o.sellerId }] }, createdAt: created } });
    await prisma.message.create({ data: { conversationId: conv.id, senderId: o.buyerId, body: "Hello, is the quantity still available? We can collect within the week.", createdAt: created } });
    if (o.status !== "PENDING") await prisma.message.create({ data: { conversationId: conv.id, senderId: o.sellerId, body: "Yes, it is available. Let me know when your truck is coming.", createdAt: new Date(created.getTime() + 3 * 3600_000) } });
    if (o.status === "COMPLETED") {
      if (o.type === "PRODUCE") {
        const l = listings.find((x) => x.id === o.listingId);
        await prisma.farmTransaction.create({ data: { userId: o.sellerId, farmId: l?.farmId, orderId: order.id, type: "INCOME", category: "PRODUCE_SALE", amount: total, date: order.completedAt!, description: `Marketplace sale ${order.orderNumber}: ${o.desc}`, isDemo: true } });
      } else {
        await prisma.farmTransaction.create({ data: { userId: o.buyerId, orderId: order.id, type: "EXPENSE", category: "FERTILIZER", amount: total, date: order.completedAt!, description: `Input purchase ${order.orderNumber}: ${o.desc}`, isDemo: true } });
      }
    }
    if (order.stockReserved && o.listingId) await prisma.produceListing.update({ where: { id: o.listingId }, data: { quantityAvailable: { decrement: o.qty } } });
    return order;
  }

  const L = (i: number) => listings[i]!;
  const demoBuyer = buyers[0]!;
  const orders = [
    // Demo farmer's maize: a new request waiting for a response (Workflow C) and a negotiation in progress
    await makeOrder({ type: "PRODUCE", buyerId: demoBuyer.id, sellerId: demoFarmer.id, status: "PENDING", desc: L(0).title, qty: 40, price: 350, unit: "BAG_50KG", listingId: L(0).id, daysBack: 1 }),
    await makeOrder({ type: "PRODUCE", buyerId: buyers[3]!.id, sellerId: demoFarmer.id, status: "NEGOTIATING", desc: L(0).title, qty: 60, price: 320, unit: "BAG_50KG", listingId: L(0).id, daysBack: 2, negotiated: { offers: [[buyers[3]!.id, 320, 60, "We can take 60 bags at K320."], [demoFarmer.id, 345, 60, "Grade A, dried and clean. Best I can do is K345."]] } }),
    await makeOrder({ type: "PRODUCE", buyerId: buyers[1]!.id, sellerId: demoFarmer.id, status: "COMPLETED", desc: "White maize, SC 513, 50 kg bags", qty: 40, price: 340, unit: "BAG_50KG", listingId: L(0).id, daysBack: 60 }),
    await makeOrder({ type: "PRODUCE", buyerId: demoBuyer.id, sellerId: L(2).farmerId, status: "IN_TRANSIT", desc: L(2).title, qty: Math.min(500, L(2).qty), price: L(2).price, unit: L(2).unit, listingId: L(2).id, daysBack: 6 }),
    await makeOrder({ type: "PRODUCE", buyerId: demoBuyer.id, sellerId: L(3).farmerId, status: "CONFIRMED", desc: L(3).title, qty: Math.min(300, L(3).qty), price: L(3).price, unit: L(3).unit, listingId: L(3).id, daysBack: 4 }),
    await makeOrder({ type: "PRODUCE", buyerId: demoBuyer.id, sellerId: L(4).farmerId, status: "COMPLETED", desc: L(4).title, qty: Math.min(200, L(4).qty), price: L(4).price, unit: L(4).unit, listingId: L(4).id, daysBack: 45 }),
    await makeOrder({ type: "PRODUCE", buyerId: buyers[2]!.id, sellerId: L(5).farmerId, status: "DELIVERED", desc: L(5).title, qty: Math.min(400, L(5).qty), price: L(5).price, unit: L(5).unit, listingId: L(5).id, daysBack: 10 }),
    await makeOrder({ type: "PRODUCE", buyerId: buyers[4]!.id, sellerId: L(6).farmerId, status: "READY_FOR_PICKUP", desc: L(6).title, qty: Math.min(30, L(6).qty), price: L(6).price, unit: L(6).unit, listingId: L(6).id, daysBack: 5 }),
    await makeOrder({ type: "PRODUCE", buyerId: buyers[5]!.id, sellerId: L(7).farmerId, status: "PROCESSING", desc: L(7).title, qty: Math.min(100, L(7).qty), price: L(7).price, unit: L(7).unit, listingId: L(7).id, daysBack: 3 }),
    await makeOrder({ type: "PRODUCE", buyerId: buyers[6]!.id, sellerId: L(9).farmerId, status: "CANCELLED", desc: L(9).title, qty: Math.min(50, L(9).qty), price: L(9).price, unit: L(9).unit, listingId: L(9).id, daysBack: 20, cancelReason: "Buyer found closer supply" }),
    await makeOrder({ type: "PRODUCE", buyerId: buyers[7]!.id, sellerId: L(10).farmerId, status: "COMPLETED", desc: L(10).title, qty: Math.min(800, L(10).qty), price: L(10).price, unit: L(10).unit, listingId: L(10).id, daysBack: 90 }),
    // Input orders
    await makeOrder({ type: "INPUT", buyerId: demoFarmer.id, sellerId: products[2]!.supplierId, status: "COMPLETED", desc: products[2]!.name, qty: 24, price: products[2]!.price, unit: products[2]!.unit, productId: products[2]!.id, daysBack: 50 }),
    await makeOrder({ type: "INPUT", buyerId: demoFarmer.id, sellerId: products[3]!.supplierId, status: "PENDING", desc: products[3]!.name, qty: 10, price: products[3]!.price, unit: products[3]!.unit, productId: products[3]!.id, daysBack: 1 }),
    await makeOrder({ type: "INPUT", buyerId: farmers[4]!.id, sellerId: products[0]!.supplierId, status: "CONFIRMED", desc: products[0]!.name, qty: 8, price: products[0]!.price, unit: products[0]!.unit, productId: products[0]!.id, daysBack: 3 }),
    await makeOrder({ type: "INPUT", buyerId: farmers[7]!.id, sellerId: products[13]!.supplierId, status: "COMPLETED", desc: products[13]!.name, qty: 1, price: products[13]!.price, unit: products[13]!.unit, productId: products[13]!.id, daysBack: 30 }),
  ];

  const DFLOW: DeliveryStatus[] = ["REQUESTED", "ACCEPTED", "PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"];
  let dseq = 1;
  async function makeDelivery(d: { orderIdx?: number; requester: string; transporter: string | null; status: DeliveryStatus; cargo: string; from: [Province, string]; to: [Province, string]; fee?: number; daysBack: number; kg?: number }) {
    const created = daysAgo(d.daysBack);
    const reached = DFLOW.slice(0, DFLOW.indexOf(d.status) + 1);
    const t = d.transporter ? await prisma.vehicle.findFirst({ where: { ownerId: d.transporter } }) : null;
    const del = await prisma.delivery.create({
      data: {
        deliveryNumber: `DL-DEMO-${String(dseq++).padStart(4, "0")}`,
        orderId: d.orderIdx !== undefined ? orders[d.orderIdx]!.id : null,
        requestedById: d.requester,
        transporterId: d.status === "REQUESTED" ? (d.transporter ?? null) : d.transporter,
        vehicleId: d.status !== "REQUESTED" ? t?.id : null,
        cargoDescription: d.cargo,
        weightKg: d.kg,
        pickupLocation: `${d.from[1]} (demo pickup point)`,
        pickupProvince: d.from[0],
        pickupDistrict: d.from[1],
        dropoffLocation: `${d.to[1]} (demo warehouse)`,
        dropoffProvince: d.to[0],
        dropoffDistrict: d.to[1],
        fee: d.fee ? D(d.fee) : null,
        expectedDate: new Date(created.getTime() + 4 * 86400_000),
        status: d.status,
        pickedUpAt: reached.includes("PICKED_UP") ? new Date(created.getTime() + 2 * 86400_000) : null,
        deliveredAt: d.status === "DELIVERED" ? new Date(created.getTime() + 3 * 86400_000) : null,
        proofRecipient: d.status === "DELIVERED" ? "Warehouse supervisor (demo)" : null,
        proofNotes: d.status === "DELIVERED" ? "All bags received in good condition." : null,
        isDemo: true,
        createdAt: created,
      },
    });
    for (const [i, st] of reached.entries()) await prisma.deliveryEvent.create({ data: { deliveryId: del.id, actorId: i === 0 ? d.requester : d.transporter, status: st, createdAt: new Date(created.getTime() + i * 12 * 3600_000) } });
  }
  const T = transporters.map((t) => t.id);
  await makeDelivery({ orderIdx: 3, requester: demoBuyer.id, transporter: T[1]!, status: "IN_TRANSIT", cargo: "Groundnuts, bagged", from: [L(2).farmId ? farms.find((f) => f.id === L(2).farmId)!.province : "EASTERN", farms.find((f) => f.id === L(2).farmId)!.district], to: ["LUSAKA", "Lusaka"], fee: 4200, daysBack: 3, kg: 500 });
  await makeDelivery({ orderIdx: 4, requester: demoBuyer.id, transporter: null, status: "REQUESTED", cargo: "Sugar beans, bagged", from: [farms.find((f) => f.id === L(3).farmId)!.province, farms.find((f) => f.id === L(3).farmId)!.district], to: ["LUSAKA", "Lusaka"], daysBack: 1, kg: 300 });
  await makeDelivery({ orderIdx: 2, requester: buyers[1]!.id, transporter: T[0]!, status: "DELIVERED", cargo: "40 × 50 kg maize", from: ["SOUTHERN", "Choma"], to: ["COPPERBELT", "Ndola"], fee: 6500, daysBack: 55, kg: 2000 });
  await makeDelivery({ orderIdx: 5, requester: demoBuyer.id, transporter: T[0]!, status: "DELIVERED", cargo: "Sunflower seed", from: [farms.find((f) => f.id === L(4).farmId)!.province, farms.find((f) => f.id === L(4).farmId)!.district], to: ["LUSAKA", "Lusaka"], fee: 3800, daysBack: 40, kg: 200 });
  await makeDelivery({ orderIdx: 6, requester: buyers[2]!.id, transporter: T[4]!, status: "DELIVERED", cargo: "Rice, cleaned", from: [farms.find((f) => f.id === L(5).farmId)!.province, farms.find((f) => f.id === L(5).farmId)!.district], to: ["LUSAKA", "Kafue"], fee: 5200, daysBack: 8, kg: 400 });
  await makeDelivery({ orderIdx: 7, requester: buyers[4]!.id, transporter: T[0]!, status: "PICKUP_SCHEDULED", cargo: "Tomatoes, crates", from: [farms.find((f) => f.id === L(6).farmId)!.province, farms.find((f) => f.id === L(6).farmId)!.district], to: ["CENTRAL", "Kabwe"], fee: 1900, daysBack: 2, kg: 900 });
  await makeDelivery({ orderIdx: 8, requester: L(7).farmerId, transporter: T[2]!, status: "ACCEPTED", cargo: "Vegetables, mixed", from: [farms.find((f) => f.id === L(7).farmId)!.province, farms.find((f) => f.id === L(7).farmId)!.district], to: ["LUSAKA", "Lusaka"], fee: 1500, daysBack: 1, kg: 100 });
  await makeDelivery({ orderIdx: 13, requester: farmers[4]!.id, transporter: null, status: "REQUESTED", cargo: "Hybrid maize seed, 8 bags", from: [suppliers[0]!.province, suppliers[0]!.district], to: [farmers[4]!.province, farmers[4]!.district], daysBack: 1, kg: 200 });
  await makeDelivery({ orderIdx: 10, requester: buyers[7]!.id, transporter: T[3]!, status: "DELIVERED", cargo: "Wheat, milling grade", from: [farms.find((f) => f.id === L(10).farmId)!.province, farms.find((f) => f.id === L(10).farmId)!.district], to: ["NORTH_WESTERN", "Solwezi"], fee: 9800, daysBack: 85, kg: 3000 });
  await makeDelivery({ requester: demoFarmer.id, transporter: T[0]!, status: "REQUESTED", cargo: "Fertilizer from Choma town to farm (20 bags)", from: ["SOUTHERN", "Choma"], to: ["SOUTHERN", "Choma"], daysBack: 0, kg: 1000 });

  // ───────── crop health assessments (demo samples) ─────────
  const samples = [
    { cropRecordId: tomatoes.id, crop: "Tomatoes", symptoms: "Upward curling of young leaves with yellow margins on about 5% of plants. Whiteflies seen under leaves.", issue: "Possible tomato yellow leaf curl virus (spread by whiteflies)", conf: "MEDIUM" as const, expert: true, daysBack: 7 },
    { cropRecordId: prevMaize.id, crop: "Maize", symptoms: "Ragged holes in young leaves, sawdust-like droppings in the whorl.", issue: "Likely fall armyworm feeding damage", conf: "HIGH" as const, expert: false, daysBack: 280 },
    { cropRecordId: prevMaize.id, crop: "Maize", symptoms: "Lower leaves yellowing from the tip in a V shape after heavy rain.", issue: "Probable nitrogen deficiency (leaching after heavy rain)", conf: "MEDIUM" as const, expert: false, daysBack: 300 },
  ];
  for (const sm of samples) {
    await prisma.cropHealthAssessment.create({
      data: {
        userId: demoFarmer.id,
        farmId: sm.crop === "Tomatoes" ? kalomo.id : choma.id,
        cropRecordId: sm.cropRecordId,
        cropId: crops[sm.crop]!,
        symptoms: sm.symptoms,
        status: "COMPLETED",
        possibleIssue: sm.issue,
        confidence: sm.conf,
        expertRecommended: sm.expert,
        model: "demo-sample",
        isDemo: true,
        createdAt: daysAgo(sm.daysBack),
        result: {
          possible_issue: sm.issue,
          confidence: sm.conf,
          confidence_explanation: "DEMO SAMPLE (not generated by AI). Based on the described symptoms only. Several causes can look similar.",
          visible_symptoms: [sm.symptoms],
          possible_causes: [{ name: sm.issue, likelihood: sm.conf, why: "Symptoms described match the typical pattern." }],
          next_steps: ["Scout the whole field to estimate how widespread it is.", "Compare with photos in extension guides.", "Ask your camp extension officer to confirm before any chemical treatment."],
          prevention: ["Use certified seed and recommended planting dates.", "Keep fields weed-free and monitor weekly."],
          expert_inspection_recommended: sm.expert,
          safety_note: "Use only products registered for this crop in Zambia, follow the label, and wear protective equipment.",
          image_assessed: false,
        },
      },
    });
  }
  for (let i = 0; i < 6; i++) {
    const f = farmers[1 + i]!;
    await prisma.cropHealthAssessment.create({ data: { userId: f.id, cropId: crops[pick(["Maize", "Soybeans", "Groundnuts"])]!, symptoms: "Demo sample symptoms", status: "COMPLETED", possibleIssue: pick(["Likely fall armyworm feeding damage", "Probable nitrogen deficiency", "Possible grey leaf spot", "Possible groundnut rosette virus"]), confidence: "MEDIUM", model: "demo-sample", isDemo: true, createdAt: daysAgo(int(5, 200)) } });
  }

  // ───────── market prices (DEMO, clearly labelled) ─────────
  const PRICE_BASE: [string, QuantityUnit, number][] = [
    ["Maize", "BAG_50KG", 320],
    ["Soybeans", "KG", 11.5],
    ["Groundnuts", "KG", 21],
    ["Beans", "KG", 29],
    ["Rice", "KG", 23],
    ["Tomatoes", "CRATE", 160],
  ];
  const priceProvinces: Province[] = ["LUSAKA", "SOUTHERN", "EASTERN", "CENTRAL", "COPPERBELT"];
  const pricesData: Prisma.MarketPriceCreateManyInput[] = [];
  for (const [crop, unit, base] of PRICE_BASE) {
    for (const p of priceProvinces) {
      const provAdj = { LUSAKA: 1.08, COPPERBELT: 1.1, SOUTHERN: 0.95, EASTERN: 0.93, CENTRAL: 0.98 }[p as "LUSAKA"] ?? 1;
      for (let m = 11; m >= 0; m--) {
        const d = new Date(now.getFullYear(), now.getMonth() - m, 15);
        const seasonal = 1 + 0.12 * Math.sin(((d.getMonth() + 3) / 12) * 2 * Math.PI); // cheaper after harvest (May–Jul)
        pricesData.push({ cropId: crops[crop]!, province: p, unit, price: D(round2(base * provAdj * seasonal * (0.96 + rnd() * 0.08))), observedOn: d, sourceType: "DEMO", sourceName: "AgriFlow demo dataset (fictional, not real market data)" });
      }
    }
  }
  await prisma.marketPrice.createMany({ data: pricesData });

  // ───────── weather (DEMO samples, never used for real lookups) ─────────
  await prisma.weatherObservation.create({ data: { farmId: choma.id, latitude: D(-16.81), longitude: D(26.95), observedAt: daysAgo(1), temperatureC: D(29.5), humidityPct: D(41), precipitationMm: D(0), windSpeedKmh: D(12), weatherCode: 2, conditions: "Partly cloudy", source: "Demo sample (not a real observation)", isDemo: true } });
  for (let i = 0; i < 7; i++) {
    await prisma.weatherForecast.create({ data: { farmId: choma.id, latitude: D(-16.81), longitude: D(26.95), forecastDate: daysAgo(-i), tempMaxC: D(30 + int(-2, 3)), tempMinC: D(17 + int(-2, 2)), precipitationMm: D(i > 3 ? int(0, 18) : 0), precipitationProbPct: i > 3 ? int(30, 70) : int(0, 15), windMaxKmh: D(int(10, 25)), weatherCode: i > 3 ? 61 : 1, conditions: i > 3 ? "Slight rain" : "Mainly clear", source: "Demo sample (not a real forecast)", isDemo: true } });
  }

  // ───────── notifications, reports, audit ─────────
  await prisma.notification.createMany({
    data: [
      { userId: demoFarmer.id, type: "PURCHASE_REQUEST", title: "New purchase request", body: "A buyer requested 40 × 50 kg bag of White maize at K350.00 per 50 kg bag.", link: `/farmer/orders/${orders[0]!.id}`, createdAt: daysAgo(1) },
      { userId: demoFarmer.id, type: "NEGOTIATION_OFFER", title: `New offer on ${orders[1]!.orderNumber}`, body: "Counteroffer: K320.00 per unit for 60.", link: `/farmer/orders/${orders[1]!.id}`, createdAt: daysAgo(2), readAt: daysAgo(1) },
      { userId: demoFarmer.id, type: "LOW_INVENTORY", title: "Low stock: Compound D (50 kg)", body: "Compound D (50 kg) is down to 6 bag (minimum 12).", link: "/farmer/inventory", createdAt: daysAgo(3) },
      { userId: demoFarmer.id, type: "WEATHER_ALERT", title: "Rains approaching", body: "Check the Weather page: rain is possible later this week. Prepare to plant when soils are moist.", link: "/farmer/weather", createdAt: daysAgo(1) },
      { userId: demoFarmer.id, type: "HARVEST_REMINDER", title: "Tomato harvest in about 4 weeks", body: "Kalomo River Plot: expected harvest 5 December.", link: "/farmer/calendar", createdAt: daysAgo(4), readAt: daysAgo(3) },
      { userId: demoBuyer.id, type: "DELIVERY_UPDATE", title: "Delivery DL-DEMO-0001: In transit", body: "Groundnuts are on the way to Lusaka.", link: "/buyer/deliveries", createdAt: daysAgo(1) },
      { userId: demoBuyer.id, type: "ORDER_UPDATE", title: `Order ${orders[4]!.orderNumber}: Confirmed`, body: "Status changed to Confirmed.", link: `/buyer/orders/${orders[4]!.id}`, createdAt: daysAgo(3) },
      { userId: suppliers[0]!.id, type: "PURCHASE_REQUEST", title: "New purchase order", body: "Order for 10 × Urea 46% N top-dressing (50 kg).", link: `/supplier/orders/${orders[12]!.id}`, createdAt: daysAgo(1) },
      { userId: suppliers[0]!.id, type: "LOW_INVENTORY", title: "Low stock", body: "Urea 46% N top-dressing (50 kg) is below its minimum level.", link: "/supplier/inventory", createdAt: daysAgo(2) },
      { userId: transporters[0]!.id, type: "DELIVERY_REQUEST", title: "New delivery request", body: "Fertilizer from Choma town to farm (20 bags).", link: "/transporter/requests", createdAt: daysAgo(0) },
      { userId: admin.id, type: "MODERATION", title: "Listings awaiting review", body: "New produce listings are pending review.", link: "/admin/marketplace", createdAt: daysAgo(1) },
    ],
  });
  await prisma.contentReport.create({ data: { reporterId: buyers[2]!.id, entityType: "LISTING", entityId: listings[15]!.id, reason: "Price looks unrealistic and the farmer is not responding (demo report)." } });
  await prisma.auditLog.createMany({
    data: [
      { actorId: admin.id, action: "user.verify", entityType: "User", entityId: demoFarmer.id, createdAt: daysAgo(300) },
      { actorId: admin.id, action: "listing.moderate.approved", entityType: "ProduceListing", entityId: listings[0]!.id, createdAt: daysAgo(19) },
      { actorId: demoFarmer.id, action: "listing.create", entityType: "ProduceListing", entityId: listings[1]!.id, createdAt: daysAgo(3) },
      { actorId: demoBuyer.id, action: "order.create", entityType: "PurchaseOrder", entityId: orders[0]!.id, createdAt: daysAgo(1) },
      { actorId: admin.id, action: "listing.moderate.flagged", entityType: "ProduceListing", entityId: listings[15]!.id, metadata: { note: "Price check" }, createdAt: daysAgo(2) },
    ],
  });

  const counts = await Promise.all([
    prisma.user.count({ where: { role: "FARMER" } }),
    prisma.user.count({ where: { role: "BUYER" } }),
    prisma.user.count({ where: { role: "SUPPLIER" } }),
    prisma.user.count({ where: { role: "TRANSPORTER" } }),
    prisma.farm.count(),
    prisma.cropRecord.count(),
    prisma.produceListing.count(),
    prisma.supplierProduct.count(),
    prisma.purchaseOrder.count(),
    prisma.delivery.count(),
    prisma.inventoryMovement.count(),
    prisma.farmTransaction.count(),
  ]);
  console.log(
    `Done. farmers=${counts[0]} buyers=${counts[1]} suppliers=${counts[2]} transporters=${counts[3]} farms=${counts[4]} crops=${counts[5]} listings=${counts[6]} products=${counts[7]} orders=${counts[8]} deliveries=${counts[9]} inventoryMovements=${counts[10]} transactions=${counts[11]}`,
  );
  console.log("Demo logins: demo.farmer@agriflow.demo, demo.buyer@…, demo.supplier@…, demo.transporter@…, demo.admin@…, superadmin@agriflow.demo — password = DEMO_PASSWORD");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
