import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page";
import { DeliveryList } from "@/components/logistics/delivery-list";
import { requirePageRole } from "@/lib/auth/session";
import { listDeliveriesFor } from "@/server/logistics/service";

export const metadata: Metadata = { title: "My deliveries" };

export default async function TransporterDeliveriesPage() {
  const user = await requirePageRole("TRANSPORTER");
  const deliveries = await listDeliveriesFor({ id: user.id, role: user.role });
  return (
    <>
      <PageHeader title="My deliveries" description="Jobs you have accepted: schedule pickup, update transit status and record proof of delivery." />
      <DeliveryList deliveries={deliveries} emptyText="Accepted jobs and your delivery history appear here." />
    </>
  );
}
