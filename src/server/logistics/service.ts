import "server-only";
import type { DeliveryStatus, Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/action";
import { AppError, forbidden, invalid, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { DELIVERY_STATUS_LABEL } from "@/lib/labels";
import { isValidDistrict } from "@/lib/zambia";
import { deliveryRequestSchema, deliveryUpdateSchema, vehicleSchema } from "@/lib/validation/schemas";
import { notify } from "@/server/notifications/service";
import { canTransition, canTransitionDelivery, orderStatusForDelivery, type DeliveryParty } from "@/server/orders/machine";
import { newOrderNumber, transitionOrder } from "@/server/orders/service";

const deliveryInclude = {
  order: { select: { id: true, orderNumber: true, status: true, buyerId: true, sellerId: true, type: true } },
  requestedBy: { select: { id: true, role: true, phone: true, profile: { select: { fullName: true } } } },
  transporter: { select: { id: true, phone: true, profile: { select: { fullName: true } }, transporterProfile: { select: { businessName: true, contactPhone: true } } } },
  vehicle: true,
  events: { orderBy: { createdAt: "asc" as const }, include: { actor: { select: { profile: { select: { fullName: true } } } } } },
} satisfies Prisma.DeliveryInclude;

function partyFor(actor: Actor, d: { requestedById: string; transporterId: string | null; order?: { buyerId: string; sellerId: string } | null }): DeliveryParty {
  if (d.transporterId === actor.id) return "TRANSPORTER";
  if (d.requestedById === actor.id) return "REQUESTER";
  if (d.order && (d.order.buyerId === actor.id || d.order.sellerId === actor.id)) return "REQUESTER";
  if (actor.role === "ADMIN" || actor.role === "SUPER_ADMIN") return "ADMIN";
  if (actor.role === "TRANSPORTER" && d.transporterId === null) return "TRANSPORTER"; // open request visible to transporters
  throw forbidden("You do not have access to this delivery.");
}

/** Farmers or buyers request transport, optionally linked to one of their orders and/or a chosen transporter. */
export async function requestDelivery(actor: Actor, input: z.input<typeof deliveryRequestSchema>) {
  if (actor.role !== "FARMER" && actor.role !== "BUYER" && actor.role !== "SUPPLIER") throw forbidden("Only farmers, buyers and suppliers can request deliveries.");
  const d = deliveryRequestSchema.parse(input);
  if (!isValidDistrict(d.pickupProvince, d.pickupDistrict) || !isValidDistrict(d.dropoffProvince, d.dropoffDistrict)) throw invalid("Check the pickup and delivery districts.");
  if (d.orderId) {
    const order = await prisma.purchaseOrder.findUnique({ where: { id: d.orderId } });
    if (!order || (order.buyerId !== actor.id && order.sellerId !== actor.id)) throw forbidden("Order not found in your account.");
    if (!["CONFIRMED", "PROCESSING", "READY_FOR_PICKUP"].includes(order.status)) throw invalid("Transport can be arranged once the order is confirmed.");
    const active = await prisma.delivery.count({ where: { orderId: d.orderId, status: { notIn: ["CANCELLED", "DELIVERED"] } } });
    if (active) throw invalid("This order already has an active delivery request.");
  }
  if (d.transporterId) {
    const t = await prisma.user.findUnique({ where: { id: d.transporterId }, include: { transporterProfile: true } });
    if (!t || t.role !== "TRANSPORTER" || !t.transporterProfile) throw invalid("Choose a valid transporter.");
  }
  const delivery = await prisma.$transaction(async (tx) => {
    const del = await tx.delivery.create({
      data: {
        deliveryNumber: newOrderNumber("DL"),
        requestedById: actor.id,
        orderId: d.orderId,
        transporterId: d.transporterId,
        cargoDescription: d.cargoDescription,
        weightKg: d.weightKg,
        pickupLocation: d.pickupLocation,
        pickupProvince: d.pickupProvince,
        pickupDistrict: d.pickupDistrict,
        dropoffLocation: d.dropoffLocation,
        dropoffProvince: d.dropoffProvince,
        dropoffDistrict: d.dropoffDistrict,
        expectedDate: d.expectedDate,
        notes: d.notes,
        events: { create: { actorId: actor.id, status: "REQUESTED", note: "Delivery requested" } },
      },
    });
    // Notify the chosen transporter, or transporters serving the pickup province
    const recipients = d.transporterId
      ? [d.transporterId]
      : (
          await tx.transporterProfile.findMany({ where: { isAvailable: true, serviceProvinces: { has: d.pickupProvince } }, select: { userId: true }, take: 50 })
        ).map((t) => t.userId);
    for (const uid of recipients) {
      await notify(uid, { type: "DELIVERY_REQUEST", title: "New delivery request", body: `${d.cargoDescription} from ${d.pickupDistrict} to ${d.dropoffDistrict}.`, link: `/transporter/requests` }, tx);
    }
    return del;
  });
  await audit({ actorId: actor.id, action: "delivery.request", entityType: "Delivery", entityId: delivery.id });
  return delivery;
}

export async function listDeliveriesFor(actor: Actor) {
  const where: Prisma.DeliveryWhereInput =
    actor.role === "TRANSPORTER"
      ? { transporterId: actor.id }
      : { OR: [{ requestedById: actor.id }, { order: { buyerId: actor.id } }, { order: { sellerId: actor.id } }] };
  return prisma.delivery.findMany({ where, orderBy: { updatedAt: "desc" }, include: deliveryInclude, take: 200 });
}

/** Open requests a transporter can take: unassigned in their service provinces, or directly assigned to them. */
export async function openRequests(actor: Actor) {
  if (actor.role !== "TRANSPORTER") throw forbidden();
  const profile = await prisma.transporterProfile.findUnique({ where: { userId: actor.id } });
  return prisma.delivery.findMany({
    where: {
      status: "REQUESTED",
      OR: [{ transporterId: actor.id }, { transporterId: null, pickupProvince: { in: profile?.serviceProvinces ?? [] } }],
    },
    orderBy: { createdAt: "desc" },
    include: deliveryInclude,
  });
}

export async function getDelivery(actor: Actor, id: string) {
  const del = await prisma.delivery.findUnique({ where: { id }, include: deliveryInclude });
  if (!del) throw notFound("Delivery not found.");
  partyFor(actor, del);
  return del;
}

export async function updateDelivery(actor: Actor, input: z.input<typeof deliveryUpdateSchema>, proofUploadId?: string) {
  const d = deliveryUpdateSchema.parse(input);
  const result = await prisma.$transaction(async (tx) => {
    const del = await tx.delivery.findUnique({ where: { id: d.deliveryId }, include: { order: true } });
    if (!del) throw notFound("Delivery not found.");
    const party = partyFor(actor, del);
    if (!canTransitionDelivery(del.status, d.status as DeliveryStatus, party)) {
      throw new AppError(`Cannot change delivery from ${DELIVERY_STATUS_LABEL[del.status]} to ${DELIVERY_STATUS_LABEL[d.status as DeliveryStatus]}.`, "CONFLICT");
    }
    const data: Prisma.DeliveryUpdateInput = { status: d.status };
    if (d.status === "ACCEPTED") {
      if (actor.role !== "TRANSPORTER") throw forbidden();
      // claim atomically so two transporters cannot accept the same open request
      const claimed = await tx.delivery.updateMany({ where: { id: del.id, status: "REQUESTED", OR: [{ transporterId: null }, { transporterId: actor.id }] }, data: { transporterId: actor.id } });
      if (claimed.count === 0) throw new AppError("Another transporter already accepted this request.", "CONFLICT");
      if (d.fee !== undefined) data.fee = d.fee;
      if (d.vehicleId) {
        const v = await tx.vehicle.findUnique({ where: { id: d.vehicleId } });
        if (!v || v.ownerId !== actor.id) throw invalid("Choose one of your vehicles.");
        data.vehicle = { connect: { id: v.id } };
      }
    }
    if (d.status === "PICKUP_SCHEDULED") data.scheduledPickupAt = d.scheduledPickupAt ?? new Date();
    if (d.status === "PICKED_UP") data.pickedUpAt = new Date();
    if (d.status === "DELIVERED") {
      if (!d.proofRecipient) throw invalid("Record who received the goods (proof of delivery).", { proofRecipient: ["Required"] });
      data.deliveredAt = new Date();
      data.proofRecipient = d.proofRecipient;
      data.proofNotes = d.proofNotes;
      if (proofUploadId) {
        const up = await tx.upload.findUnique({ where: { id: proofUploadId } });
        if (!up || up.ownerId !== actor.id) throw forbidden("Invalid proof photo.");
        data.proofUpload = { connect: { id: proofUploadId } };
      }
    }
    await tx.delivery.update({ where: { id: del.id }, data });
    await tx.deliveryEvent.create({ data: { deliveryId: del.id, actorId: actor.id, status: d.status, note: d.note } });

    const notifyIds = new Set([del.requestedById, del.order?.buyerId, del.order?.sellerId, del.transporterId].filter(Boolean) as string[]);
    notifyIds.delete(actor.id);
    for (const uid of notifyIds) {
      await notify(uid, { type: "DELIVERY_UPDATE", title: `Delivery ${del.deliveryNumber}: ${DELIVERY_STATUS_LABEL[d.status as DeliveryStatus]}`, body: d.note ?? `${del.cargoDescription} — ${DELIVERY_STATUS_LABEL[d.status as DeliveryStatus]}.`, link: `/deliveries/${del.id}` }, tx);
    }
    return del;
  });

  // Keep the linked order in step (only when the order machine allows it)
  if (result.order) {
    const target = orderStatusForDelivery(d.status as DeliveryStatus);
    let current = result.order.status;
    if (target === "IN_TRANSIT" && current === "PROCESSING") {
      await transitionOrder(actor, result.order.id, "READY_FOR_PICKUP", "Picked up by transporter", { system: true }).catch(() => null);
      current = "READY_FOR_PICKUP";
    }
    if (target && target !== current && canTransition(current, target, "SYSTEM")) {
      await transitionOrder(actor, result.order.id, target, `Updated from delivery ${result.deliveryNumber}`, { system: true });
    } else if (target === "DELIVERED" && current === "READY_FOR_PICKUP") {
      await transitionOrder(actor, result.order.id, "IN_TRANSIT", undefined, { system: true });
      await transitionOrder(actor, result.order.id, "DELIVERED", `Delivered by ${result.deliveryNumber}`, { system: true });
    }
  }
  await audit({ actorId: actor.id, action: `delivery.${d.status.toLowerCase()}`, entityType: "Delivery", entityId: d.deliveryId });
  return { ok: true };
}

/** A transporter declines a request that was addressed to them; it becomes open to others. */
export async function declineDelivery(actor: Actor, deliveryId: string, reason?: string) {
  const del = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!del || del.transporterId !== actor.id || del.status !== "REQUESTED") throw invalid("Only requests addressed to you can be declined.");
  await prisma.$transaction([
    prisma.delivery.update({ where: { id: deliveryId }, data: { transporterId: null } }),
    prisma.deliveryEvent.create({ data: { deliveryId, actorId: actor.id, status: "REQUESTED", note: `Declined by transporter${reason ? `: ${reason}` : ""}` } }),
  ]);
  await notify(del.requestedById, { type: "DELIVERY_UPDATE", title: `Delivery ${del.deliveryNumber} declined`, body: "The transporter declined. The request is now open to other transporters.", link: `/deliveries/${del.id}` });
}

// ───────── vehicles & transporter directory ─────────

export async function listVehicles(actor: Actor) {
  return prisma.vehicle.findMany({ where: { ownerId: actor.id }, orderBy: { createdAt: "asc" }, include: { _count: { select: { deliveries: true } } } });
}

export async function addVehicle(actor: Actor, input: z.input<typeof vehicleSchema>) {
  if (actor.role !== "TRANSPORTER") throw forbidden();
  return prisma.vehicle.create({ data: { ...vehicleSchema.parse(input), ownerId: actor.id } });
}

export async function setVehicleActive(actor: Actor, id: string, isActive: boolean) {
  const res = await prisma.vehicle.updateMany({ where: { id, ownerId: actor.id }, data: { isActive } });
  if (!res.count) throw notFound();
}

export async function listTransporters(province?: string) {
  return prisma.user.findMany({
    where: { role: "TRANSPORTER", status: "ACTIVE", transporterProfile: { is: { isAvailable: true, ...(province ? { serviceProvinces: { has: province as never } } : {}) } } },
    select: { id: true, verifiedAt: true, transporterProfile: true, vehicles: { where: { isActive: true } }, _count: { select: { deliveriesAssigned: { where: { status: "DELIVERED" } } } } },
  });
}
