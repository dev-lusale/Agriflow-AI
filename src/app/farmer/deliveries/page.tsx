import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page";
import { FormDialog } from "@/components/forms/form-dialog";
import { DeliveryList } from "@/components/logistics/delivery-list";
import { DeliveryRequestForm } from "@/components/orders/delivery-request-form";
import { requirePageRole } from "@/lib/auth/session";
import { listDeliveriesFor } from "@/server/logistics/service";
import { Plus } from "lucide-react";

export const metadata: Metadata = { title: "Deliveries" };

export default async function DeliveriesPage() {
  const user = await requirePageRole("FARMER");
  const deliveries = await listDeliveriesFor({ id: user.id, role: user.role });
  return (
    <>
      <PageHeader
        title="Deliveries"
        description="Transport you have requested, and deliveries linked to your orders. Track pickup, transit and proof of delivery."
        actions={
          <FormDialog trigger={<><Plus /> Request transport</>} title="Request transport" description="For marketplace orders, request transport from the order page so the delivery is linked." wide>
            <DeliveryRequestForm pickup={{ province: user.profile?.province ?? null, district: user.profile?.district ?? null }} />
          </FormDialog>
        }
      />
      <DeliveryList deliveries={deliveries} emptyText="Request transport from a confirmed order, or create a standalone request." />
    </>
  );
}
