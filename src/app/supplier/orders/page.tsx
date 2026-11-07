import type { Metadata } from "next";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page";
import { OrderList } from "@/components/orders/order-list";
import { requirePageRole } from "@/lib/auth/session";
import { listOrders } from "@/server/orders/service";

export const metadata: Metadata = { title: "Orders" };

export default async function SupplierOrdersPage() {
  const user = await requirePageRole("SUPPLIER");
  const orders = await listOrders({ id: user.id, role: user.role }, { as: "seller", type: "INPUT" });
  return (
    <>
      <PageHeader
        title="Purchase orders"
        description="Accept orders, then move them through processing, dispatch and delivery. Stock is reserved when the farmer confirms."
        actions={
          <Button asChild variant="outline">
            <a href="/api/export/orders">
              <Download /> Export CSV
            </a>
          </Button>
        }
      />
      <OrderList orders={orders} hrefBase="/supplier/orders" perspective="seller" emptyText="Farmers' purchase orders will appear here." />
    </>
  );
}
