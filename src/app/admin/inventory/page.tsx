import type { Metadata } from "next";
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { PageHeader, StatCard } from "@/components/layout/page";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { INVENTORY_CATEGORY_LABEL } from "@/lib/labels";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { lowStockSuppliers } from "@/server/analytics/service";

export const metadata: Metadata = { title: "Inventory overview" };

export default async function AdminInventoryPage() {
  await requirePageRole("ADMIN", "SUPER_ADMIN");
  const [low, byCategory, movements, itemCount] = await Promise.all([
    lowStockSuppliers(),
    prisma.inventoryItem.groupBy({ by: ["category"], _count: true }),
    prisma.inventoryMovement.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { item: { select: { name: true, unit: true, owner: { select: { role: true, profile: { select: { fullName: true } } } } } } } }),
    prisma.inventoryItem.count(),
  ]);
  return (
    <>
      <PageHeader title="Inventory overview" description="Stock tracked by farmers and suppliers, with low-stock warnings for supplier products." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Inventory items" value={itemCount} />
        <StatCard label="Supplier items at low stock" value={low.length} tone={low.length ? "amber" : "forest"} />
        {byCategory.slice(0, 2).map((c) => (
          <StatCard key={c.category} label={INVENTORY_CATEGORY_LABEL[c.category]} value={c._count} tone="navy" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Suppliers with low stock</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <THead>
                <tr>
                  <TH>Supplier</TH>
                  <TH>Item</TH>
                  <TH>Stock</TH>
                  <TH>Minimum</TH>
                </tr>
              </THead>
              <TBody>
                {low.map((l, i) => (
                  <TR key={i}>
                    <TD>{l.supplier}</TD>
                    <TD>{l.item}</TD>
                    <TD className="font-semibold text-harvest-700">{formatNumber(l.quantity)}</TD>
                    <TD>{formatNumber(l.minimum)}</TD>
                  </TR>
                ))}
                {!low.length && (
                  <TR>
                    <TD colSpan={4} className="text-center text-navy-500">
                      No supplier items below minimum.
                    </TD>
                  </TR>
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent stock movements</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <THead>
                <tr>
                  <TH>When</TH>
                  <TH>Owner</TH>
                  <TH>Item</TH>
                  <TH>Change</TH>
                </tr>
              </THead>
              <TBody>
                {movements.map((m) => (
                  <TR key={m.id}>
                    <TD className="text-xs">{formatDateTime(m.createdAt)}</TD>
                    <TD className="text-xs">
                      {m.item.owner.profile?.fullName} <Badge>{m.item.owner.role.toLowerCase()}</Badge>
                    </TD>
                    <TD>{m.item.name}</TD>
                    <TD className={m.quantityChange.gt(0) ? "text-forest-700" : ""}>
                      {m.quantityChange.gt(0) ? "+" : ""}
                      {formatNumber(m.quantityChange.toString())} {m.item.unit}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
