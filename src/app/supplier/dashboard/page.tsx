import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ClipboardList, Package, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { PageHeader, StatCard, HeroCard } from "@/components/layout/page";
import { OrderList } from "@/components/orders/order-list";
import { GroupedBars } from "@/components/charts/charts";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatZMW } from "@/lib/money";
import { listOrders } from "@/server/orders/service";
import { supplierSales } from "@/server/suppliers/service";
import { listInventory } from "@/server/inventory/service";

export const metadata: Metadata = { title: "Supplier dashboard" };

export default async function SupplierDashboard() {
  const user = await requirePageRole("SUPPLIER");
  const actor = { id: user.id, role: user.role };
  const [sales, orders, inv, products, profile] = await Promise.all([
    supplierSales(actor),
    listOrders(actor, { as: "seller", type: "INPUT" }),
    listInventory(actor),
    prisma.supplierProduct.count({ where: { supplierId: user.id, isActive: true } }),
    prisma.supplierProfile.findUnique({ where: { userId: user.id } }),
  ]);
  const open = orders.filter((o) => !["COMPLETED", "CANCELLED", "REJECTED"].includes(o.status));
  return (
    <>
      <PageHeader
        title={profile?.businessName ?? "Supplier dashboard"}
        description="Products, stock and orders from farmers across Zambia."
        actions={
          <Button asChild>
            <Link href="/supplier/products?new=1">
              <Plus /> Add product
            </Link>
          </Button>
        }
      />
      <HeroCard className="mb-4" eyebrow={profile?.businessName ?? "AgriFlow supplier"} label="Completed sales revenue" value={formatZMW(sales.revenue)} meta={[["Completed orders", String(sales.completed)], ["Open orders", String(open.length)], ["Active products", String(products)]]} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active products" value={products} icon={Package} href="/supplier/products" />
        <StatCard label="Open orders" value={open.length} icon={ClipboardList} tone="sky" href="/supplier/orders" />
        <StatCard label="Completed sales" value={formatZMW(sales.revenue, { compact: true })} hint={`${sales.completed} orders`} icon={Wallet} tone="navy" href="/supplier/reports" />
        <StatCard label="Low-stock items" value={inv.low.length} icon={AlertTriangle} tone={inv.low.length ? "amber" : "forest"} href="/supplier/inventory" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold">Orders to fulfil</h2>
          <OrderList orders={open} hrefBase="/supplier/orders" perspective="seller" emptyText="Orders from farmers will appear here." />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly sales (ZMW)</CardTitle>
            </CardHeader>
            <CardContent>{sales.monthly.length ? <GroupedBars data={sales.monthly} xKey="month" series={[{ key: "total", label: "Sales" }]} money height={200} /> : <p className="text-sm text-navy-500">No completed sales yet.</p>}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Low stock</CardTitle>
            </CardHeader>
            <CardContent>
              {inv.low.length ? (
                <ul className="space-y-2 text-sm">
                  {inv.low.map((i) => (
                    <li key={i.id} className="flex justify-between gap-2">
                      <span>{i.name}</span>
                      <span className="font-semibold text-harvest-700">
                        {i.quantity.toString()} {i.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-navy-500">All products above minimum stock.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
