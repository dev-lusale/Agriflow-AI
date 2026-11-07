import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, MessageSquare, ShoppingBasket, Truck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { PageHeader, StatCard } from "@/components/layout/page";
import { OrderList } from "@/components/orders/order-list";
import { ListingCard } from "@/components/marketplace/listing-card";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatZMW } from "@/lib/money";
import { listOrders } from "@/server/orders/service";
import { listingCardInclude } from "@/server/marketplace/service";
import { unreadConversationCount } from "@/server/messaging/service";

export const metadata: Metadata = { title: "Buyer dashboard" };

export default async function BuyerDashboard() {
  const user = await requirePageRole("BUYER");
  const actor = { id: user.id, role: user.role };
  const profile = await prisma.buyerProfile.findUnique({ where: { userId: user.id } });
  const [orders, spent, deliveries, unread, recommended] = await Promise.all([
    listOrders(actor, { as: "buyer" }),
    prisma.purchaseOrder.aggregate({ where: { buyerId: user.id, status: "COMPLETED" }, _sum: { total: true } }),
    prisma.delivery.count({ where: { OR: [{ requestedById: user.id }, { order: { buyerId: user.id } }], status: { notIn: ["DELIVERED", "CANCELLED"] } } }),
    unreadConversationCount(user.id),
    prisma.produceListing.findMany({
      where: { status: "ACTIVE", moderationStatus: { not: "REMOVED" }, quantityAvailable: { gt: 0 }, ...(profile?.preferredCrops.length ? { crop: { name: { in: profile.preferredCrops } } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: listingCardInclude,
    }),
  ]);
  const active = orders.filter((o) => !["COMPLETED", "CANCELLED", "REJECTED"].includes(o.status));
  return (
    <>
      <PageHeader
        title={`Welcome, ${user.profile?.fullName?.split(" ")[0] ?? "buyer"}`}
        description={profile?.businessName ?? "Source produce directly from Zambian farmers."}
        actions={
          <Button asChild>
            <Link href="/buyer/marketplace">
              <ShoppingBasket /> Browse produce
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active orders" value={active.length} icon={ClipboardList} href="/buyer/orders" />
        <StatCard label="Deliveries in progress" value={deliveries} icon={Truck} tone="sky" href="/buyer/deliveries" />
        <StatCard label="Completed purchases" value={formatZMW(spent._sum.total ?? 0, { compact: true })} icon={Wallet} tone="navy" />
        <StatCard label="Unread conversations" value={unread} icon={MessageSquare} tone="amber" href="/messages" />
      </div>
      <div className="mt-6 space-y-6">
        <div>
          <h2 className="mb-3 text-base font-semibold">Orders needing attention</h2>
          <OrderList orders={active.slice(0, 8)} hrefBase="/buyer/orders" perspective="buyer" emptyText="Send a purchase request from the marketplace." />
        </div>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{profile?.preferredCrops.length ? `New listings: ${profile.preferredCrops.join(", ")}` : "New listings"}</CardTitle>
            <Link href="/buyer/marketplace" className="text-xs font-semibold text-forest-700 hover:underline">
              See all
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recommended.map((l) => (
                <ListingCard key={l.id} listing={l} href={`/buyer/marketplace/${l.id}`} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
