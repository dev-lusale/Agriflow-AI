import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Card, CardContent, CardHeader, CardTitle, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { DataLabel } from "@/components/layout/page";
import { TrendLines } from "@/components/charts/charts";
import { ExplainButton } from "@/components/ai/explain-button";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { formatZMW } from "@/lib/money";
import { UNIT_LABEL } from "@/lib/labels";
import { provinceLabel } from "@/lib/zambia";
import { cn, formatDate } from "@/lib/utils";
import { listingPriceStats } from "@/server/marketplace/service";
import { explainMarketAction } from "@/server/actions/ai";

export const metadata: Metadata = { title: "Market price intelligence" };

const SOURCE_KIND = { VERIFIED_OBSERVATION: "VERIFIED", USER_SUBMITTED_OFFER: "USER_OFFER", HISTORICAL_RECORD: "HISTORICAL", DEMO: "DEMO" } as const;

export default async function PricesPage({ searchParams }: { searchParams: Promise<{ crop?: string }> }) {
  const sp = await searchParams;
  const [crops, user, asks] = await Promise.all([
    prisma.crop.findMany({ where: { marketPrices: { some: {} } }, orderBy: { name: "asc" } }),
    getCurrentUser(),
    listingPriceStats(),
  ]);
  const crop = crops.find((c) => c.name === sp.crop) ?? crops[0];
  const rows = crop ? await prisma.marketPrice.findMany({ where: { cropId: crop.id }, orderBy: { observedOn: "asc" } }) : [];
  const provinces = [...new Set(rows.map((r) => r.province))];
  const byMonth = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    const m = r.observedOn.toISOString().slice(0, 7);
    const e = byMonth.get(m) ?? { month: m };
    e[r.province] = Number(r.price);
    byMonth.set(m, e);
  }
  const latest = [...rows].reverse().filter((r, i, a) => a.findIndex((x) => x.province === r.province) === i);
  const sourceTypes = [...new Set(rows.map((r) => r.sourceType))];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <Link href="/marketplace" className="text-sm font-medium text-navy-500 hover:text-forest-700">
          ← Marketplace
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Market price intelligence</h1>
        <p className="mt-1 max-w-3xl text-navy-600">Recorded price observations by crop, province, unit and date. Every number is labelled with its source. AgriFlow never shows invented live commodity prices.</p>
      </div>
      {sourceTypes.includes("DEMO") && (
        <Alert tone="amber" title="Demonstration data">
          The price series below are fictional demo records for this hackathon deployment. They are not real market prices. Administrators can add verified observations from sources such as market surveys.
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        {crops.map((c) => (
          <Link key={c.id} href={`?crop=${encodeURIComponent(c.name)}`} className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-colors", c.id === crop?.id ? "bg-ink text-white ring-ink shadow-sm" : "bg-white/80 text-navy-700 ring-black/5 hover:bg-white")}>
            {c.name}
          </Link>
        ))}
      </div>
      {crop && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>
                {crop.name} price history ({rows[0] ? UNIT_LABEL[rows[0].unit] : ""}, ZMW)
              </CardTitle>
              <div className="flex gap-2">
                {sourceTypes.map((s) => (
                  <DataLabel key={s} kind={SOURCE_KIND[s]} />
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <TrendLines data={[...byMonth.values()]} xKey="month" series={provinces.map((p) => ({ key: p, label: provinceLabel(p) }))} money />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Latest by province</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <THead>
                  <tr>
                    <TH>Province</TH>
                    <TH>Price</TH>
                    <TH>Date</TH>
                  </tr>
                </THead>
                <TBody>
                  {latest.map((r) => (
                    <TR key={r.id}>
                      <TD>{provinceLabel(r.province)}</TD>
                      <TD className="font-medium">
                        {formatZMW(r.price)} <span className="text-xs text-navy-500">/ {UNIT_LABEL[r.unit]}</span>
                      </TD>
                      <TD className="text-xs">{formatDate(r.observedOn)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>What does this mean?</CardTitle>
            </CardHeader>
            <CardContent>
              {user ? (
                <ExplainButton run={async () => { "use server"; return explainMarketAction(crop.id); }} />
              ) : (
                <p className="text-sm text-navy-600">
                  <Link href="/auth/login" className="font-semibold text-forest-700 hover:underline">
                    Sign in
                  </Link>{" "}
                  to ask Grok to explain these price trends.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current asking prices on AgriFlow <DataLabel kind="USER_OFFER" />
          </CardTitle>
          <p className="text-xs text-navy-500">Computed live from active marketplace listings. These are what farmers are asking, not completed sales.</p>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <THead>
              <tr>
                <TH>Crop</TH>
                <TH>Unit</TH>
                <TH>Listings</TH>
                <TH>Lowest</TH>
                <TH>Average</TH>
                <TH>Highest</TH>
              </tr>
            </THead>
            <TBody>
              {asks.map((a) => (
                <TR key={`${a.cropId}-${a.unit}`}>
                  <TD className="font-medium">{a.crop.name}</TD>
                  <TD>{UNIT_LABEL[a.unit]}</TD>
                  <TD>{a._count}</TD>
                  <TD>{formatZMW(a._min.pricePerUnit)}</TD>
                  <TD>{formatZMW(a._avg.pricePerUnit)}</TD>
                  <TD>{formatZMW(a._max.pricePerUnit)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
