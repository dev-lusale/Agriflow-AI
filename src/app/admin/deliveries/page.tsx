import type { Metadata } from "next";
import { PageHeader, StatusBadge } from "@/components/layout/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { DeliveryList } from "@/components/logistics/delivery-list";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { DELIVERY_STATUS_LABEL } from "@/lib/labels";
import { provinceLabel } from "@/lib/zambia";

export const metadata: Metadata = { title: "Deliveries" };

export default async function AdminDeliveriesPage() {
  await requirePageRole("ADMIN", "SUPER_ADMIN");
  const [deliveries, byStatus, byProvince] = await Promise.all([
    prisma.delivery.findMany({
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        order: { select: { id: true, orderNumber: true, status: true, buyerId: true, sellerId: true, type: true } },
        requestedBy: { select: { id: true, role: true, phone: true, profile: { select: { fullName: true } } } },
        transporter: { select: { id: true, phone: true, profile: { select: { fullName: true } }, transporterProfile: { select: { businessName: true, contactPhone: true } } } },
        vehicle: true,
        events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { profile: { select: { fullName: true } } } } } },
      },
    }),
    prisma.delivery.groupBy({ by: ["status"], _count: true }),
    prisma.delivery.groupBy({ by: ["pickupProvince"], _count: true }),
  ]);
  return (
    <>
      <PageHeader title="Delivery activity" description="All transport requests and jobs across the platform." />
      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {byStatus.map((s) => (
              <div key={s.status} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
                <StatusBadge status={s.status} label={DELIVERY_STATUS_LABEL[s.status]} />
                <span className="font-bold">{s._count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By pickup province</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {byProvince.map((p) => (
              <div key={p.pickupProvince} className="rounded-xl border border-border px-3 py-2 text-sm">
                {provinceLabel(p.pickupProvince)} <span className="font-bold">{p._count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <DeliveryList deliveries={deliveries} emptyText="No deliveries yet." />
    </>
  );
}
