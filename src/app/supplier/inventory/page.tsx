import type { Metadata } from "next";
import { InventoryView } from "@/components/inventory/inventory-view";
import { requirePageRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Inventory" };

export default async function Page() {
  const user = await requirePageRole("SUPPLIER");
  return <InventoryView actor={{ id: user.id, role: user.role }} title="Stock management" description="Stock for every product you list. Confirmed orders reduce stock automatically; record deliveries from your own suppliers here." />;
}
