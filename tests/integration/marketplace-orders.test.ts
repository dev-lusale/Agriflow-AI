import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createListing, searchListings, moderateListing } from "@/server/marketplace/service";
import { acceptOffer, counterOffer, createInputOrder, createPurchaseRequest, transitionOrder } from "@/server/orders/service";
import { createProduct } from "@/server/suppliers/service";
import { createInventoryItem, moveStock } from "@/server/inventory/service";
import { requestDelivery, updateDelivery, openRequests } from "@/server/logistics/service";
import { createFarm } from "@/server/farms/service";
import { financialSummary } from "@/server/finance/service";
import { makeUser, resetDb } from "./helpers";

let ref: Awaited<ReturnType<typeof resetDb>>;
beforeAll(async () => {
  ref = await resetDb();
});

async function maizeListing(qty = 100) {
  const farmer = await makeUser("FARMER");
  const farm = await createFarm(farmer, { name: "Maize Farm", province: "SOUTHERN", district: "Choma", size: 5 });
  const listing = await createListing(farmer, { cropId: ref.maize.id, farmId: farm.id, title: "White maize", quantity: qty, unit: "BAG_50KG", pricePerUnit: 350, province: "SOUTHERN", district: "Choma" });
  return { farmer, farm, listing };
}

describe("marketplace listings", () => {
  it("creates, searches and filters listings; removed listings disappear", async () => {
    const { farmer, listing } = await maizeListing();
    await createListing(farmer, { cropId: ref.soy.id, title: "Soybeans", quantity: 2000, unit: "KG", pricePerUnit: 12, province: "SOUTHERN", district: "Choma" });
    expect((await searchListings({ crop: "Maize" })).items.map((l) => l.id)).toContain(listing.id);
    expect((await searchListings({ q: "soy" })).items.every((l) => l.crop.name === "Soybeans")).toBe(true);
    expect((await searchListings({ maxPrice: "100" })).items.every((l) => Number(l.pricePerUnit) <= 100)).toBe(true);
    expect((await searchListings({ province: "LUSAKA" })).total).toBe(0);
    const admin = await makeUser("ADMIN");
    await moderateListing(admin, listing.id, "REMOVED", "Test");
    expect((await searchListings({ crop: "Maize" })).items.map((l) => l.id)).not.toContain(listing.id);
    expect(await prisma.notification.count({ where: { userId: farmer.id, type: "MODERATION" } })).toBe(1);
  });

  it("only farmers can list and districts must match provinces", async () => {
    const buyer = await makeUser("BUYER");
    await expect(createListing(buyer, { cropId: ref.maize.id, title: "x", quantity: 1, unit: "KG", pricePerUnit: 1, province: "SOUTHERN", district: "Choma" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const f = await makeUser("FARMER");
    await expect(createListing(f, { cropId: ref.maize.id, title: "x", quantity: 1, unit: "KG", pricePerUnit: 1, province: "SOUTHERN", district: "Ndola" })).rejects.toThrow(/district/);
  });
});

describe("orders, negotiation and the full lifecycle", () => {
  it("runs request → counteroffer → accept → confirm (stock reserved) → … → completed (income recorded)", async () => {
    const { farmer, listing } = await maizeListing(100);
    const buyer = await makeUser("BUYER", { province: "LUSAKA", district: "Lusaka" });

    // price comes from the DB, not the client
    const order = await createPurchaseRequest(buyer, { listingId: listing.id, quantity: 40, offerPrice: 320, message: "Can you do K320?" });
    expect(order.status).toBe("PENDING");
    expect(order.subtotal.toFixed(2)).toBe("12800.00");
    expect(await prisma.notification.count({ where: { userId: farmer.id, type: "PURCHASE_REQUEST" } })).toBe(1);

    await expect(acceptOffer(buyer, order.id)).rejects.toThrow(); // cannot accept own offer
    await counterOffer(farmer, { orderId: order.id, pricePerUnit: 345, quantity: 40, message: "Grade A" });
    expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("NEGOTIATING");
    await expect(counterOffer(farmer, { orderId: order.id, pricePerUnit: 340, quantity: 40 })).rejects.toThrow(/Wait for the other party/);

    await acceptOffer(buyer, order.id);
    let o = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: order.id }, include: { items: true, offers: true } });
    expect(o.status).toBe("ACCEPTED");
    expect(o.total.toFixed(2)).toBe("13800.00"); // 40 × 345
    expect(o.offers.map((x) => x.status).sort()).toEqual(["ACCEPTED", "SUPERSEDED"]);

    await expect(transitionOrder(farmer, order.id, "CONFIRMED")).rejects.toThrow(); // only buyer confirms
    await transitionOrder(buyer, order.id, "CONFIRMED");
    expect((await prisma.produceListing.findUniqueOrThrow({ where: { id: listing.id } })).quantityAvailable.toString()).toBe("60");

    await transitionOrder(farmer, order.id, "PROCESSING");
    await transitionOrder(farmer, order.id, "READY_FOR_PICKUP");
    await transitionOrder(farmer, order.id, "IN_TRANSIT");
    await transitionOrder(buyer, order.id, "DELIVERED");
    await transitionOrder(buyer, order.id, "COMPLETED");
    o = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: order.id }, include: { items: true, offers: true } });
    expect(o.status).toBe("COMPLETED");
    expect((await prisma.orderEvent.count({ where: { orderId: order.id } })) >= 7).toBe(true);
    const fin = await financialSummary(farmer.id);
    expect(fin.totalIncome).toBe("13800.00");
  });

  it("restores stock on cancellation and prevents overselling", async () => {
    const { farmer, listing } = await maizeListing(50);
    const b1 = await makeUser("BUYER");
    const b2 = await makeUser("BUYER");
    const o1 = await createPurchaseRequest(b1, { listingId: listing.id, quantity: 40 });
    const o2 = await createPurchaseRequest(b2, { listingId: listing.id, quantity: 30 });
    await transitionOrder(farmer, o1.id, "ACCEPTED");
    await transitionOrder(farmer, o2.id, "ACCEPTED");
    await transitionOrder(b1, o1.id, "CONFIRMED");
    await expect(transitionOrder(b2, o2.id, "CONFIRMED")).rejects.toThrow(/Not enough stock/);
    expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: o2.id } })).status).toBe("ACCEPTED");
    await expect(transitionOrder(b1, o1.id, "CANCELLED")).rejects.toThrow(/reason/);
    await transitionOrder(b1, o1.id, "CANCELLED", "Changed plans");
    expect((await prisma.produceListing.findUniqueOrThrow({ where: { id: listing.id } })).quantityAvailable.toString()).toBe("50");
    await transitionOrder(b2, o2.id, "CONFIRMED");
  });

  it("validates quantity, own listings and party access", async () => {
    const { farmer, listing } = await maizeListing(10);
    const buyer = await makeUser("BUYER");
    const stranger = await makeUser("BUYER");
    await expect(createPurchaseRequest(buyer, { listingId: listing.id, quantity: 11 })).rejects.toThrow(/available/);
    await expect(createPurchaseRequest(farmer, { listingId: listing.id, quantity: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const o = await createPurchaseRequest(buyer, { listingId: listing.id, quantity: 5 });
    await expect(transitionOrder(stranger, o.id, "CANCELLED", "x")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("suppliers, inventory and input orders", () => {
  it("requires safety info for crop protection and posts completed input purchases to the farmer's books and inventory", async () => {
    const supplier = await makeUser("SUPPLIER");
    await expect(createProduct(supplier, { categoryId: ref.chem.id, name: "Insecticide", unit: "LITRE", price: 400, stock: 10 })).rejects.toThrow(/Safety/);
    const p = await createProduct(supplier, { categoryId: ref.fert.id, name: "Urea 50kg", unit: "BAG_50KG", price: 960, stock: 20, minStockLevel: 5, isActive: "on" });
    const farmer = await makeUser("FARMER");
    await expect(createInputOrder(farmer, { productId: p.id, quantity: 21 })).rejects.toThrow(/stock/);
    const o = await createInputOrder(farmer, { productId: p.id, quantity: 16 });
    await transitionOrder(supplier, o.id, "ACCEPTED");
    await transitionOrder(farmer, o.id, "CONFIRMED");
    const inv = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: p.inventoryItemId } });
    expect(inv.quantity.toString()).toBe("4");
    expect(await prisma.notification.count({ where: { userId: supplier.id, type: "LOW_INVENTORY" } })).toBe(1);
    for (const s of ["PROCESSING", "READY_FOR_PICKUP", "IN_TRANSIT"] as const) await transitionOrder(supplier, o.id, s);
    await transitionOrder(farmer, o.id, "DELIVERED");
    await transitionOrder(farmer, o.id, "COMPLETED");
    const fin = await financialSummary(farmer.id);
    expect(fin.byCategory).toContainEqual({ name: "FERTILIZER", amount: "15360.00" });
    const farmerInv = await prisma.inventoryItem.findFirstOrThrow({ where: { ownerId: farmer.id, name: "Urea 50kg" } });
    expect(farmerInv.quantity.toString()).toBe("16");
  });

  it("records movements and blocks negative stock", async () => {
    const farmer = await makeUser("FARMER");
    const item = await createInventoryItem(farmer, { name: "Compound D", category: "FERTILIZER", unit: "bag", quantity: 5, minStockLevel: 2 });
    await moveStock(farmer, { itemId: item.id, direction: "OUT", quantity: 3, reason: "Field A" });
    await expect(moveStock(farmer, { itemId: item.id, direction: "OUT", quantity: 5 })).rejects.toThrow(/Not enough stock/);
    const other = await makeUser("FARMER");
    await expect(moveStock(other, { itemId: item.id, direction: "IN", quantity: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await prisma.inventoryMovement.count({ where: { itemId: item.id } })).toBe(2);
    expect(await prisma.notification.count({ where: { userId: farmer.id, type: "LOW_INVENTORY" } })).toBe(1);
  });
});

describe("logistics", () => {
  it("transporter accepts, picks up and delivers; the linked order follows", async () => {
    const { farmer, listing } = await maizeListing(30);
    const buyer = await makeUser("BUYER", { province: "LUSAKA", district: "Lusaka" });
    const t1 = await makeUser("TRANSPORTER");
    const t2 = await makeUser("TRANSPORTER");
    const o = await createPurchaseRequest(buyer, { listingId: listing.id, quantity: 10 });
    await transitionOrder(farmer, o.id, "ACCEPTED");
    await expect(requestDelivery(buyer, { orderId: o.id, cargoDescription: "Maize", pickupLocation: "Farm", pickupProvince: "SOUTHERN", pickupDistrict: "Choma", dropoffLocation: "Depot", dropoffProvince: "LUSAKA", dropoffDistrict: "Lusaka" })).rejects.toThrow(/confirmed/);
    await transitionOrder(buyer, o.id, "CONFIRMED");
    await transitionOrder(farmer, o.id, "PROCESSING");
    const d = await requestDelivery(buyer, { orderId: o.id, cargoDescription: "10 bags maize", pickupLocation: "Farm", pickupProvince: "SOUTHERN", pickupDistrict: "Choma", dropoffLocation: "Depot", dropoffProvince: "LUSAKA", dropoffDistrict: "Lusaka" });
    expect((await openRequests(t1)).map((x) => x.id)).toContain(d.id);
    expect(await prisma.notification.count({ where: { userId: t1.id, type: "DELIVERY_REQUEST" } })).toBe(1);

    await updateDelivery(t1, { deliveryId: d.id, status: "ACCEPTED", fee: 2500 });
    await expect(updateDelivery(t2, { deliveryId: d.id, status: "PICKED_UP" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateDelivery(buyer, { deliveryId: d.id, status: "DELIVERED", proofRecipient: "Me" })).rejects.toThrow();
    await updateDelivery(t1, { deliveryId: d.id, status: "PICKED_UP" });
    expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("IN_TRANSIT");
    await expect(updateDelivery(t1, { deliveryId: d.id, status: "DELIVERED" })).rejects.toThrow(/received/);
    await updateDelivery(t1, { deliveryId: d.id, status: "DELIVERED", proofRecipient: "Depot manager" });
    expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("DELIVERED");
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).proofRecipient).toBe("Depot manager");
  });
});
