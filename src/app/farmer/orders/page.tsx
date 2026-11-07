import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page";
import { OrderList } from "@/components/orders/order-list";
import { requirePageRole } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { listOrders } from "@/server/orders/service";

export const metadata: Metadata = { title: "Orders" };

export default async function FarmerOrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const user = await requirePageRole("FARMER");
  const actor = { id: user.id, role: user.role };
  const purchases = tab === "purchases";
  const orders = purchases ? await listOrders(actor, { as: "buyer", type: "INPUT" }) : await listOrders(actor, { as: "seller", type: "PRODUCE" });
  return (
    <>
      <PageHeader
        title="Orders"
        description="Produce sales from buyers, and input purchases you've made from suppliers."
        actions={
          <Button asChild variant="outline">
            <a href="/api/export/orders">
              <Download /> Export CSV
            </a>
          </Button>
        }
      />
      <div className="mb-4 inline-flex rounded-full bg-white/70 p-1 shadow-sm ring-1 ring-black/[0.04] backdrop-blur text-sm">
        {[
          ["sales", "Produce sales"],
          ["purchases", "Input purchases"],
        ].map(([k, l]) => (
          <Link key={k} href={`?tab=${k}`} className={cn("rounded-full px-4 py-1.5 font-medium transition-colors", (purchases ? "purchases" : "sales") === k ? "bg-ink text-white shadow-sm" : "text-navy-600 hover:text-navy-900")}>
            {l}
          </Link>
        ))}
      </div>
      <OrderList orders={orders} hrefBase="/farmer/orders" perspective={purchases ? "buyer" : "seller"} emptyText={purchases ? "Order seed, fertilizer and equipment from Market & inputs." : "When buyers send purchase requests for your listings, they appear here."} />
    </>
  );
}
