import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { listTransactions, transactionsToCsv } from "@/server/finance/service";

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Prevent CSV formula injection in spreadsheet apps
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** CSV exports: /api/export/transactions (farmer), /api/export/orders (any party), /api/export/inventory. */
export async function GET(_req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  let csv = "";
  let name = kind;
  if (kind === "transactions") {
    if (user.role !== "FARMER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    csv = transactionsToCsv(await listTransactions({ id: user.id, role: user.role }, { take: 5000 }));
    name = "agriflow-farm-transactions";
  } else if (kind === "orders") {
    const orders = await prisma.purchaseOrder.findMany({
      where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
      orderBy: { createdAt: "desc" },
      include: { items: true, buyer: { select: { profile: { select: { fullName: true } } } }, seller: { select: { profile: { select: { fullName: true } } } } },
      take: 5000,
    });
    csv = [
      "Order number,Type,Role,Status,Created,Completed,Items,Quantity,Unit price (ZMW),Total (ZMW),Counterparty",
      ...orders.map((o) =>
        [o.orderNumber, o.type, o.buyerId === user.id ? "Buyer" : "Seller", o.status, o.createdAt.toISOString().slice(0, 10), o.completedAt?.toISOString().slice(0, 10) ?? "", o.items.map((i) => i.description).join("; "), o.items.map((i) => `${i.quantity} ${i.unit}`).join("; "), o.items.map((i) => i.unitPrice.toFixed(2)).join("; "), o.total.toFixed(2), o.buyerId === user.id ? o.seller.profile?.fullName : o.buyer.profile?.fullName]
          .map(esc)
          .join(","),
      ),
    ].join("\n");
    name = "agriflow-orders";
  } else if (kind === "inventory") {
    if (user.role !== "FARMER" && user.role !== "SUPPLIER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const items = await prisma.inventoryItem.findMany({ where: { ownerId: user.id }, orderBy: { name: "asc" } });
    csv = [
      "Item,Category,Quantity,Unit,Unit cost (ZMW),Value (ZMW),Minimum level,Storage,Expiry",
      ...items.map((i) => [i.name, i.category, i.quantity.toString(), i.unit, i.unitCost?.toFixed(2) ?? "", i.unitCost ? i.quantity.times(i.unitCost).toFixed(2) : "", i.minStockLevel.toString(), i.storageLocation ?? "", i.expiryDate?.toISOString().slice(0, 10) ?? ""].map(esc).join(",")),
    ].join("\n");
    name = "agriflow-inventory";
  } else {
    return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  }
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
