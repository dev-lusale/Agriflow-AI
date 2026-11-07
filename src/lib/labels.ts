/** Human labels for enum values. Client-safe (no server imports). */
import type {
  ActivityType,
  DeliveryStatus,
  GrowthStage,
  InventoryCategory,
  OrderStatus,
  QuantityUnit,
  TransactionCategory,
} from "@prisma/client";
import { titleCase } from "./utils";

export const UNIT_LABEL: Record<QuantityUnit, string> = {
  KG: "kg",
  TONNE: "tonne",
  BAG_50KG: "50 kg bag",
  BAG_25KG: "25 kg bag",
  BAG_10KG: "10 kg bag",
  CRATE: "crate",
  LITRE: "litre",
  BALE: "bale",
  UNIT: "unit",
  BOX: "box",
};
export const UNITS = Object.keys(UNIT_LABEL) as QuantityUnit[];

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  LAND_PREPARATION: "Land preparation",
  PLANTING: "Planting",
  FERTILIZER_APPLICATION: "Fertilizer application",
  IRRIGATION: "Irrigation",
  WEED_MANAGEMENT: "Weed management",
  PEST_MANAGEMENT: "Pest management",
  DISEASE_TREATMENT: "Disease treatment",
  HARVESTING: "Harvesting",
  STORAGE: "Storage",
  INSPECTION: "Crop inspection",
  OTHER: "Other",
};
export const ACTIVITY_TYPES = Object.keys(ACTIVITY_LABEL) as ActivityType[];

export const GROWTH_STAGE_LABEL: Record<GrowthStage, string> = {
  PLANNED: "Planned",
  GERMINATION: "Germination / emergence",
  VEGETATIVE: "Vegetative",
  FLOWERING: "Flowering / tasselling",
  GRAIN_FILL: "Grain / pod fill",
  MATURITY: "Physiological maturity",
  HARVESTED: "Harvested",
};

export const TXN_CATEGORY_LABEL: Record<TransactionCategory, string> = {
  PRODUCE_SALE: "Produce sales",
  OTHER_INCOME: "Other farm revenue",
  SEEDS: "Seeds",
  FERTILIZER: "Fertilizer",
  CHEMICALS: "Crop protection",
  LABOUR: "Labour",
  TRANSPORT: "Transport",
  EQUIPMENT: "Equipment",
  IRRIGATION: "Irrigation",
  FUEL: "Fuel",
  STORAGE: "Storage",
  OTHER_EXPENSE: "Other costs",
};
export const INCOME_CATEGORIES: TransactionCategory[] = ["PRODUCE_SALE", "OTHER_INCOME"];
export const EXPENSE_CATEGORIES: TransactionCategory[] = [
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
];

export const INVENTORY_CATEGORY_LABEL: Record<InventoryCategory, string> = {
  SEEDS: "Seeds",
  FERTILIZER: "Fertilizer",
  PESTICIDE: "Crop protection",
  TOOLS: "Tools",
  EQUIPMENT: "Equipment",
  HARVESTED_PRODUCE: "Harvested produce",
  FEED: "Animal feed",
  IRRIGATION: "Irrigation supplies",
  OTHER: "Other",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  NEGOTIATING: "Negotiating",
  ACCEPTED: "Accepted",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  READY_FOR_PICKUP: "Ready for pickup",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  DISPUTED: "Disputed",
};

export const ORDER_FLOW: OrderStatus[] = [
  "PENDING",
  "ACCEPTED",
  "CONFIRMED",
  "PROCESSING",
  "READY_FOR_PICKUP",
  "IN_TRANSIT",
  "DELIVERED",
  "COMPLETED",
];

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  REQUESTED: "Requested",
  ACCEPTED: "Accepted",
  PICKUP_SCHEDULED: "Pickup scheduled",
  PICKED_UP: "Picked up",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};
export const DELIVERY_FLOW: DeliveryStatus[] = ["REQUESTED", "ACCEPTED", "PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"];

export const label = (v: string | null | undefined) => (v ? titleCase(v) : "—");

export type Tone = "green" | "amber" | "red" | "blue" | "slate" | "navy";

export function statusTone(status: string): Tone {
  switch (status) {
    case "COMPLETED":
    case "DELIVERED":
    case "ACTIVE":
    case "APPROVED":
    case "DONE":
    case "HARVESTED":
    case "VERIFIED":
    case "OK":
      return "green";
    case "PENDING":
    case "PENDING_REVIEW":
    case "NEGOTIATING":
    case "REQUESTED":
    case "PLANNED":
    case "OPEN":
      return "amber";
    case "REJECTED":
    case "CANCELLED":
    case "FAILED":
    case "REMOVED":
    case "FLAGGED":
    case "DISPUTED":
    case "SUSPENDED":
    case "ERROR":
      return "red";
    case "IN_TRANSIT":
    case "PICKED_UP":
    case "PROCESSING":
    case "CONFIRMED":
    case "ACCEPTED":
    case "READY_FOR_PICKUP":
    case "PICKUP_SCHEDULED":
    case "GROWING":
      return "blue";
    default:
      return "slate";
  }
}
