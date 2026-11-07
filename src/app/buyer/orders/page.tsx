import type { Metadata } from "next";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page";
import { OrderList } from "@/components/orders/order-list";
import { requirePageRole } from "@/lib/auth/session";
import { listOrders } from "@/server/orders/service";

export const metadata: Metadata = { title: "My orders" };

export default async function BuyerOrdersPage() {
  const user = await requirePageRole("BUYER");
  const orders = await listOrders({ id: user.id, role: user.role }, { as: "buyer" });
  return (
    <>
      <PageHeader
        title="Purchase orders"
        description="Track requests, negotiations, confirmations and deliveries. Download your full purchase history."
        actions={
          <Button asChild variant="outline">
            <a href="/api/export/orders">
              <Download /> Download history (CSV)
            </a>
          </Button>
        }
      />
      <OrderList orders={orders} hrefBase="/buyer/orders" perspective="buyer" emptyText="Find produce in the marketplace and send a purchase request." />
    </>
  );
}
