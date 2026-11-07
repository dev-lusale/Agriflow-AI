import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, MapPin } from "lucide-react";
import type { DeliveryStatus } from "@prisma/client";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { KeyValue, PageHeader, StatusBadge } from "@/components/layout/page";
import { DeliveryActions } from "@/components/logistics/delivery-actions";
import { requireUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { formatZMW } from "@/lib/money";
import { DELIVERY_FLOW, DELIVERY_STATUS_LABEL } from "@/lib/labels";
import { provinceLabel } from "@/lib/zambia";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { getDelivery } from "@/server/logistics/service";
import { deliveryTransitions, type DeliveryParty } from "@/server/orders/machine";

export const metadata: Metadata = { title: "Delivery" };

export default async function DeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const actor = { id: user.id, role: user.role };
  let d;
  try {
    d = await getDelivery(actor, id);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const party: DeliveryParty =
    d.transporterId === user.id || (user.role === "TRANSPORTER" && !d.transporterId) ? "TRANSPORTER" : user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "ADMIN" : "REQUESTER";
  const next = deliveryTransitions(d.status, party) as DeliveryStatus[];
  const vehicles = party === "TRANSPORTER" ? await prisma.vehicle.findMany({ where: { ownerId: user.id, isActive: true }, select: { id: true, type: true, registration: true, capacityKg: true } }) : [];
  const idx = DELIVERY_FLOW.indexOf(d.status);
  const back = user.role === "TRANSPORTER" ? "/transporter/deliveries" : user.role === "BUYER" ? "/buyer/deliveries" : user.role === "FARMER" ? "/farmer/deliveries" : user.role === "SUPPLIER" ? "/supplier/orders" : "/admin/deliveries";
  const orderHref = d.order ? (user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? `/admin/orders/${d.order.id}` : user.role === "BUYER" ? `/buyer/orders/${d.order.id}` : user.role === "SUPPLIER" ? `/supplier/orders/${d.order.id}` : user.role === "FARMER" ? `/farmer/orders/${d.order.id}` : null) : null;

  return (
    <>
      <PageHeader back={{ href: back, label: "Deliveries" }} title={`Delivery ${d.deliveryNumber}`} description={d.cargoDescription} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusBadge status={d.status} label={DELIVERY_STATUS_LABEL[d.status]} />
                {d.isDemo && <Badge tone="amber">Demo</Badge>}
              </div>
              <ol className="mt-5 grid grid-cols-3 gap-y-3 sm:grid-cols-6">
                {DELIVERY_FLOW.map((s, i) => {
                  const done = idx >= i && idx !== -1;
                  return (
                    <li key={s} className="flex flex-col items-center text-center">
                      {done ? <CheckCircle2 className="size-5 text-forest-600" /> : <Circle className="size-5 text-navy-300" />}
                      <span className={cn("mt-1 text-[11px]", done ? "font-medium text-forest-800" : "text-navy-400")}>{DELIVERY_STATUS_LABEL[s]}</span>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Route</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {[
                ["Pickup", d.pickupLocation, d.pickupDistrict, d.pickupProvince],
                ["Delivery", d.dropoffLocation, d.dropoffDistrict, d.dropoffProvince],
              ].map(([label, loc, dist, prov]) => (
                <div key={label} className="rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">{label}</p>
                  <p className="mt-1 flex items-start gap-1.5 font-medium">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-forest-600" />
                    {loc}
                  </p>
                  <p className="text-sm text-navy-500">
                    {dist}, {provinceLabel(prov)}
                  </p>
                </div>
              ))}
              <p className="text-xs text-navy-500 sm:col-span-2">Map view and route optimisation are planned. Coordinates and tracking events are already stored for each delivery.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Tracking history</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l border-border pl-5">
                {d.events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[25px] top-1 size-2.5 rounded-full bg-forest-500 ring-4 ring-white" />
                    <p className="text-sm font-medium">{DELIVERY_STATUS_LABEL[e.status]}</p>
                    <p className="text-xs text-navy-500">
                      {formatDateTime(e.createdAt)} · {e.actor?.profile?.fullName ?? "System"}
                      {e.note ? ` · ${e.note}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          {next.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Update delivery</CardTitle>
              </CardHeader>
              <CardContent>
                <DeliveryActions deliveryId={d.id} next={next} vehicles={vehicles} canDecline={party === "TRANSPORTER" && d.status === "REQUESTED" && d.transporterId === user.id} />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <KeyValue
                className="sm:grid-cols-1"
                items={[
                  ["Transporter", d.transporter ? `${d.transporter.transporterProfile?.businessName ?? d.transporter.profile?.fullName}${d.transporter.transporterProfile?.contactPhone ? ` · ${d.transporter.transporterProfile.contactPhone}` : ""}` : "Awaiting a transporter"],
                  ["Vehicle", d.vehicle ? `${d.vehicle.type.replaceAll("_", " ").toLowerCase()} ${d.vehicle.registration ?? ""} (${d.vehicle.capacityKg.toLocaleString()} kg)` : "—"],
                  ["Requested by", d.requestedBy.profile?.fullName],
                  ["Weight", d.weightKg ? `${d.weightKg.toLocaleString()} kg` : "—"],
                  ["Fee", d.fee ? formatZMW(d.fee) : "To be agreed"],
                  ["Expected", formatDate(d.expectedDate)],
                  ["Pickup scheduled", formatDateTime(d.scheduledPickupAt)],
                  ["Notes", d.notes ?? "—"],
                  ["Linked order", d.order ? orderHref ? <Link key="o" href={orderHref} className="font-medium text-forest-700 hover:underline">{d.order.orderNumber}</Link> : d.order.orderNumber : "—"],
                ]}
              />
            </CardContent>
          </Card>
          {d.status === "DELIVERED" && (
            <Card>
              <CardHeader>
                <CardTitle>Proof of delivery</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <KeyValue className="sm:grid-cols-1" items={[["Received by", d.proofRecipient], ["Delivered", formatDateTime(d.deliveredAt)], ["Notes", d.proofNotes ?? "—"]]} />
                {d.proofUploadId && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/uploads/${d.proofUploadId}`} alt="Proof of delivery" className="rounded-xl border border-border" />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
