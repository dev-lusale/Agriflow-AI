"use server";

import { revalidatePath } from "next/cache";
import type { OrderStatus } from "@prisma/client";
import { parseInput, runAction } from "@/lib/action";
import { requireRole, requireUser } from "@/lib/auth/session";
import { counterOfferSchema, inputOrderSchema, listingSchema, messageSchema, purchaseRequestSchema } from "@/lib/validation/schemas";
import * as market from "@/server/marketplace/service";
import * as orders from "@/server/orders/service";
import * as messaging from "@/server/messaging/service";
import { saveImage } from "@/server/storage/service";

export async function createListingAction(fd: FormData) {
  return runAction(async () => {
    const actor = await requireRole("FARMER");
    const imageIds: string[] = [];
    for (const f of fd.getAll("photos")) {
      if (f instanceof File && f.size > 0 && imageIds.length < 4) imageIds.push((await saveImage(actor, f, "LISTING_PHOTO")).id);
    }
    const l = await market.createListing(actor, parseInput(listingSchema, fd), imageIds);
    revalidatePath("/farmer/listings");
    return { id: l.id };
  }, "Listing published.");
}

export async function updateListingAction(id: string, fd: FormData) {
  return runAction(async () => {
    await market.updateListing(await requireRole("FARMER"), id, parseInput(listingSchema, fd));
    revalidatePath("/farmer/listings");
  }, "Listing updated.");
}

export async function setListingStatusAction(id: string, status: "ACTIVE" | "INACTIVE") {
  return runAction(async () => {
    await market.setListingStatus(await requireRole("FARMER"), id, status);
    revalidatePath("/farmer/listings");
  }, status === "ACTIVE" ? "Listing is live." : "Listing paused.");
}

export async function purchaseRequestAction(fd: FormData) {
  return runAction(async () => {
    const o = await orders.createPurchaseRequest(await requireRole("BUYER"), parseInput(purchaseRequestSchema, fd));
    revalidatePath("/buyer/orders");
    return { id: o.id };
  }, "Purchase request sent to the farmer.");
}

export async function inputOrderAction(fd: FormData) {
  return runAction(async () => {
    const o = await orders.createInputOrder(await requireRole("FARMER"), parseInput(inputOrderSchema, fd));
    revalidatePath("/farmer/orders");
    return { id: o.id };
  }, "Purchase order sent to the supplier.");
}

export async function counterOfferAction(fd: FormData) {
  return runAction(async () => {
    await orders.counterOffer(await requireUser(), parseInput(counterOfferSchema, fd));
    revalidatePath("/", "layout");
  }, "Counteroffer sent.");
}

export async function acceptOfferAction(orderId: string) {
  return runAction(async () => {
    await orders.acceptOffer(await requireUser(), orderId);
    revalidatePath("/", "layout");
  }, "Offer accepted.");
}

export async function transitionOrderAction(orderId: string, to: OrderStatus, note?: string) {
  return runAction(async () => {
    await orders.transitionOrder(await requireUser(), orderId, to, note);
    revalidatePath("/", "layout");
  }, "Order updated.");
}

export async function sendMessageAction(fd: FormData) {
  return runAction(async () => {
    const r = await messaging.sendMessage(await requireUser(), parseInput(messageSchema, fd));
    revalidatePath("/messages", "layout");
    return { conversationId: r.conversationId };
  });
}

export async function reportListingAction(listingId: string, reason?: string) {
  return runAction(async () => {
    await market.reportContent(await requireUser(), "LISTING", listingId, reason ?? "");
  }, "Thank you. An administrator will review this listing.");
}
