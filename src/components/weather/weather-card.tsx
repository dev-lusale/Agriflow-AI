import Link from "next/link";
import { CloudRain, CloudSun, Droplets, Thermometer, TriangleAlert, Wind } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Alert } from "@/components/ui/primitives";
import { DataLabel } from "@/components/layout/page";
import { formatDateTime } from "@/lib/utils";
import type { Actor } from "@/lib/action";
import { weatherFlags, weatherForFarm } from "@/server/weather/service";

/** Server component: current conditions + 3-day outlook + rule-based flags for one farm. */
export async function WeatherCard({ actor, farmId, farmName }: { actor: Actor; farmId: string; farmName: string }) {
  const res = await weatherForFarm(actor, farmId);
  const bundle = res.ok ? res.data : res.lastKnown?.data;
  const fetchedAt = res.ok ? res.fetchedAt : res.lastKnown?.fetchedAt;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CloudSun className="size-4 text-harvest-600" /> Weather · {farmName}
        </CardTitle>
        <Link href="/farmer/weather" className="text-xs font-semibold text-forest-700 hover:underline">
          Details
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {!res.ok && <Alert tone="amber" icon={<TriangleAlert />}>{res.message}</Alert>}
        {bundle && (
          <>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-bold">{bundle.current.temperatureC !== null ? `${Math.round(bundle.current.temperatureC)}°C` : "—"}</p>
                <p className="text-sm text-navy-600">{bundle.current.conditions ?? "—"}</p>
              </div>
              <div className="space-y-1 text-right text-xs text-navy-600">
                <p className="flex items-center justify-end gap-1">
                  <Droplets className="size-3.5" /> {bundle.current.humidityPct ?? "—"}% humidity
                </p>
                <p className="flex items-center justify-end gap-1">
                  <Wind className="size-3.5" /> {bundle.current.windSpeedKmh ?? "—"} km/h
                </p>
                <p className="flex items-center justify-end gap-1">
                  <CloudRain className="size-3.5" /> {bundle.current.precipitationMm ?? 0} mm now
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {bundle.daily.slice(0, 3).map((d) => (
                <div key={d.date} className="rounded-xl bg-navy-50 p-2.5 text-center">
                  <p className="text-xs font-medium text-navy-500">{new Date(d.date + "T12:00:00").toLocaleDateString("en-ZM", { weekday: "short" })}</p>
                  <p className="mt-0.5 flex items-center justify-center gap-1 text-sm font-semibold">
                    <Thermometer className="size-3.5 text-harvest-600" />
                    {d.tempMaxC !== null ? Math.round(d.tempMaxC) : "—"}° / {d.tempMinC !== null ? Math.round(d.tempMinC) : "—"}°
                  </p>
                  <p className="text-xs text-sky-700">{d.precipitationMm ?? 0} mm</p>
                </div>
              ))}
            </div>
            {weatherFlags(bundle).flags.slice(0, 2).map((f) => (
              <p key={f} className="rounded-lg bg-harvest-50 px-3 py-2 text-xs text-harvest-800">
                {f}
              </p>
            ))}
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-navy-500">
              <DataLabel kind="MODELLED" />
              <span>
                Source: {bundle.source} · fetched {formatDateTime(fetchedAt)}
              </span>
              {res.ok && res.location.basis === "district_centre" && <span>· approximate location (district town)</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function WeatherCardSkeleton() {
  return (
    <Card className="p-5">
      <div className="h-5 w-40 animate-pulse rounded bg-navy-100" />
      <div className="mt-4 h-12 w-24 animate-pulse rounded bg-navy-100" />
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-navy-100" />
        ))}
      </div>
    </Card>
  );
}
