/** Zod schemas shared by client forms and server actions. Server actions always re-validate. */
import { z } from "zod";

const PROVINCE = z.enum([
  "LUSAKA",
  "COPPERBELT",
  "SOUTHERN",
  "CENTRAL",
  "EASTERN",
  "NORTHERN",
  "LUAPULA",
  "MUCHINGA",
  "WESTERN",
  "NORTH_WESTERN",
]);
export const provinceSchema = PROVINCE;

const UNIT = z.enum(["KG", "TONNE", "BAG_50KG", "BAG_25KG", "BAG_10KG", "CRATE", "LITRE", "BALE", "UNIT", "BOX"]);
export const unitSchema = UNIT;

const text = (max: number) => z.string().trim().max(max);
const reqText = (label: string, max = 120) => z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max);
const optText = (max: number) => text(max).optional();
const positive = (label: string) => z.coerce.number({ error: `${label} must be a number` }).positive(`${label} must be greater than 0`).max(1e9);
const nonNeg = (label: string) => z.coerce.number({ error: `${label} must be a number` }).min(0, `${label} cannot be negative`).max(1e10);
const optNonNeg = (label: string) => nonNeg(label).optional();
const dateStr = (label: string) => z.coerce.date({ error: `${label} must be a valid date` });
const optDate = (label: string) => dateStr(label).optional();
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ]{9,15}$/, "Enter a valid phone number, e.g. +260 97 1234567");
const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal(true), z.literal("false"), z.literal(false)])
  .optional()
  .transform((v) => v === "on" || v === "true" || v === true);

// ── Auth ──
export const registerSchema = z.object({
  fullName: reqText("Full name", 100),
  email: z.email("Enter a valid email address").trim().toLowerCase().max(160),
  phone: phone.optional(),
  password: z.string().min(8, "At least 8 characters").max(128).regex(/[A-Za-z]/, "Include a letter").regex(/[0-9]/, "Include a number"),
  role: z.enum(["FARMER", "BUYER", "SUPPLIER", "TRANSPORTER"], { error: "Choose an account type" }),
  consent: checkbox.refine((v) => v === true, "You must agree to the privacy notice to create an account"),
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(1, "Password is required").max(128),
});

export const forgotSchema = z.object({ email: z.email("Enter a valid email address").trim().toLowerCase() });
export const resetSchema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(8, "At least 8 characters").max(128).regex(/[A-Za-z]/, "Include a letter").regex(/[0-9]/, "Include a number"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

// ── Onboarding ──
export const onboardingBaseSchema = z.object({
  fullName: reqText("Full name", 100),
  phone: phone.optional(),
  province: PROVINCE,
  district: reqText("District", 60),
});
export const farmerOnboardingSchema = onboardingBaseSchema.extend({
  experienceYears: z.coerce.number().int().min(0).max(80).optional(),
  farmingType: z.enum(["SMALLHOLDER", "COMMERCIAL", "EMERGENT", "COOPERATIVE", "ORGANIC", "MIXED"]),
  mainCrops: z.array(z.string().max(40)).max(12).default([]),
  farmName: optText(100),
  farmSize: z.coerce.number().positive().max(1e6).optional(),
  sizeUnit: z.enum(["HECTARES", "ACRES"]).default("HECTARES"),
});
export const buyerOnboardingSchema = onboardingBaseSchema.extend({
  businessName: optText(120),
  buyerType: optText(60),
  preferredCrops: z.array(z.string().max(40)).max(12).default([]),
});
export const supplierOnboardingSchema = onboardingBaseSchema.extend({
  businessName: reqText("Business name", 120),
  registrationNumber: optText(60),
  description: optText(600),
  categories: z.array(z.string().max(60)).max(12).default([]),
});
export const transporterOnboardingSchema = onboardingBaseSchema.extend({
  businessName: reqText("Business name", 120),
  contactPhone: phone.optional(),
  pricingModel: z.enum(["PER_KM", "PER_TONNE", "PER_TRIP", "NEGOTIABLE"]).default("NEGOTIABLE"),
  baseRate: optNonNeg("Base rate"),
  serviceProvinces: z.array(PROVINCE).min(1, "Choose at least one service province"),
});

// ── Farms ──
export const farmSchema = z
  .object({
    name: reqText("Farm name", 100),
    province: PROVINCE,
    district: reqText("District", 60),
    location: optText(160),
    size: positive("Farm size"),
    sizeUnit: z.enum(["HECTARES", "ACRES"]).default("HECTARES"),
    description: optText(1000),
    farmingType: z.enum(["SMALLHOLDER", "COMMERCIAL", "EMERGENT", "COOPERATIVE", "ORGANIC", "MIXED"]).default("SMALLHOLDER"),
    latitude: z.coerce.number().min(-18.2).max(-8.1, "Latitude must be within Zambia (−8.1 to −18.2)").optional(),
    longitude: z.coerce.number().min(21.9).max(33.8, "Longitude must be within Zambia (21.9 to 33.8)").optional(),
  })
  .refine((v) => (v.latitude === undefined) === (v.longitude === undefined), {
    path: ["longitude"],
    message: "Provide both latitude and longitude, or neither",
  });

export const fieldSchema = z.object({
  farmId: reqText("Farm", 40),
  name: reqText("Field name", 80),
  area: positive("Area"),
  areaUnit: z.enum(["HECTARES", "ACRES"]).default("HECTARES"),
  soilType: optText(80),
  irrigation: z.enum(["RAINFED", "IRRIGATED", "PARTIAL"]).default("RAINFED"),
  status: z.enum(["FALLOW", "PREPARING", "PLANTED", "HARVESTED"]).default("FALLOW"),
  notes: optText(1000),
});

export const cropRecordSchema = z
  .object({
    farmId: reqText("Farm", 40),
    fieldId: optText(40),
    cropId: reqText("Crop", 40),
    variety: optText(80),
    areaPlanted: optNonNeg("Area planted"),
    plantingDate: optDate("Planting date"),
    expectedHarvestDate: optDate("Expected harvest date"),
    growthStage: z.enum(["PLANNED", "GERMINATION", "VEGETATIVE", "FLOWERING", "GRAIN_FILL", "MATURITY", "HARVESTED"]).default("PLANNED"),
    estimatedYield: optNonNeg("Estimated yield"),
    actualHarvest: optNonNeg("Actual harvest"),
    yieldUnit: UNIT.default("KG"),
    status: z.enum(["PLANNED", "GROWING", "HARVESTED", "FAILED"]).default("PLANNED"),
    notes: optText(2000),
  })
  .refine((v) => !v.plantingDate || !v.expectedHarvestDate || v.expectedHarvestDate >= v.plantingDate, {
    path: ["expectedHarvestDate"],
    message: "Expected harvest must be after planting",
  });

const ACTIVITY = z.enum([
  "LAND_PREPARATION",
  "PLANTING",
  "FERTILIZER_APPLICATION",
  "IRRIGATION",
  "WEED_MANAGEMENT",
  "PEST_MANAGEMENT",
  "DISEASE_TREATMENT",
  "HARVESTING",
  "STORAGE",
  "INSPECTION",
  "OTHER",
]);
export const activitySchema = z.object({
  farmId: reqText("Farm", 40),
  fieldId: optText(40),
  cropRecordId: optText(40),
  type: ACTIVITY,
  date: dateStr("Date"),
  quantity: optNonNeg("Quantity"),
  unit: optText(30),
  cost: optNonNeg("Cost"),
  recordExpense: checkbox,
  notes: optText(2000),
  clientId: optText(64),
});

export const taskSchema = z.object({
  farmId: optText(40),
  fieldId: optText(40),
  cropRecordId: optText(40),
  title: reqText("Title", 140),
  description: optText(1000),
  type: ACTIVITY.default("OTHER"),
  dueDate: dateStr("Due date"),
  reminder: checkbox,
  clientId: optText(64),
});

export const noteSchema = z.object({
  farmId: optText(40),
  title: reqText("Title", 140),
  body: reqText("Note", 5000),
  clientId: optText(64),
});

// ── Marketplace ──
export const listingSchema = z.object({
  cropId: reqText("Crop", 40),
  farmId: optText(40),
  title: reqText("Produce name", 120),
  variety: optText(80),
  quantity: positive("Quantity"),
  unit: UNIT,
  pricePerUnit: positive("Price"),
  minOrderQuantity: optNonNeg("Minimum order"),
  province: PROVINCE,
  district: reqText("District", 60),
  pickupLocation: optText(160),
  qualityGrade: z.enum(["GRADE_A", "GRADE_B", "GRADE_C", "UNGRADED"]).default("UNGRADED"),
  harvestDate: optDate("Harvest date"),
  description: optText(2000),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const listingFilterSchema = z.object({
  q: optText(80),
  crop: optText(40),
  province: PROVINCE.optional(),
  district: optText(60),
  minPrice: optNonNeg("Min price"),
  maxPrice: optNonNeg("Max price"),
  minQty: optNonNeg("Min quantity"),
  sort: z.enum(["newest", "price_asc", "price_desc", "qty_desc"]).default("newest"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export const purchaseRequestSchema = z.object({
  listingId: reqText("Listing", 40),
  quantity: positive("Quantity"),
  offerPrice: optNonNeg("Offer price"),
  deliveryAddress: optText(240),
  message: optText(1000),
});

export const counterOfferSchema = z.object({
  orderId: reqText("Order", 40),
  pricePerUnit: positive("Price"),
  quantity: positive("Quantity"),
  message: optText(1000),
});

export const inputOrderSchema = z.object({
  productId: reqText("Product", 40),
  quantity: positive("Quantity"),
  deliveryAddress: optText(240),
  notes: optText(1000),
});

// ── Suppliers & inventory ──
export const supplierProductSchema = z.object({
  categoryId: reqText("Category", 40),
  name: reqText("Product name", 120),
  brand: optText(80),
  description: optText(2000),
  unit: UNIT,
  price: positive("Price"),
  stock: nonNeg("Stock quantity"),
  minStockLevel: nonNeg("Minimum stock").default(0),
  registrationNumber: optText(60),
  safetyInfo: optText(2000),
  isActive: checkbox,
});

const INV_CAT = z.enum(["SEEDS", "FERTILIZER", "PESTICIDE", "TOOLS", "EQUIPMENT", "HARVESTED_PRODUCE", "FEED", "IRRIGATION", "OTHER"]);
export const inventoryItemSchema = z.object({
  name: reqText("Item name", 120),
  category: INV_CAT,
  unit: reqText("Unit", 30),
  quantity: nonNeg("Opening quantity"),
  unitCost: optNonNeg("Purchase price"),
  minStockLevel: nonNeg("Minimum stock level").default(0),
  storageLocation: optText(120),
  expiryDate: optDate("Expiry date"),
  farmId: optText(40),
});

export const stockMovementSchema = z.object({
  itemId: reqText("Item", 40),
  direction: z.enum(["IN", "OUT", "ADJUST"]),
  quantity: positive("Quantity"),
  unitCost: optNonNeg("Unit cost"),
  reason: optText(240),
  /** Only an explicit adjustment may take stock below zero */
  allowNegative: checkbox,
});

// ── Logistics ──
export const vehicleSchema = z.object({
  type: z.enum(["PICKUP", "LIGHT_TRUCK", "MEDIUM_TRUCK", "HEAVY_TRUCK", "REFRIGERATED_TRUCK", "TRACTOR_TRAILER", "MOTORBIKE"]),
  registration: optText(20),
  capacityKg: z.coerce.number().int().positive("Capacity must be greater than 0").max(100000),
  description: optText(300),
});

export const deliveryRequestSchema = z.object({
  orderId: optText(40),
  transporterId: optText(40),
  cargoDescription: reqText("Cargo description", 240),
  weightKg: z.coerce.number().int().positive().max(100000).optional(),
  pickupLocation: reqText("Pickup location", 200),
  pickupProvince: PROVINCE,
  pickupDistrict: reqText("Pickup district", 60),
  dropoffLocation: reqText("Delivery location", 200),
  dropoffProvince: PROVINCE,
  dropoffDistrict: reqText("Delivery district", 60),
  expectedDate: optDate("Expected date"),
  notes: optText(1000),
});

export const deliveryUpdateSchema = z.object({
  deliveryId: reqText("Delivery", 40),
  status: z.enum(["ACCEPTED", "PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "CANCELLED"]),
  fee: optNonNeg("Fee"),
  vehicleId: optText(40),
  scheduledPickupAt: optDate("Pickup time"),
  note: optText(500),
  proofRecipient: optText(120),
  proofNotes: optText(500),
});

// ── Finance ──
const TXN_CAT = z.enum([
  "PRODUCE_SALE",
  "OTHER_INCOME",
  "SEEDS",
  "FERTILIZER",
  "CHEMICALS",
  "LABOUR",
  "TRANSPORT",
  "EQUIPMENT",
  "IRRIGATION",
  "FUEL",
  "STORAGE",
  "OTHER_EXPENSE",
]);
export const transactionSchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE"]),
    category: TXN_CAT,
    amount: positive("Amount"),
    date: dateStr("Date"),
    farmId: optText(40),
    fieldId: optText(40),
    cropRecordId: optText(40),
    description: optText(500),
  })
  .refine((v) => (v.type === "INCOME") === ["PRODUCE_SALE", "OTHER_INCOME"].includes(v.category), {
    path: ["category"],
    message: "Category does not match the transaction type",
  });

export const estimateSchema = z.object({
  type: z.enum(["ESTIMATED_COST", "ESTIMATED_REVENUE"]),
  category: TXN_CAT,
  amount: positive("Amount"),
  season: reqText("Season", 20),
  farmId: optText(40),
  cropRecordId: optText(40),
  description: optText(500),
});

// ── Messaging / misc ──
export const messageSchema = z.object({
  conversationId: optText(40),
  recipientId: optText(40),
  listingId: optText(40),
  orderId: optText(40),
  subject: optText(160),
  body: reqText("Message", 4000),
});

export const contactSchema = z.object({
  name: reqText("Name", 100),
  email: z.email("Enter a valid email address"),
  subject: reqText("Subject", 160),
  message: reqText("Message", 4000),
});

export const marketPriceSchema = z.object({
  cropId: reqText("Crop", 40),
  province: PROVINCE,
  district: optText(60),
  marketName: optText(120),
  unit: UNIT,
  price: positive("Price"),
  observedOn: dateStr("Observation date"),
  sourceType: z.enum(["VERIFIED_OBSERVATION", "HISTORICAL_RECORD", "DEMO"]),
  sourceName: reqText("Source", 160),
  notes: optText(500),
});

export const aiChatSchema = z.object({
  conversationId: z.string().max(40).optional(),
  message: z.string().trim().min(1, "Type a question").max(2000, "Please keep questions under 2,000 characters"),
});

export const reportRequestSchema = z.object({
  type: z.enum(["WEEKLY_SUMMARY", "MONTHLY_REPORT", "CROP_PERFORMANCE", "EXPENSE_REPORT", "HARVEST_REPORT", "PROFITABILITY"]),
});
