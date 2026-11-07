import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma, type OrderStatus, type PurchaseOrder, type TransactionCategory, type InventoryCategory } from "@prisma/client";
import type { z } from "zod";
import { prisma, type Tx } from "@/lib/db";
import type { Actor } from "@/lib/action";
import { AppError, conflict, forbidden, invalid, notFound } from "@/lib/errors";
import { D, lineTotal } from "@/lib/money";
import { audit } from "@/lib/audit";
import { ORDER_STATUS_LABEL, UNIT_LABEL } from "@/lib/labels";
import { counterOfferSchema, inputOrderSchema, purchaseRequestSchema } from "@/lib/validation/schemas";
import { notify } from "@/server/notifications/service";
import { allowedTransitions, canTransition, STOCK_COMMITTED, type OrderParty } from "./machine";

export function newOrderNumber(prefix = "AF") {
  const d = new Date();
  const ymd = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `${prefix}-${ymd}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export function partyFor(actor: Actor, order: Pick<PurchaseOrder, "buyerId" | "sellerId">): OrderParty {
  if (order.buyerId === actor.id) return "BUYER";
  if (order.sellerId === actor.id) return "SELLER";
  if (actor.role === "ADMIN" || actor.role === "SUPER_ADMIN") return "ADMIN";
  throw forbidden("You are not a party to this order.");
}

const orderInclude = {
  items: { include: { listing: { include: { crop: true } }, supplierProduct: { include: { category: true } } } },
  buyer: { select: { id: true, email: true, phone: true, profile: { select: { fullName: true, district: true, province: true } }, buyerProfile: { select: { businessName: true } } } },
  seller: { select: { id: true, email: true, phone: true, profile: { select: { fullName: true, district: true, province: true } }, supplierProfile: { select: { businessName: true } } } },
  events: { orderBy: { createdAt: "asc" as const }, include: { actor: { select: { profile: { select: { fullName: true } } } } } },
  offers: { orderBy: { createdAt: "asc" as const }, include: { offeredBy: { select: { id: true, profile: { select: { fullName: true } } } } } },
  deliveries: { orderBy: { createdAt: "desc" as const }, include: { transporter: { select: { profile: { select: { fullName: true } }, transporterProfile: { select: { businessName: true } } } } } },
  conversations: { select: { id: true } },
} satisfies Prisma.PurchaseOrderInclude;

export type OrderDetail = Prisma.PurchaseOrderGetPayload<{ include: typeof orderInclude }>;

export async function getOrder(actor: Actor, id: string) {
  const order = await prisma.purchaseOrder.findUnique({ where: { id }, include: orderInclude });
  if (!order) throw notFound("Order not found.");
  const isTransporter = actor.role === "TRANSPORTER" && (await prisma.delivery.count({ where: { orderId: id, transporterId: actor.id } })) > 0;
  if (!isTransporter) partyFor(actor, order); // throws if unauthorized
  return order;
}

export async function listOrders(actor: Actor, opts: { as?: "buyer" | "seller"; status?: OrderStatus; type?: "PRODUCE" | "INPUT" } = {}) {
  const where: Prisma.PurchaseOrderWhereInput =
    opts.as === "buyer" ? { buyerId: actor.id } : opts.as === "seller" ? { sellerId: actor.id } : { OR: [{ buyerId: actor.id }, { sellerId: actor.id }] };
  return prisma.purchaseOrder.findMany({
    where: { ...where, ...(opts.status ? { status: opts.status } : {}), ...(opts.type ? { type: opts.type } : {}) },
    orderBy: { updatedAt: "desc" },
    include: {
      items: { include: { listing: { include: { crop: true } } } },
      buyer: { select: { profile: { select: { fullName: true } }, buyerProfile: { select: { businessName: true } } } },
      seller: { select: { profile: { select: { fullName: true } }, supplierProfile: { select: { businessName: true } } } },
    },
    take: 200,
  });
}

async function logEvent(tx: Tx, orderId: string, actorId: string | null, from: OrderStatus | null, to: OrderStatus, note?: string) {
  await tx.orderEvent.create({ data: { orderId, actorId, fromStatus: from, toStatus: to, note } });
}

// ───────── produce purchase requests & negotiation ─────────

export async function createPurchaseRequest(actor: Actor, input: z.input<typeof purchaseRequestSchema>) {
  if (actor.role !== "BUYER") throw forbidden("Only buyer accounts can submit purchase requests.");
  const d = purchaseRequestSchema.parse(input);
  const listing = await prisma.produceListing.findUnique({ where: { id: d.listingId }, include: { crop: true } });
  if (!listing || listing.status !== "ACTIVE" || listing.moderationStatus === "REMOVED") throw notFound("This listing is no longer available.");
  if (listing.farmerId === actor.id) throw invalid("You cannot buy your own produce.");
  const qty = D(d.quantity);
  if (qty.greaterThan(listing.quantityAvailable)) throw invalid(`Only ${listing.quantityAvailable.toString()} ${UNIT_LABEL[listing.unit]} available.`, { quantity: ["Exceeds available quantity"] });
  if (listing.minOrderQuantity && qty.lessThan(listing.minOrderQuantity)) throw invalid(`Minimum order is ${listing.minOrderQuantity.toString()} ${UNIT_LABEL[listing.unit]}.`, { quantity: ["Below minimum order"] });

  // Price is always taken from the database; a buyer may propose a different price as an offer.
  const unitPrice = d.offerPrice !== undefined && d.offerPrice > 0 ? D(d.offerPrice) : listing.pricePerUnit;
  const subtotal = lineTotal(qty, unitPrice);

  const order = await prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.create({
      data: {
        orderNumber: newOrderNumber(),
        type: "PRODUCE",
        buyerId: actor.id,
        sellerId: listing.farmerId,
        status: "PENDING",
        subtotal,
        total: subtotal,
        deliveryAddress: d.deliveryAddress,
        notes: d.message,
        items: {
          create: { listingId: listing.id, description: `${listing.title}${listing.variety ? ` (${listing.variety})` : ""}`, quantity: qty, unit: listing.unit, unitPrice, lineTotal: subtotal },
        },
        offers: { create: { offeredById: actor.id, pricePerUnit: unitPrice, quantity: qty, message: d.message, isInitial: true } },
      },
    });
    await logEvent(tx, order.id, actor.id, null, "PENDING", "Purchase request submitted");
    const conv = await tx.conversation.create({
      data: {
        subject: `Order ${order.orderNumber} — ${listing.title}`,
        orderId: order.id,
        listingId: listing.id,
        participants: { create: [{ userId: actor.id, lastReadAt: new Date() }, { userId: listing.farmerId }] },
      },
    });
    if (d.message) await tx.message.create({ data: { conversationId: conv.id, senderId: actor.id, body: d.message } });
    await notify(
      listing.farmerId,
      {
        type: "PURCHASE_REQUEST",
        title: "New purchase request",
        body: `A buyer requested ${qty.toString()} ${UNIT_LABEL[listing.unit]} of ${listing.title} at K${unitPrice.toFixed(2)} per ${UNIT_LABEL[listing.unit]}.`,
        link: `/farmer/orders/${order.id}`,
      },
      tx,
    );
    return order;
  });
  await audit({ actorId: actor.id, action: "order.create", entityType: "PurchaseOrder", entityId: order.id, metadata: { type: "PRODUCE" } });
  return order;
}

export async function counterOffer(actor: Actor, input: z.input<typeof counterOfferSchema>) {
  const d = counterOfferSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findUnique({ where: { id: d.orderId }, include: { items: { include: { listing: true } }, offers: { orderBy: { createdAt: "desc" }, take: 1 } } });
    if (!order) throw notFound("Order not found.");
    const party = partyFor(actor, order);
    if (party === "ADMIN") throw forbidden("Administrators cannot negotiate on behalf of users.");
    if (order.type !== "PRODUCE") throw invalid("Input orders use fixed supplier prices.");
    if (order.status !== "PENDING" && order.status !== "NEGOTIATING") throw invalid("This order can no longer be negotiated.");
    const latest = order.offers[0];
    if (latest && latest.offeredById === actor.id) throw invalid("Wait for the other party to respond to your latest offer.");
    if (order.status === "PENDING" && party !== "SELLER") throw invalid("The farmer must respond first.");
    const listing = order.items[0]?.listing;
    if (listing && D(d.quantity).greaterThan(listing.quantityAvailable)) throw invalid(`Only ${listing.quantityAvailable.toString()} available.`);

    await tx.negotiation.updateMany({ where: { orderId: order.id, status: "OPEN" }, data: { status: "SUPERSEDED" } });
    await tx.negotiation.create({ data: { orderId: order.id, offeredById: actor.id, pricePerUnit: d.pricePerUnit, quantity: d.quantity, message: d.message } });
    if (order.status === "PENDING") {
      await tx.purchaseOrder.update({ where: { id: order.id }, data: { status: "NEGOTIATING" } });
      await logEvent(tx, order.id, actor.id, "PENDING", "NEGOTIATING", "Counteroffer made");
    }
    const other = party === "BUYER" ? order.sellerId : order.buyerId;
    await notify(
      other,
      {
        type: "NEGOTIATION_OFFER",
        title: `New offer on ${order.orderNumber}`,
        body: `Counteroffer: K${D(d.pricePerUnit).toFixed(2)} per unit for ${d.quantity}.${d.message ? ` “${d.message.slice(0, 120)}”` : ""}`,
        link: `/${party === "BUYER" ? "farmer" : "buyer"}/orders/${order.id}`,
      },
      tx,
    );
    return { ok: true };
  });
}

/** Accept the latest open offer. Only the party who did NOT make it may accept. */
export async function acceptOffer(actor: Actor, orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findUnique({ where: { id: orderId }, include: { items: true, offers: { where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 1 } } });
    if (!order) throw notFound("Order not found.");
    const party = partyFor(actor, order);
    if (party === "ADMIN") throw forbidden();
    if (order.status !== "PENDING" && order.status !== "NEGOTIATING") throw invalid("There is no open offer to accept.");
    const offer = order.offers[0];
    if (!offer) throw invalid("There is no open offer to accept.");
    if (offer.offeredById === actor.id) throw invalid("You cannot accept your own offer.");
    if (order.status === "PENDING" && party !== "SELLER") throw invalid("Only the farmer can accept a new request.");

    const item = order.items[0]!;
    const total = lineTotal(offer.quantity, offer.pricePerUnit);
    await tx.orderItem.update({ where: { id: item.id }, data: { quantity: offer.quantity, unitPrice: offer.pricePerUnit, lineTotal: total } });
    await tx.negotiation.update({ where: { id: offer.id }, data: { status: "ACCEPTED" } });
    await tx.purchaseOrder.update({ where: { id: order.id }, data: { status: "ACCEPTED", subtotal: total, total: total.plus(order.deliveryFee), acceptedAt: new Date() } });
    await logEvent(tx, order.id, actor.id, order.status, "ACCEPTED", `Agreed K${offer.pricePerUnit.toFixed(2)} × ${offer.quantity.toString()}`);
    const other = party === "BUYER" ? order.sellerId : order.buyerId;
    await notify(
      other,
      {
        type: "ORDER_ACCEPTED",
        title: `Order ${order.orderNumber} accepted`,
        body: party === "SELLER" ? `The farmer accepted at K${offer.pricePerUnit.toFixed(2)} per unit. Please confirm the purchase.` : `The buyer accepted your offer of K${offer.pricePerUnit.toFixed(2)} per unit.`,
        link: `/${party === "SELLER" ? "buyer" : "farmer"}/orders/${order.id}`,
      },
      tx,
    );
    return { ok: true };
  });
}

// ───────── generic status transitions ─────────

export async function transitionOrder(actor: Actor, orderId: string, to: OrderStatus, note?: string, opts: { system?: boolean } = {}) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findUnique({
      where: { id: orderId },
      include: { items: { include: { listing: true, supplierProduct: { include: { category: true, inventoryItem: true } } } } },
    });
    if (!order) throw notFound("Order not found.");
    const party: OrderParty = opts.system ? "SYSTEM" : partyFor(actor, order);
    if (to === "ACCEPTED" && order.status === "NEGOTIATING") throw invalid("Use 'accept offer' during negotiation.");
    if (!canTransition(order.status, to, party)) {
      throw new AppError(`Cannot change order from ${ORDER_STATUS_LABEL[order.status]} to ${ORDER_STATUS_LABEL[to]}.`, "CONFLICT");
    }
    if ((to === "CANCELLED" || to === "DISPUTED" || to === "REJECTED") && party !== "SYSTEM" && !note && party !== "SELLER") {
      // reasons are encouraged; required for cancellations/disputes by buyers and admins
      throw invalid("Please give a reason.");
    }

    const data: Prisma.PurchaseOrderUpdateInput = { status: to };
    if (to === "ACCEPTED") {
      data.acceptedAt = new Date();
      await tx.negotiation.updateMany({ where: { orderId, status: "OPEN" }, data: { status: "ACCEPTED" } });
    }
    if (to === "REJECTED") await tx.negotiation.updateMany({ where: { orderId, status: "OPEN" }, data: { status: "REJECTED" } });
    if (to === "CONFIRMED") {
      await reserveStock(tx, order, actor.id);
      data.stockReserved = true;
      data.confirmedAt = new Date();
    }
    if (to === "CANCELLED") {
      if (order.stockReserved) await releaseStock(tx, order, actor.id);
      data.stockReserved = false;
      data.cancelledAt = new Date();
      data.cancelReason = note;
    }
    if (to === "COMPLETED") {
      data.completedAt = new Date();
      await recordCompletionFinance(tx, order);
    }
    await tx.purchaseOrder.update({ where: { id: orderId }, data });
    await logEvent(tx, orderId, opts.system ? null : actor.id, order.status, to, note);

    const recipients = [order.buyerId, order.sellerId].filter((id) => id !== actor.id || opts.system);
    for (const uid of recipients) {
      const area = uid === order.buyerId ? (order.type === "INPUT" ? "farmer/purchases" : "buyer/orders") : order.type === "INPUT" ? "supplier/orders" : "farmer/orders";
      await notify(
        uid,
        {
          type: to === "ACCEPTED" ? "ORDER_ACCEPTED" : to === "REJECTED" ? "ORDER_REJECTED" : "ORDER_UPDATE",
          title: `Order ${order.orderNumber}: ${ORDER_STATUS_LABEL[to]}`,
          body: note ? `Status changed to ${ORDER_STATUS_LABEL[to]}. Note: ${note.slice(0, 200)}` : `Status changed to ${ORDER_STATUS_LABEL[to]}.`,
          link: `/${area}/${order.id}`,
        },
        tx,
      );
    }
    return { from: order.status, to };
  });
  await audit({ actorId: opts.system ? null : actor.id, action: `order.${to.toLowerCase()}`, entityType: "PurchaseOrder", entityId: orderId, metadata: { from: result.from } });
  return result;
}

export function availableActions(actor: Actor, order: Pick<PurchaseOrder, "buyerId" | "sellerId" | "status">) {
  try {
    const party = partyFor(actor, order);
    return allowedTransitions(order.status, party).filter((s) => !(s === "ACCEPTED" && order.status === "NEGOTIATING"));
  } catch {
    return [];
  }
}

type OrderWithItems = PurchaseOrder & {
  items: Array<{
    id: string;
    quantity: Prisma.Decimal;
    listingId: string | null;
    supplierProductId: string | null;
    description: string;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
    listing: { id: string; farmId: string | null; cropId: string; title: string } | null;
    supplierProduct: { name: string; unit: string; inventoryItemId: string; category: { slug: string }; inventoryItem: { id: string } } | null;
  }>;
};

/** Atomically decrement stock; fails if insufficient (prevents overselling under concurrency). */
async function reserveStock(tx: Tx, order: OrderWithItems, actorId: string) {
  for (const item of order.items) {
    if (item.listingId) {
      const res = await tx.produceListing.updateMany({
        where: { id: item.listingId, quantityAvailable: { gte: item.quantity } },
        data: { quantityAvailable: { decrement: item.quantity } },
      });
      if (res.count === 0) throw conflict("Not enough stock left on this listing to confirm the order.");
      await tx.produceListing.updateMany({ where: { id: item.listingId, quantityAvailable: { lte: 0 } }, data: { status: "SOLD_OUT" } });
    }
    if (item.supplierProduct) {
      const invId = item.supplierProduct.inventoryItemId;
      const res = await tx.inventoryItem.updateMany({ where: { id: invId, quantity: { gte: item.quantity } }, data: { quantity: { decrement: item.quantity } } });
      if (res.count === 0) throw conflict(`Supplier stock for ${item.supplierProduct.name} is insufficient.`);
      const after = await tx.inventoryItem.findUniqueOrThrow({ where: { id: invId } });
      await tx.inventoryMovement.create({
        data: { itemId: invId, actorId, type: "SALE", quantityChange: item.quantity.negated(), balanceAfter: after.quantity, orderId: order.id, reason: `Order ${order.orderNumber}` },
      });
      if (after.quantity.lte(after.minStockLevel) && after.minStockLevel.gt(0)) {
        await notify(order.sellerId, { type: "LOW_INVENTORY", title: "Low stock", body: `${after.name} is at ${after.quantity.toString()} ${after.unit} (minimum ${after.minStockLevel.toString()}).`, link: "/supplier/inventory" }, tx);
      }
    }
  }
}

async function releaseStock(tx: Tx, order: OrderWithItems, actorId: string) {
  for (const item of order.items) {
    if (item.listingId) {
      await tx.produceListing.update({ where: { id: item.listingId }, data: { quantityAvailable: { increment: item.quantity } } });
      await tx.produceListing.updateMany({ where: { id: item.listingId, status: "SOLD_OUT", quantityAvailable: { gt: 0 } }, data: { status: "ACTIVE" } });
    }
    if (item.supplierProduct) {
      const invId = item.supplierProduct.inventoryItemId;
      const after = await tx.inventoryItem.update({ where: { id: invId }, data: { quantity: { increment: item.quantity } } });
      await tx.inventoryMovement.create({
        data: { itemId: invId, actorId, type: "ADJUSTMENT", quantityChange: item.quantity, balanceAfter: after.quantity, orderId: order.id, reason: `Order ${order.orderNumber} cancelled — stock returned` },
      });
    }
  }
}

const INPUT_CATEGORY_MAP: Record<string, { txn: TransactionCategory; inv: InventoryCategory }> = {
  seeds: { txn: "SEEDS", inv: "SEEDS" },
  fertilizer: { txn: "FERTILIZER", inv: "FERTILIZER" },
  "crop-protection": { txn: "CHEMICALS", inv: "PESTICIDE" },
  equipment: { txn: "EQUIPMENT", inv: "EQUIPMENT" },
  tools: { txn: "EQUIPMENT", inv: "TOOLS" },
  irrigation: { txn: "IRRIGATION", inv: "IRRIGATION" },
  "animal-feed": { txn: "OTHER_EXPENSE", inv: "FEED" },
};

/** Completed orders feed the farmer's books automatically (actual, not estimated, figures). */
async function recordCompletionFinance(tx: Tx, order: OrderWithItems) {
  const today = new Date();
  if (order.type === "PRODUCE") {
    for (const item of order.items) {
      let cropRecordId: string | null = null;
      if (item.listing?.farmId) {
        const rec = await tx.cropRecord.findFirst({ where: { farmId: item.listing.farmId, cropId: item.listing.cropId }, orderBy: { plantingDate: "desc" } });
        cropRecordId = rec?.id ?? null;
      }
      await tx.farmTransaction.create({
        data: {
          userId: order.sellerId,
          farmId: item.listing?.farmId ?? null,
          cropRecordId,
          orderId: order.id,
          type: "INCOME",
          category: "PRODUCE_SALE",
          amount: item.lineTotal,
          date: today,
          description: `Marketplace sale ${order.orderNumber}: ${item.description}`,
        },
      });
    }
  } else {
    const buyer = await tx.user.findUnique({ where: { id: order.buyerId }, select: { role: true } });
    if (buyer?.role !== "FARMER") return;
    for (const item of order.items) {
      if (!item.supplierProduct) continue;
      const map = INPUT_CATEGORY_MAP[item.supplierProduct.category.slug] ?? { txn: "OTHER_EXPENSE" as const, inv: "OTHER" as const };
      await tx.farmTransaction.create({
        data: { userId: order.buyerId, orderId: order.id, type: "EXPENSE", category: map.txn, amount: item.lineTotal, date: today, description: `Input purchase ${order.orderNumber}: ${item.description}` },
      });
      // Add purchased inputs to the farmer's inventory
      let inv = await tx.inventoryItem.findFirst({ where: { ownerId: order.buyerId, name: item.supplierProduct.name } });
      if (!inv) {
        inv = await tx.inventoryItem.create({
          data: { ownerId: order.buyerId, name: item.supplierProduct.name, category: map.inv, unit: UNIT_LABEL[item.supplierProduct.unit as keyof typeof UNIT_LABEL] ?? "unit", quantity: 0, unitCost: item.unitPrice },
        });
      }
      const after = await tx.inventoryItem.update({ where: { id: inv.id }, data: { quantity: { increment: item.quantity }, unitCost: item.unitPrice } });
      await tx.inventoryMovement.create({
        data: { itemId: inv.id, actorId: order.buyerId, type: "PURCHASE", quantityChange: item.quantity, balanceAfter: after.quantity, unitCost: item.unitPrice, orderId: order.id, reason: `Received from order ${order.orderNumber}` },
      });
    }
  }
}

// ───────── input (supplier) orders ─────────

export async function createInputOrder(actor: Actor, input: z.input<typeof inputOrderSchema>) {
  if (actor.role !== "FARMER") throw forbidden("Only farmers can order agricultural inputs.");
  const d = inputOrderSchema.parse(input);
  const product = await prisma.supplierProduct.findUnique({ where: { id: d.productId }, include: { inventoryItem: true } });
  if (!product || !product.isActive || product.moderationStatus === "REMOVED") throw notFound("This product is not available.");
  if (D(d.quantity).greaterThan(product.inventoryItem.quantity)) throw invalid(`Only ${product.inventoryItem.quantity.toString()} in stock.`, { quantity: ["Exceeds stock"] });
  const subtotal = lineTotal(d.quantity, product.price);
  const order = await prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.create({
      data: {
        orderNumber: newOrderNumber("IN"),
        type: "INPUT",
        buyerId: actor.id,
        sellerId: product.supplierId,
        subtotal,
        total: subtotal,
        deliveryAddress: d.deliveryAddress,
        notes: d.notes,
        items: { create: { supplierProductId: product.id, description: product.name, quantity: d.quantity, unit: product.unit, unitPrice: product.price, lineTotal: subtotal } },
      },
    });
    await logEvent(tx, order.id, actor.id, null, "PENDING", "Purchase order submitted");
    await notify(product.supplierId, { type: "PURCHASE_REQUEST", title: "New purchase order", body: `Order for ${d.quantity} × ${product.name} (K${subtotal.toFixed(2)}).`, link: `/supplier/orders/${order.id}` }, tx);
    return order;
  });
  await audit({ actorId: actor.id, action: "order.create", entityType: "PurchaseOrder", entityId: order.id, metadata: { type: "INPUT" } });
  return order;
}

export { STOCK_COMMITTED };
