import type { DeliveryStatus, OrderStatus } from "@prisma/client";

/** Who is acting on an order relative to it. SYSTEM = automatic updates from linked deliveries. */
export type OrderParty = "BUYER" | "SELLER" | "ADMIN" | "SYSTEM";

const T: Partial<Record<OrderStatus, Partial<Record<OrderStatus, OrderParty[]>>>> = {
  PENDING: { ACCEPTED: ["SELLER"], REJECTED: ["SELLER"], CANCELLED: ["BUYER", "ADMIN"] },
  // Acceptance during negotiation happens through acceptOffer(), which validates who may accept.
  NEGOTIATING: { ACCEPTED: ["BUYER", "SELLER"], REJECTED: ["BUYER", "SELLER"], CANCELLED: ["BUYER", "ADMIN"] },
  ACCEPTED: { CONFIRMED: ["BUYER"], CANCELLED: ["BUYER", "SELLER", "ADMIN"] },
  CONFIRMED: { PROCESSING: ["SELLER"], CANCELLED: ["BUYER", "SELLER", "ADMIN"] },
  PROCESSING: { READY_FOR_PICKUP: ["SELLER"], CANCELLED: ["SELLER", "ADMIN"] },
  READY_FOR_PICKUP: { IN_TRANSIT: ["SELLER", "SYSTEM"], DELIVERED: ["BUYER", "SYSTEM"], CANCELLED: ["ADMIN"] },
  IN_TRANSIT: { DELIVERED: ["BUYER", "SELLER", "SYSTEM"], DISPUTED: ["BUYER"] },
  DELIVERED: { COMPLETED: ["BUYER", "ADMIN"], DISPUTED: ["BUYER"] },
  DISPUTED: { COMPLETED: ["ADMIN"], CANCELLED: ["ADMIN"] },
};

export function allowedTransitions(from: OrderStatus, party: OrderParty): OrderStatus[] {
  const row = T[from] ?? {};
  return (Object.entries(row) as [OrderStatus, OrderParty[]][]).filter(([, parties]) => parties.includes(party)).map(([to]) => to);
}

export function canTransition(from: OrderStatus, to: OrderStatus, party: OrderParty) {
  return allowedTransitions(from, party).includes(to);
}

export const TERMINAL: OrderStatus[] = ["COMPLETED", "CANCELLED", "REJECTED"];

/** Statuses where stock has been committed to the buyer. */
export const STOCK_COMMITTED: OrderStatus[] = ["CONFIRMED", "PROCESSING", "READY_FOR_PICKUP", "IN_TRANSIT", "DELIVERED", "DISPUTED", "COMPLETED"];

/** Human-friendly action label for a transition button. */
export function transitionLabel(to: OrderStatus, party: OrderParty, from?: OrderStatus): string {
  switch (to) {
    case "ACCEPTED":
      return "Accept order";
    case "REJECTED":
      return "Reject";
    case "CONFIRMED":
      return "Confirm purchase";
    case "PROCESSING":
      return "Start processing";
    case "READY_FOR_PICKUP":
      return "Mark ready for pickup";
    case "IN_TRANSIT":
      return "Mark in transit";
    case "DELIVERED":
      return from === "READY_FOR_PICKUP" && party === "BUYER" ? "Mark collected" : "Mark delivered";
    case "COMPLETED":
      return party === "ADMIN" ? "Resolve as completed" : "Confirm receipt & complete";
    case "DISPUTED":
      return "Raise a dispute";
    case "CANCELLED":
      return "Cancel order";
    default:
      return to;
  }
}

// ───────── delivery state machine ─────────

export type DeliveryParty = "REQUESTER" | "TRANSPORTER" | "ADMIN";

const DT: Partial<Record<DeliveryStatus, Partial<Record<DeliveryStatus, DeliveryParty[]>>>> = {
  REQUESTED: { ACCEPTED: ["TRANSPORTER"], CANCELLED: ["REQUESTER", "ADMIN"] },
  ACCEPTED: { PICKUP_SCHEDULED: ["TRANSPORTER"], PICKED_UP: ["TRANSPORTER"], CANCELLED: ["REQUESTER", "TRANSPORTER", "ADMIN"] },
  PICKUP_SCHEDULED: { PICKED_UP: ["TRANSPORTER"], CANCELLED: ["REQUESTER", "TRANSPORTER", "ADMIN"] },
  PICKED_UP: { IN_TRANSIT: ["TRANSPORTER"], DELIVERED: ["TRANSPORTER"] },
  IN_TRANSIT: { DELIVERED: ["TRANSPORTER"] },
};

export function deliveryTransitions(from: DeliveryStatus, party: DeliveryParty): DeliveryStatus[] {
  const row = DT[from] ?? {};
  return (Object.entries(row) as [DeliveryStatus, DeliveryParty[]][]).filter(([, p]) => p.includes(party)).map(([to]) => to);
}

export function canTransitionDelivery(from: DeliveryStatus, to: DeliveryStatus, party: DeliveryParty) {
  return deliveryTransitions(from, party).includes(to);
}

/** Order status implied by a delivery status change (applied only if the order machine allows it). */
export function orderStatusForDelivery(d: DeliveryStatus): OrderStatus | null {
  if (d === "PICKED_UP" || d === "IN_TRANSIT") return "IN_TRANSIT";
  if (d === "DELIVERED") return "DELIVERED";
  return null;
}
