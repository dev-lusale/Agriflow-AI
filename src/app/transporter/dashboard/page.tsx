import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ClipboardList, Truck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { PageHeader, StatCard } from "@/components/layout/page";
import { DeliveryList } from "@/components/logistics/delivery-list";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatZMW } from "@/lib/money";
import { provinceLabel } from "@/lib/zambia";
import { listDeliveriesFor, openRequests } from "@/server/logistics/service";

export const metadata: Metadata = { title: "Transporter dashboard" };

export default async function TransporterDashboard() {
  const user = await requirePageRole("TRANSPORTER");
  const actor = { id: user.id, role: user.role };
  const [profile, open, mine, earned] = await Promise.all([
    prisma.transporterProfile.findUnique({ where: { userId: user.id } }),
    openRequests(actor),
    listDeliveriesFor(actor),
    prisma.delivery.aggregate({ where: { transporterId: user.id, status: "DELIVERED" }, _sum: { fee: true }, _count: true }),
  ]);
  const active = mine.filter((d) => !["DELIVERED", "CANCELLED"].includes(d.status));
  return (
    <>
      <PageHeader
        title={profile?.businessName ?? "Transporter dashboard"}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            Service areas:
            {profile?.serviceProvinces.map((p) => (
              <Badge key={p}>{provinceLabel(p)}</Badge>
            ))}
            {!profile?.isAvailable && <Badge tone="red">Unavailable</Badge>}
          </span>
        }
        actions={
          <Button asChild>
            <Link href="/transporter/requests">
              <ClipboardList /> View requests ({open.length})
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open requests" value={open.length} hint="In your service areas" icon={ClipboardList} tone="amber" href="/transporter/requests" />
        <StatCard label="Active jobs" value={active.length} icon={Truck} tone="sky" href="/transporter/deliveries" />
        <StatCard label="Completed" value={earned._count} icon={CheckCircle2} />
        <StatCard label="Fees from completed jobs" value={formatZMW(earned._sum.fee ?? 0, { compact: true })} hint="As recorded on deliveries" icon={Wallet} tone="navy" />
      </div>
      <h2 className="mb-3 mt-6 text-base font-semibold">Active jobs</h2>
      <DeliveryList deliveries={active} emptyText="Accept a request to start a job." />
    </>
  );
}
