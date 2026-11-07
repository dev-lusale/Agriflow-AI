import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardList, Package, Scale } from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/layout/page";
import { requirePageRole } from "@/lib/auth/session";
import { provinceLabel } from "@/lib/zambia";
import { formatDate, relativeTime } from "@/lib/utils";
import { openRequests } from "@/server/logistics/service";

export const metadata: Metadata = { title: "Delivery requests" };

export default async function RequestsPage() {
  const user = await requirePageRole("TRANSPORTER");
  const requests = await openRequests({ id: user.id, role: user.role });
  return (
    <>
      <PageHeader title="Delivery requests" description="Open requests with pickup in your service provinces, plus requests sent directly to you. The first transporter to accept gets the job." />
      {requests.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No open requests" description="New requests in your service areas will appear here and as notifications." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {requests.map((d) => (
            <Card key={d.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{d.cargoDescription}</p>
                  <p className="text-xs text-navy-500">
                    {d.deliveryNumber} · requested {relativeTime(d.createdAt)} by {d.requestedBy.profile?.fullName}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {d.transporterId === user.id && <Badge tone="blue">Sent to you</Badge>}
                  {d.isDemo && <Badge tone="amber">Demo</Badge>}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-navy-50 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{d.pickupDistrict}</p>
                  <p className="truncate text-xs text-navy-500">{provinceLabel(d.pickupProvince)}</p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-forest-600" />
                <div className="min-w-0 flex-1 text-right">
                  <p className="font-medium">{d.dropoffDistrict}</p>
                  <p className="truncate text-xs text-navy-500">{provinceLabel(d.dropoffProvince)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-navy-600">
                {d.weightKg && (
                  <span className="flex items-center gap-1">
                    <Scale className="size-3.5" /> {d.weightKg.toLocaleString()} kg
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Package className="size-3.5" /> Needed by {formatDate(d.expectedDate)}
                </span>
                {d.order && <span>Order {d.order.orderNumber}</span>}
              </div>
              <Button asChild className="mt-4 w-full">
                <Link href={`/deliveries/${d.id}`}>Review & accept</Link>
              </Button>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
