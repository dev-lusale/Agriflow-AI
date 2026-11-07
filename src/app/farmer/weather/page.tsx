import type { Metadata } from "next";
import Link from "next/link";
import { CloudRain, CloudSun, Droplets, MapPin, Thermometer, TriangleAlert, Wind } from "lucide-react";
import { Alert, Card, CardContent, CardHeader, CardTitle, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { DataLabel, EmptyState, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { cn, formatDateTime } from "@/lib/utils";
import { weatherFlags, weatherForFarm } from "@/server/weather/service";

export const metadata: Metadata = { title: "Weather" };

export default async function WeatherPage({ searchParams }: { searchParams: Promise<{ farm?: string }> }) {
  const sp = await searchParams;
  const user = await requirePageRole("FARMER");
  const farms = await prisma.farm.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, district: true, latitude: true } });
  if (!farms.length) return (
    <>
      <PageHeader title="Weather" />
      <EmptyState icon={CloudSun} title="Add a farm to see weather" action={<Button asChild><Link href="/farmer/farms/new">Add farm</Link></Button>} />
    </>
  );
  const farm = farms.find((f) => f.id === sp.farm) ?? farms[0]!;
  const res = await weatherForFarm({ id: user.id, role: user.role }, farm.id);
  const bundle = res.ok ? res.data : res.lastKnown?.data;
  const fetchedAt = res.ok ? res.fetchedAt : res.lastKnown?.fetchedAt;
  const flags = bundle ? weatherFlags(bundle) : null;
  const q = encodeURIComponent(`What does my weather forecast mean for ${farm.name} this week, and which farm activities should I plan?`);

  return (
    <>
      <PageHeader
        title="Weather intelligence"
        description="Real forecast data for your farm from a weather provider. Forecasts are guidance, not guarantees."
        actions={
          <Button asChild>
            <Link href={`/farmer/assistant?q=${q}`}>Ask Grok to explain</Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {farms.map((f) => (
          <a key={f.id} href={`?farm=${f.id}`} className={cn("rounded-full px-3.5 py-1.5 font-medium ring-1 transition-colors", f.id === farm.id ? "bg-ink text-white ring-ink shadow-sm" : "bg-white/80 text-navy-700 ring-black/5 hover:bg-white")}>
            {f.name}
          </a>
        ))}
      </div>
      {!res.ok && (
        <Alert tone="amber" className="mb-4" icon={<TriangleAlert />} title={res.reason === "NO_LOCATION" ? "Location needed" : "Weather service unavailable"}>
          {res.message}{" "}
          {res.reason === "NO_LOCATION" && (
            <Link href={`/farmer/farms/${farm.id}`} className="font-semibold underline">
              Add GPS to this farm
            </Link>
          )}
        </Alert>
      )}
      {bundle && flags && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">Current conditions</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <DataLabel kind="MODELLED" />
                  <span className="text-xs text-navy-500">valid {formatDateTime(bundle.current.observedAt)}</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-5xl font-bold">{bundle.current.temperatureC !== null ? `${Math.round(bundle.current.temperatureC)}°C` : "—"}</p>
                <p className="mt-1 text-navy-600">{bundle.current.conditions}</p>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-xl bg-navy-50 p-3">
                    <Droplets className="mx-auto size-4 text-sky-600" />
                    <p className="mt-1 font-semibold">{bundle.current.humidityPct ?? "—"}%</p>
                    <p className="text-[11px] text-navy-500">humidity</p>
                  </div>
                  <div className="rounded-xl bg-navy-50 p-3">
                    <CloudRain className="mx-auto size-4 text-sky-600" />
                    <p className="mt-1 font-semibold">{bundle.current.precipitationMm ?? 0} mm</p>
                    <p className="text-[11px] text-navy-500">rain now</p>
                  </div>
                  <div className="rounded-xl bg-navy-50 p-3">
                    <Wind className="mx-auto size-4 text-sky-600" />
                    <p className="mt-1 font-semibold">{bundle.current.windSpeedKmh ?? "—"}</p>
                    <p className="text-[11px] text-navy-500">km/h wind</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Farm weather flags</CardTitle>
                <p className="text-xs text-navy-500">Rule-based checks on the forecast (not AI). Rain next 3 days: {flags.rainNext3DaysMm} mm · next 7 days: {flags.rainNext7DaysMm} mm</p>
              </CardHeader>
              <CardContent>
                {flags.flags.length ? (
                  <ul className="space-y-2">
                    {flags.flags.map((f) => (
                      <li key={f} className="flex gap-2 rounded-xl bg-harvest-50 px-3 py-2.5 text-sm text-harvest-900">
                        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-harvest-600" /> {f}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl bg-forest-50 px-3 py-2.5 text-sm text-forest-800">No significant weather risks flagged in the 7-day forecast.</p>
                )}
                <p className="mt-4 text-xs text-navy-500">
                  For planting decisions, also check the Zambia Meteorological Department (ZMD) seasonal outlook and local rainfall. Many extension officers advise planting after about 25–30 mm of effective rain.
                </p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                7-day forecast <DataLabel kind="FORECAST" />
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <THead>
                  <tr>
                    <TH>Day</TH>
                    <TH>Conditions</TH>
                    <TH>
                      <Thermometer className="inline size-3.5" /> Max / min
                    </TH>
                    <TH>Rain</TH>
                    <TH>Chance of rain</TH>
                    <TH>Max wind</TH>
                  </tr>
                </THead>
                <TBody>
                  {bundle.daily.map((d) => (
                    <TR key={d.date}>
                      <TD className="font-medium">{new Date(d.date + "T12:00:00").toLocaleDateString("en-ZM", { weekday: "short", day: "numeric", month: "short" })}</TD>
                      <TD>{d.conditions ?? "—"}</TD>
                      <TD>
                        {d.tempMaxC !== null ? Math.round(d.tempMaxC) : "—"}° / {d.tempMinC !== null ? Math.round(d.tempMinC) : "—"}°
                      </TD>
                      <TD>{d.precipitationMm ?? 0} mm</TD>
                      <TD>{d.precipitationProbPct !== null ? `${d.precipitationProbPct}%` : "—"}</TD>
                      <TD>{d.windMaxKmh ?? "—"} km/h</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
          <p className="flex flex-wrap items-center gap-2 text-xs text-navy-500">
            <MapPin className="size-3.5" />
            {res.ok ? res.location.label : farm.name} · Source: {bundle.source} · fetched {formatDateTime(fetchedAt)} {res.ok && res.cached ? "(cached, refreshed every 30 minutes)" : ""}
          </p>
        </div>
      )}
    </>
  );
}
