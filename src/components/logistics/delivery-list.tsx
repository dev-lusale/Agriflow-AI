import Link from "next/link";
import { ArrowRight, Truck } from "lucide-react";
import { Badge, Card, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { EmptyState, StatusBadge } from "@/components/layout/page";
import { formatZMW } from "@/lib/money";
import { DELIVERY_STATUS_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import type { listDeliveriesFor } from "@/server/logistics/service";

type Deliveries = Awaited<ReturnType<typeof listDeliveriesFor>>;

export function DeliveryList({ deliveries, emptyText }: { deliveries: Deliveries; emptyText: string }) {
  if (!deliveries.length) return <EmptyState icon={Truck} title="No deliveries" description={emptyText} />;
  return (
    <Card>
      <Table>
        <THead>
          <tr>
            <TH>Delivery</TH>
            <TH>Cargo</TH>
            <TH>Route</TH>
            <TH>Transporter</TH>
            <TH>Fee</TH>
            <TH>Expected</TH>
            <TH>Status</TH>
          </tr>
        </THead>
        <TBody>
          {deliveries.map((d) => (
            <TR key={d.id}>
              <TD>
                <Link href={`/deliveries/${d.id}`} className="font-semibold text-forest-800 hover:underline">
                  {d.deliveryNumber}
                </Link>
                {d.order && <p className="text-xs text-navy-500">Order {d.order.orderNumber}</p>}
                {d.isDemo && <Badge tone="amber" className="mt-1">Demo</Badge>}
              </TD>
              <TD className="max-w-48 truncate">{d.cargoDescription}</TD>
              <TD className="whitespace-nowrap text-sm">
                {d.pickupDistrict} <ArrowRight className="inline size-3.5 text-navy-400" /> {d.dropoffDistrict}
              </TD>
              <TD>{d.transporter?.transporterProfile?.businessName ?? <span className="text-navy-400">Unassigned</span>}</TD>
              <TD>{d.fee ? formatZMW(d.fee) : "—"}</TD>
              <TD className="whitespace-nowrap text-xs">{formatDate(d.expectedDate)}</TD>
              <TD>
                <StatusBadge status={d.status} label={DELIVERY_STATUS_LABEL[d.status]} />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
