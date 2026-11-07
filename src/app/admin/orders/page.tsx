import type { Metadata } from "next";
import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { Badge, Card, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { PageHeader, StatusBadge } from "@/components/layout/page";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatZMW } from "@/lib/money";
import { ORDER_STATUS_LABEL } from "@/lib/labels";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "All orders" };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; type?: string }> }) {
  await requirePageRole("ADMIN", "SUPER_ADMIN");
  const sp = await searchParams;
  const status = Object.keys(ORDER_STATUS_LABEL).includes(sp.status ?? "") ? (sp.status as OrderStatus) : undefined;
  const orders = await prisma.purchaseOrder.findMany({
    where: { ...(status ? { status } : {}), ...(sp.type === "PRODUCE" || sp.type === "INPUT" ? { type: sp.type } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: { items: true, buyer: { select: { profile: { select: { fullName: true } } } }, seller: { select: { profile: { select: { fullName: true } } } } },
  });
  const total = orders.reduce((a, o) => a + Number(o.total), 0);
  return (
    <>
      <PageHeader title="Orders" description={`${orders.length} orders shown · value ${formatZMW(total)}. Open an order to review its history or resolve a dispute.`} />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="?" className={cn("rounded-full px-3 py-1.5 font-medium ring-1", !status ? "bg-forest-800 text-white ring-forest-800" : "bg-white ring-border")}>
          All
        </Link>
        {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((s) => (
          <Link key={s} href={`?status=${s}`} className={cn("rounded-full px-3 py-1.5 font-medium ring-1", status === s ? "bg-forest-800 text-white ring-forest-800" : "bg-white text-navy-700 ring-border")}>
            {ORDER_STATUS_LABEL[s]}
          </Link>
        ))}
      </div>
      <Card>
        <Table>
          <THead>
            <tr>
              <TH>Order</TH>
              <TH>Type</TH>
              <TH>Item</TH>
              <TH>Buyer</TH>
              <TH>Seller</TH>
              <TH>Total</TH>
              <TH>Status</TH>
              <TH>Updated</TH>
            </tr>
          </THead>
          <TBody>
            {orders.map((o) => (
              <TR key={o.id}>
                <TD>
                  <Link href={`/admin/orders/${o.id}`} className="font-semibold text-forest-800 hover:underline">
                    {o.orderNumber}
                  </Link>
                  {o.isDemo && <Badge tone="amber" className="ml-1">demo</Badge>}
                </TD>
                <TD>
                  <Badge>{o.type.toLowerCase()}</Badge>
                </TD>
                <TD className="max-w-48 truncate">{o.items[0]?.description}</TD>
                <TD>{o.buyer.profile?.fullName}</TD>
                <TD>{o.seller.profile?.fullName}</TD>
                <TD className="whitespace-nowrap font-medium">{formatZMW(o.total)}</TD>
                <TD>
                  <StatusBadge status={o.status} label={ORDER_STATUS_LABEL[o.status]} />
                </TD>
                <TD className="text-xs">{formatDate(o.updatedAt)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
