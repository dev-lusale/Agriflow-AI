import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Badge, Card, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { EmptyState, StatusBadge } from "@/components/layout/page";
import { formatZMW } from "@/lib/money";
import { ORDER_STATUS_LABEL, UNIT_LABEL } from "@/lib/labels";
import { formatDate, formatNumber } from "@/lib/utils";
import type { listOrders } from "@/server/orders/service";

type Orders = Awaited<ReturnType<typeof listOrders>>;

export function OrderList({ orders, hrefBase, perspective, emptyText }: { orders: Orders; hrefBase: string; perspective: "buyer" | "seller"; emptyText: string }) {
  if (!orders.length) return <EmptyState icon={ClipboardList} title="No orders" description={emptyText} />;
  return (
    <Card>
      <Table>
        <THead>
          <tr>
            <TH>Order</TH>
            <TH>Item</TH>
            <TH>{perspective === "buyer" ? "Seller" : "Buyer"}</TH>
            <TH>Quantity</TH>
            <TH>Total</TH>
            <TH>Status</TH>
            <TH>Updated</TH>
          </tr>
        </THead>
        <TBody>
          {orders.map((o) => {
            const item = o.items[0];
            const who = perspective === "buyer" ? (o.seller.supplierProfile?.businessName ?? o.seller.profile?.fullName) : (o.buyer.buyerProfile?.businessName ?? o.buyer.profile?.fullName);
            const attention = (perspective === "seller" && o.status === "PENDING") || (perspective === "buyer" && o.status === "ACCEPTED") || o.status === "NEGOTIATING";
            return (
              <TR key={o.id}>
                <TD>
                  <Link href={`${hrefBase}/${o.id}`} className="font-semibold text-forest-800 hover:underline">
                    {o.orderNumber}
                  </Link>
                  {attention && <Badge tone="amber" className="ml-2">Action needed</Badge>}
                </TD>
                <TD className="max-w-56 truncate">{item?.description}</TD>
                <TD>{who}</TD>
                <TD className="whitespace-nowrap">{item ? `${formatNumber(item.quantity.toString())} ${UNIT_LABEL[item.unit]}` : "—"}</TD>
                <TD className="whitespace-nowrap font-medium">{formatZMW(o.total)}</TD>
                <TD>
                  <StatusBadge status={o.status} label={ORDER_STATUS_LABEL[o.status]} />
                </TD>
                <TD className="whitespace-nowrap text-xs">{formatDate(o.updatedAt)}</TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </Card>
  );
}
