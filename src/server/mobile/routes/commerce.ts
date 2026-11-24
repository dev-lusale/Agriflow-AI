import "server-only";
import type { OrderStatus } from "@prisma/client";
import { parseInput } from "@/lib/action";
import { invalid } from "@/lib/errors";
import { listingSchema, supplierProductSchema } from "@/lib/validation/schemas";
import * as market from "@/server/marketplace/service";
import * as orders from "@/server/orders/service";
import * as suppliers from "@/server/suppliers/service";
import * as inventory from "@/server/inventory/service";
import * as logistics from "@/server/logistics/service";
import * as finance from "@/server/finance/service";
import * as messaging from "@/server/messaging/service";
import { saveImage } from "@/server/storage/service";
import { Res, type RouteDef } from "../http";

const ORDER_STATUSES: OrderStatus[] = ["PENDING", "NEGOTIATING", "ACCEPTED", "CONFIRMED", "PROCESSING", "READY_FOR_PICKUP", "IN_TRANSIT", "DELIVERED", "COMPLETED", "REJECTED", "CANCELLED", "DISPUTED"];
const SELLERS = ["SUPPLIER", "DISTRIBUTOR"] as const;
const STOCK_HOLDERS = ["FARMER", "SUPPLIER", "DISTRIBUTOR"] as const;
const CARRIERS = ["TRANSPORTER", "DISTRIBUTOR"] as const;

export const marketRoutes: RouteDef[] = [
  // Produce listings (farmers sell harvests)
  { method: "GET", path: "/marketplace/listings", auth: true, handler: async ({ query }) => market.searchListings(Object.fromEntries(query.entries())) },
  { method: "GET", path: "/marketplace/listings/:id", auth: true, handler: async ({ params }) => market.getPublicListing(params.id!) },
  { method: "GET", path: "/marketplace/my-listings", auth: ["FARMER"], handler: async ({ actor }) => market.listMyListings(actor) },
  {
    method: "POST",
    path: "/marketplace/listings",
    auth: ["FARMER"],
    handler: async ({ actor, req, form, json }) => {
      if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
        const fd = await form();
        const imageIds: string[] = [];
        for (const f of fd.getAll("photos")) if (f instanceof File && f.size > 0 && imageIds.length < 4) imageIds.push((await saveImage(actor, f, "LISTING_PHOTO")).id);
        return new Res(201, await market.createListing(actor, parseInput(listingSchema, fd), imageIds));
      }
      return new Res(201, await market.createListing(actor, await json()));
    },
  },
  { method: "PATCH", path: "/marketplace/listings/:id", auth: ["FARMER"], handler: async ({ actor, params, json }) => market.updateListing(actor, params.id!, await json()) },
  {
    method: "POST",
    path: "/marketplace/listings/:id/status",
    auth: ["FARMER"],
    handler: async ({ actor, params, json }) => {
      const { status } = await json<{ status?: string }>();
      if (status !== "ACTIVE" && status !== "INACTIVE") throw invalid("Status must be ACTIVE or INACTIVE.");
      return market.setListingStatus(actor, params.id!, status);
    },
  },
  {
    method: "POST",
    path: "/marketplace/report",
    auth: true,
    handler: async ({ actor, json }) => {
      const b = await json<{ entityType?: string; entityId?: string; reason?: string }>();
      if (!b.entityType || !["LISTING", "PRODUCT", "USER", "MESSAGE"].includes(b.entityType) || !b.entityId) throw invalid("Choose what to report.");
      return market.reportContent(actor, b.entityType as "LISTING", b.entityId, String(b.reason ?? ""));
    },
  },
  // Input products (suppliers & distributors sell seed, fertilizer, equipment)
  { method: "GET", path: "/marketplace/products", auth: true, handler: async ({ query }) => suppliers.browseProducts({ q: query.get("q") ?? undefined, category: query.get("category") ?? undefined, supplier: query.get("supplier") ?? undefined }) },
  { method: "GET", path: "/marketplace/products/:id", auth: true, handler: async ({ params }) => suppliers.getProduct(params.id!) },
  { method: "GET", path: "/marketplace/suppliers", auth: true, handler: async () => suppliers.listSuppliers() },
  { method: "GET", path: "/seller/products", auth: [...SELLERS], handler: async ({ actor }) => suppliers.listMyProducts(actor) },
  {
    method: "POST",
    path: "/seller/products",
    auth: [...SELLERS],
    handler: async ({ actor, req, form, json }) => {
      if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
        const fd = await form();
        const img = fd.get("image");
        const imageId = img instanceof File && img.size > 0 ? (await saveImage(actor, img, "PRODUCT_PHOTO")).id : undefined;
        return new Res(201, await suppliers.createProduct(actor, parseInput(supplierProductSchema, fd), imageId));
      }
      return new Res(201, await suppliers.createProduct(actor, await json()));
    },
  },
  { method: "PATCH", path: "/seller/products/:id", auth: [...SELLERS], handler: async ({ actor, params, json }) => suppliers.updateProduct(actor, params.id!, await json()) },
  { method: "GET", path: "/seller/sales", auth: [...SELLERS], handler: async ({ actor }) => suppliers.supplierSales(actor) },
  // Market prices (administrator-recorded observations, each with its source)
  { method: "GET", path: "/market-prices", auth: true, handler: async () => ({ prices: await market.latestMarketPrices(), listingOffers: await market.listingPriceStats() }) },
  { method: "GET", path: "/market-prices/:cropId/history", auth: true, handler: async ({ params, query }) => market.marketPriceSeries(params.cropId!, query.get("province") ?? undefined) },
  // Orders
  {
    method: "GET",
    path: "/orders",
    auth: true,
    handler: async ({ actor, query }) => {
      const as = query.get("as");
      const status = query.get("status") as OrderStatus | null;
      const type = query.get("type");
      return orders.listOrders(actor, {
        as: as === "buyer" || as === "seller" ? as : undefined,
        status: status && ORDER_STATUSES.includes(status) ? status : undefined,
        type: type === "PRODUCE" || type === "INPUT" ? type : undefined,
      });
    },
  },
  {
    method: "GET",
    path: "/orders/:id",
    auth: true,
    handler: async ({ actor, params }) => {
      const o = await orders.getOrder(actor, params.id!);
      return { ...o, availableActions: orders.availableActions(actor, o) };
    },
  },
  { method: "POST", path: "/orders/purchase-request", auth: ["BUYER", "FARMER", "SUPPLIER", "DISTRIBUTOR"], handler: async ({ actor, json }) => new Res(201, await orders.createPurchaseRequest(actor, await json())) },
  { method: "POST", path: "/orders/input-order", auth: ["FARMER", "BUYER"], handler: async ({ actor, json }) => new Res(201, await orders.createInputOrder(actor, await json())) },
  { method: "POST", path: "/orders/:id/counter-offer", auth: true, handler: async ({ actor, params, json }) => orders.counterOffer(actor, { ...(await json<object>()), orderId: params.id! } as never) },
  { method: "POST", path: "/orders/:id/accept-offer", auth: true, handler: async ({ actor, params }) => orders.acceptOffer(actor, params.id!) },
  {
    method: "POST",
    path: "/orders/:id/transition",
    auth: true,
    handler: async ({ actor, params, json }) => {
      const { to, note } = await json<{ to?: string; note?: string }>();
      if (!to || !ORDER_STATUSES.includes(to as OrderStatus)) throw invalid("Unknown order status.");
      return orders.transitionOrder(actor, params.id!, to as OrderStatus, note);
    },
  },
  // Messages with buyers / sellers
  { method: "GET", path: "/conversations", auth: true, handler: async ({ actor }) => messaging.listConversations(actor) },
  { method: "GET", path: "/conversations/:id", auth: true, handler: async ({ actor, params }) => messaging.getConversation(actor, params.id!) },
  { method: "POST", path: "/messages", auth: true, handler: async ({ actor, json }) => new Res(201, await messaging.sendMessage(actor, await json())) },
];

export const opsRoutes: RouteDef[] = [
  // Inventory
  { method: "GET", path: "/inventory", auth: [...STOCK_HOLDERS], handler: async ({ actor }) => inventory.listInventory(actor) },
  { method: "POST", path: "/inventory", auth: [...STOCK_HOLDERS], handler: async ({ actor, json }) => new Res(201, await inventory.createInventoryItem(actor, await json())) },
  { method: "PATCH", path: "/inventory/:id", auth: [...STOCK_HOLDERS], handler: async ({ actor, params, json }) => inventory.updateInventoryItem(actor, params.id!, await json()) },
  { method: "DELETE", path: "/inventory/:id", auth: [...STOCK_HOLDERS], handler: async ({ actor, params }) => (await inventory.deleteInventoryItem(actor, params.id!), { ok: true }) },
  { method: "POST", path: "/inventory/movements", auth: [...STOCK_HOLDERS], handler: async ({ actor, json }) => new Res(201, await inventory.moveStock(actor, await json())) },
  { method: "GET", path: "/inventory/movements", auth: [...STOCK_HOLDERS], handler: async ({ actor, query }) => inventory.movementHistory(actor, query.get("itemId") ?? undefined) },
  // Deliveries
  { method: "GET", path: "/deliveries", auth: true, handler: async ({ actor }) => logistics.listDeliveriesFor(actor) },
  { method: "GET", path: "/deliveries/open", auth: [...CARRIERS], handler: async ({ actor }) => logistics.openRequests(actor) },
  { method: "GET", path: "/deliveries/transporters", auth: true, handler: async ({ query }) => logistics.listTransporters(query.get("province") ?? undefined) },
  { method: "GET", path: "/deliveries/:id", auth: true, handler: async ({ actor, params }) => logistics.getDelivery(actor, params.id!) },
  { method: "POST", path: "/deliveries", auth: ["FARMER", "BUYER", "SUPPLIER", "DISTRIBUTOR"], handler: async ({ actor, json }) => new Res(201, await logistics.requestDelivery(actor, await json())) },
  {
    method: "POST",
    path: "/deliveries/:id/update",
    auth: true,
    handler: async ({ actor, params, req, form, json }) => {
      if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
        const fd = await form();
        const proof = fd.get("proof");
        const proofId = proof instanceof File && proof.size > 0 ? (await saveImage(actor, proof, "PROOF_OF_DELIVERY")).id : undefined;
        const body = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));
        return logistics.updateDelivery(actor, { ...body, deliveryId: params.id! } as never, proofId);
      }
      return logistics.updateDelivery(actor, { ...(await json<object>()), deliveryId: params.id! } as never);
    },
  },
  {
    method: "POST",
    path: "/deliveries/:id/decline",
    auth: [...CARRIERS],
    handler: async ({ actor, params, json }) => {
      const { reason } = await json<{ reason?: string }>().catch(() => ({ reason: undefined }));
      return logistics.declineDelivery(actor, params.id!, reason);
    },
  },
  { method: "GET", path: "/vehicles", auth: [...CARRIERS], handler: async ({ actor }) => logistics.listVehicles(actor) },
  { method: "POST", path: "/vehicles", auth: [...CARRIERS], handler: async ({ actor, json }) => new Res(201, await logistics.addVehicle(actor, await json())) },
  // Finance (farmers)
  {
    method: "GET",
    path: "/finance/summary",
    auth: ["FARMER"],
    handler: async ({ actor, query }) => {
      const from = query.get("from");
      const to = query.get("to");
      return finance.financialSummary(actor.id, { from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined });
    },
  },
  {
    method: "GET",
    path: "/finance/transactions",
    auth: ["FARMER"],
    handler: async ({ actor, query }) => {
      const from = query.get("from");
      const to = query.get("to");
      const type = query.get("type");
      return finance.listTransactions(actor, {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        type: type === "INCOME" || type === "EXPENSE" ? type : undefined,
        take: Math.min(Number(query.get("take") ?? 200), 1000),
      });
    },
  },
  { method: "POST", path: "/finance/transactions", auth: ["FARMER"], handler: async ({ actor, json }) => new Res(201, await finance.recordTransaction(actor, await json())) },
  { method: "DELETE", path: "/finance/transactions/:id", auth: ["FARMER"], handler: async ({ actor, params }) => (await finance.deleteTransaction(actor, params.id!), { ok: true }) },
  {
    method: "GET",
    path: "/finance/transactions.csv",
    auth: ["FARMER"],
    handler: async ({ actor }) => {
      const csv = finance.transactionsToCsv(await finance.listTransactions(actor, { take: 5000 }));
      return new Res(200, csv, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="agriflow-farm-transactions.csv"` }, true);
    },
  },
  { method: "GET", path: "/finance/estimates", auth: ["FARMER"], handler: async ({ actor }) => finance.listEstimates(actor) },
  { method: "POST", path: "/finance/estimates", auth: ["FARMER"], handler: async ({ actor, json }) => new Res(201, await finance.recordEstimate(actor, await json())) },
];
