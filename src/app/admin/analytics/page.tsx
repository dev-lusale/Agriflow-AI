import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { PageHeader, StatCard } from "@/components/layout/page";
import { GroupedBars, RankedBars, StackedBars } from "@/components/charts/charts";
import { requirePageRole } from "@/lib/auth/session";
import { formatZMW } from "@/lib/money";
import { formatNumber } from "@/lib/utils";
import { activityByProvince, aiUsageStats, cropDistribution, platformStats, produceAvailability, registrationsByMonth, salesByMonth, topCropHealthConcerns } from "@/server/analytics/service";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  await requirePageRole("ADMIN", "SUPER_ADMIN");
  const [s, regs, crops, avail, sales, provinces, concerns, ai] = await Promise.all([platformStats(), registrationsByMonth(12), cropDistribution(), produceAvailability(), salesByMonth(12), activityByProvince(), topCropHealthConcerns(), aiUsageStats(30)]);
  const conversion = s.totalListings ? Math.round((s.completedOrders / s.totalListings) * 100) : 0;
  return (
    <>
      <PageHeader title="Analytics" description="Platform growth, marketplace performance, regional activity and AI usage, all computed from live records." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Registered hectares" value={formatNumber(s.registeredHectares, 1)} />
        <StatCard label="Completed sales value" value={formatZMW(s.completedSalesValue, { compact: true })} tone="sky" />
        <StatCard label="Completed orders / listings" value={`${conversion}%`} hint={`${s.completedOrders} of ${s.totalListings}`} tone="navy" />
        <StatCard label="AI requests (30 days)" value={ai.byFeature.reduce((a, f) => a + f.count, 0)} hint={`${formatNumber(ai.inputTokens + ai.outputTokens)} tokens · avg ${ai.avgLatencyMs} ms`} tone="amber" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <StackedBars data={regs} xKey="month" series={[{ key: "FARMER", label: "Farmers" }, { key: "BUYER", label: "Buyers" }, { key: "SUPPLIER", label: "Suppliers" }, { key: "TRANSPORTER", label: "Transporters" }]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Completed sales (ZMW) and order count</CardTitle>
          </CardHeader>
          <CardContent>
            {sales.length ? <GroupedBars data={sales} xKey="month" series={[{ key: "total", label: "Sales value" }]} money /> : <p className="text-sm text-navy-500">No completed sales.</p>}
            <p className="mt-2 text-xs text-navy-500">Orders completed: {sales.map((x) => `${x.month}: ${x.orders}`).join(" · ") || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Geographic activity</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupedBars data={provinces} xKey="province" series={[{ key: "farmers", label: "Farmers" }, { key: "farms", label: "Farms" }, { key: "listings", label: "Active listings" }]} height={300} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Crop distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedBars data={crops} labelKey="crop" valueKey="records" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Produce availability (active listings)</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedBars data={avail.map((a) => ({ name: `${a.crop} (${a.unit.toLowerCase().replace("_", " ")})`, listings: a.listings }))} labelKey="name" valueKey="listings" color="#0891b2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Most common crop-health concerns</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <THead>
                <tr>
                  <TH>Possible issue</TH>
                  <TH>Assessments</TH>
                </tr>
              </THead>
              <TBody>
                {concerns.map((c) => (
                  <TR key={c.issue}>
                    <TD>{c.issue}</TD>
                    <TD>{c.count}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>AI usage (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <RankedBars data={ai.byFeature} labelKey="feature" valueKey="count" color="#7c3aed" />
            <div className="space-y-2 text-sm">
              {ai.byStatus.map((x) => (
                <p key={x.status} className="flex justify-between border-b border-border pb-1">
                  <span>{x.status === "OK" ? "Grok responses" : x.status === "FALLBACK" ? "Fallback (AI not configured or unavailable)" : "Errors"}</span>
                  <span className="font-semibold">{x.count}</span>
                </p>
              ))}
              <p className="flex justify-between">
                <span>Input / output tokens</span>
                <span className="font-semibold">
                  {formatNumber(ai.inputTokens)} / {formatNumber(ai.outputTokens)}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
