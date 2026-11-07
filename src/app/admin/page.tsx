import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Brain, ClipboardList, Flag, Grid3x3, Package, ShoppingCart, Sprout, Store, Tractor, Truck, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { PageHeader, StatCard, StatusBadge, HeroCard } from "@/components/layout/page";
import { GroupedBars, RankedBars, StackedBars } from "@/components/charts/charts";
import { requirePageRole } from "@/lib/auth/session";
import { formatZMW } from "@/lib/money";
import { DELIVERY_STATUS_LABEL, ORDER_STATUS_LABEL } from "@/lib/labels";
import { formatNumber, relativeTime } from "@/lib/utils";
import { activityByProvince, cropDistribution, platformStats, produceAvailability, recentPlatformActivity, registrationsByMonth, salesByMonth } from "@/server/analytics/service";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminOverview() {
  await requirePageRole("ADMIN", "SUPER_ADMIN");
  const [s, regs, crops, avail, sales, provinces, activity] = await Promise.all([platformStats(), registrationsByMonth(12), cropDistribution(), produceAvailability(), salesByMonth(12), activityByProvince(), recentPlatformActivity(10)]);
  return (
    <>
      <PageHeader
        title="Platform overview"
        description="Every figure on this page is computed live from the database."
        actions={
          <Button asChild>
            <Link href="/admin/ai">
              <Brain /> AI business intelligence
            </Link>
          </Button>
        }
      />
      {(s.listingsPendingReview > 0 || s.openContentReports > 0 || s.disputedOrders > 0) && (
        <div className="mb-6 flex flex-wrap gap-2">
          {s.listingsPendingReview > 0 && (
            <Link href="/admin/marketplace" className="flex items-center gap-2 rounded-xl border border-harvest-200 bg-harvest-50 px-3 py-2 text-sm text-harvest-800">
              <Store className="size-4" /> {s.listingsPendingReview} listings awaiting review
            </Link>
          )}
          {s.openContentReports > 0 && (
            <Link href="/admin/marketplace#reports" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <Flag className="size-4" /> {s.openContentReports} reported items
            </Link>
          )}
          {s.disputedOrders > 0 && (
            <Link href="/admin/orders?status=DISPUTED" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <AlertTriangle className="size-4" /> {s.disputedOrders} disputed orders
            </Link>
          )}
        </div>
      )}
      <HeroCard className="mb-4" eyebrow="AgriFlow platform" label="Completed marketplace sales" value={formatZMW(s.completedSalesValue)} meta={[["Farmers", formatNumber(s.farmers)], ["Farms", `${formatNumber(s.farms)} · ${formatNumber(s.registeredHectares, 1)} ha`], ["Active orders", String(s.activeOrders)]]} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Farmers" value={formatNumber(s.farmers)} icon={Sprout} href="/admin/farmers" />
        <StatCard label="Buyers" value={formatNumber(s.buyers)} icon={ShoppingCart} tone="sky" href="/admin/buyers" />
        <StatCard label="Suppliers" value={formatNumber(s.suppliers)} icon={Package} tone="amber" href="/admin/suppliers" />
        <StatCard label="Transporters" value={formatNumber(s.transporters)} icon={Truck} tone="navy" href="/admin/transporters" />
        <StatCard label="Farms" value={formatNumber(s.farms)} hint={`${formatNumber(s.registeredHectares, 1)} ha registered`} icon={Tractor} href="/admin/farms" />
        <StatCard label="Active crop records" value={formatNumber(s.activeCropRecords)} icon={Grid3x3} href="/admin/crops" />
        <StatCard label="Produce listings" value={formatNumber(s.totalListings)} hint={`${s.activeListings} active`} icon={Store} tone="sky" href="/admin/marketplace" />
        <StatCard label="Orders" value={`${s.activeOrders} active`} hint={`${s.completedOrders} completed`} icon={ClipboardList} tone="amber" href="/admin/orders" />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Total marketplace sales (completed)" value={formatZMW(s.completedSalesValue)} icon={Wallet} href="/admin/orders?status=COMPLETED" />
        <StatCard label="Users" value={formatNumber(s.farmers + s.buyers + s.suppliers + s.transporters)} hint={`${s.admins} administrators`} icon={Users} tone="navy" href="/admin/users" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Registrations by month</CardTitle>
          </CardHeader>
          <CardContent>
            <StackedBars data={regs} xKey="month" series={[{ key: "FARMER", label: "Farmers" }, { key: "BUYER", label: "Buyers" }, { key: "SUPPLIER", label: "Suppliers" }, { key: "TRANSPORTER", label: "Transporters" }]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Completed sales by month (ZMW)</CardTitle>
          </CardHeader>
          <CardContent>{sales.length ? <GroupedBars data={sales} xKey="month" series={[{ key: "total", label: "Sales" }]} money /> : <p className="text-sm text-navy-500">No completed sales yet.</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Crop distribution (crop records)</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedBars data={crops} labelKey="crop" valueKey="records" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Activity by province</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupedBars data={provinces} xKey="province" series={[{ key: "farmers", label: "Farmers" }, { key: "farms", label: "Farms" }, { key: "listings", label: "Active listings" }]} height={280} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Orders by status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {s.ordersByStatus.map((o) => (
              <div key={o.status} className="flex items-center justify-between text-sm">
                <StatusBadge status={o.status} label={ORDER_STATUS_LABEL[o.status]} />
                <span className="font-semibold">{o.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Delivery activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {s.deliveriesByStatus.map((d) => (
              <div key={d.status} className="flex items-center justify-between text-sm">
                <StatusBadge status={d.status} label={DELIVERY_STATUS_LABEL[d.status]} />
                <span className="font-semibold">{d.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Produce available now</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <THead>
                <tr>
                  <TH>Crop</TH>
                  <TH>Quantity</TH>
                  <TH>Listings</TH>
                </tr>
              </THead>
              <TBody>
                {avail.slice(0, 8).map((a) => (
                  <TR key={`${a.crop}-${a.unit}`}>
                    <TD>{a.crop}</TD>
                    <TD className="text-xs">
                      {formatNumber(a.quantity)} {a.unit.toLowerCase().replace("_", " ")}
                    </TD>
                    <TD>{a.listings}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Recent platform activity</CardTitle>
          <Link href="/admin/audit-logs" className="text-xs font-semibold text-forest-700 hover:underline">
            Audit logs
          </Link>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{a.actor?.profile?.fullName ?? "System"}</span> <span className="text-navy-500">· {a.action.replaceAll(".", " ").replaceAll("_", " ")}</span>
                </span>
                <span className="shrink-0 text-xs text-navy-400">{relativeTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
