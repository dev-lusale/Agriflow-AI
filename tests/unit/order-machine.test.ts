import { describe, expect, it } from "vitest";
import { allowedTransitions, canTransition, canTransitionDelivery, deliveryTransitions, orderStatusForDelivery } from "@/server/orders/machine";

describe("order status lifecycle", () => {
  it("follows PENDING → ACCEPTED → CONFIRMED → PROCESSING → READY → IN_TRANSIT → DELIVERED → COMPLETED", () => {
    expect(canTransition("PENDING", "ACCEPTED", "SELLER")).toBe(true);
    expect(canTransition("ACCEPTED", "CONFIRMED", "BUYER")).toBe(true);
    expect(canTransition("CONFIRMED", "PROCESSING", "SELLER")).toBe(true);
    expect(canTransition("PROCESSING", "READY_FOR_PICKUP", "SELLER")).toBe(true);
    expect(canTransition("READY_FOR_PICKUP", "IN_TRANSIT", "SYSTEM")).toBe(true);
    expect(canTransition("IN_TRANSIT", "DELIVERED", "SYSTEM")).toBe(true);
    expect(canTransition("DELIVERED", "COMPLETED", "BUYER")).toBe(true);
  });

  it("enforces who may act", () => {
    expect(canTransition("PENDING", "ACCEPTED", "BUYER")).toBe(false); // buyer cannot accept own request
    expect(canTransition("ACCEPTED", "CONFIRMED", "SELLER")).toBe(false); // only buyer confirms
    expect(canTransition("DELIVERED", "COMPLETED", "SELLER")).toBe(false);
    expect(canTransition("DISPUTED", "COMPLETED", "BUYER")).toBe(false); // only admin resolves
    expect(canTransition("DISPUTED", "COMPLETED", "ADMIN")).toBe(true);
  });

  it("prevents skipping steps and leaving terminal states", () => {
    expect(canTransition("PENDING", "COMPLETED", "ADMIN")).toBe(false);
    expect(canTransition("COMPLETED", "CANCELLED", "ADMIN")).toBe(false);
    expect(allowedTransitions("CANCELLED", "ADMIN")).toEqual([]);
    expect(allowedTransitions("REJECTED", "SELLER")).toEqual([]);
  });

  it("supports cancellation and disputes", () => {
    expect(canTransition("PENDING", "CANCELLED", "BUYER")).toBe(true);
    expect(canTransition("CONFIRMED", "CANCELLED", "SELLER")).toBe(true);
    expect(canTransition("DELIVERED", "DISPUTED", "BUYER")).toBe(true);
  });
});

describe("delivery lifecycle", () => {
  it("REQUESTED → ACCEPTED → PICKUP_SCHEDULED → PICKED_UP → IN_TRANSIT → DELIVERED", () => {
    expect(canTransitionDelivery("REQUESTED", "ACCEPTED", "TRANSPORTER")).toBe(true);
    expect(canTransitionDelivery("ACCEPTED", "PICKUP_SCHEDULED", "TRANSPORTER")).toBe(true);
    expect(canTransitionDelivery("PICKUP_SCHEDULED", "PICKED_UP", "TRANSPORTER")).toBe(true);
    expect(canTransitionDelivery("PICKED_UP", "IN_TRANSIT", "TRANSPORTER")).toBe(true);
    expect(canTransitionDelivery("IN_TRANSIT", "DELIVERED", "TRANSPORTER")).toBe(true);
  });
  it("requesters cannot mark deliveries as delivered", () => {
    expect(canTransitionDelivery("IN_TRANSIT", "DELIVERED", "REQUESTER")).toBe(false);
    expect(deliveryTransitions("REQUESTED", "REQUESTER")).toEqual(["CANCELLED"]);
  });
  it("maps delivery progress to order status", () => {
    expect(orderStatusForDelivery("PICKED_UP")).toBe("IN_TRANSIT");
    expect(orderStatusForDelivery("DELIVERED")).toBe("DELIVERED");
    expect(orderStatusForDelivery("ACCEPTED")).toBeNull();
  });
});
