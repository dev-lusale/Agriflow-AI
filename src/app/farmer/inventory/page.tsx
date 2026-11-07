import type { Metadata } from "next";
import { InventoryView } from "@/components/inventory/inventory-view";
import { requirePageRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Inventory" };

export default async function Page() {
  const user = await requirePageRole("FARMER");
  return <InventoryView actor={{ id: user.id, role: user.role }} title="Farm inventory" description="Seeds, fertilizer, crop protection, tools, equipment and harvested produce, with stock movements and low-stock alerts." />;
}
