import "server-only";
import type { Province } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { Actor } from "@/lib/action";
import { forbidden, notFound } from "@/lib/errors";
import { districtCentre } from "@/lib/zambia";
import { OpenMeteoProvider } from "./open-meteo";
import type { WeatherBundle, WeatherProvider } from "./provider";

export { weatherFlags } from "./provider";

const CACHE_MINUTES = 30;

export function getProvider(): WeatherProvider {
  switch (env.weatherProvider) {
    case "open-meteo":
    default:
      return new OpenMeteoProvider();
  }
}

export type WeatherLocation = { lat: number; lng: number; basis: "farm_gps" | "district_centre"; label: string };

export type WeatherResult =
  | { ok: true; location: WeatherLocation; data: WeatherBundle; fetchedAt: Date; cached: boolean }
  | { ok: false; reason: "NO_LOCATION" | "PROVIDER_ERROR"; message: string; location?: WeatherLocation; lastKnown?: { data: WeatherBundle; fetchedAt: Date } };

const round = (n: number) => Math.round(n * 100) / 100;

/** Resolve where to look up weather for a farm. Never invents coordinates. */
export function resolveFarmLocation(farm: { latitude: unknown; longitude: unknown; province: Province; district: string; name: string }): WeatherLocation | null {
  if (farm.latitude !== null && farm.longitude !== null && farm.latitude !== undefined && farm.longitude !== undefined) {
    return { lat: Number(farm.latitude), lng: Number(farm.longitude), basis: "farm_gps", label: `${farm.name} (farm GPS point)` };
  }
  const c = districtCentre(farm.province, farm.district);
  if (!c) return null;
  return { lat: c.lat, lng: c.lng, basis: "district_centre", label: `${farm.district} town area (approximate; add farm GPS for precision)` };
}

export async function weatherForFarm(actor: Actor, farmId: string, provider: WeatherProvider = getProvider()): Promise<WeatherResult> {
  const farm = await prisma.farm.findUnique({ where: { id: farmId } });
  if (!farm) throw notFound("Farm not found.");
  if (farm.ownerId !== actor.id && actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") throw forbidden();
  const loc = resolveFarmLocation(farm);
  if (!loc) {
    return { ok: false, reason: "NO_LOCATION", message: "Add GPS coordinates to this farm to see weather. We do not hold a reference point for this district." };
  }
  return weatherAt(loc, provider, farm.id);
}

export async function weatherAt(loc: WeatherLocation, provider: WeatherProvider = getProvider(), farmId?: string): Promise<WeatherResult> {
  const lat = round(loc.lat);
  const lng = round(loc.lng);
  const since = new Date(Date.now() - CACHE_MINUTES * 60_000);
  const cachedObs = await prisma.weatherObservation.findFirst({
    where: { latitude: lat, longitude: lng, fetchedAt: { gte: since }, isDemo: false },
    orderBy: { fetchedAt: "desc" },
  });
  if (cachedObs) {
    const forecasts = await prisma.weatherForecast.findMany({
      where: { latitude: lat, longitude: lng, fetchedAt: cachedObs.fetchedAt, isDemo: false },
      orderBy: { forecastDate: "asc" },
    });
    return { ok: true, location: loc, data: fromRows(cachedObs, forecasts), fetchedAt: cachedObs.fetchedAt, cached: true };
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const data = await provider.fetchWeather(lat, lng, ctrl.signal).finally(() => clearTimeout(timer));
    const fetchedAt = new Date();
    await prisma.$transaction([
      prisma.weatherObservation.create({
        data: {
          farmId,
          latitude: lat,
          longitude: lng,
          observedAt: data.current.observedAt,
          temperatureC: data.current.temperatureC,
          humidityPct: data.current.humidityPct,
          precipitationMm: data.current.precipitationMm,
          windSpeedKmh: data.current.windSpeedKmh,
          weatherCode: data.current.weatherCode,
          conditions: data.current.conditions,
          source: data.source,
          fetchedAt,
        },
      }),
      prisma.weatherForecast.createMany({
        data: data.daily.map((f) => ({
          farmId,
          latitude: lat,
          longitude: lng,
          forecastDate: new Date(f.date),
          tempMaxC: f.tempMaxC,
          tempMinC: f.tempMinC,
          precipitationMm: f.precipitationMm,
          precipitationProbPct: f.precipitationProbPct,
          windMaxKmh: f.windMaxKmh,
          weatherCode: f.weatherCode,
          conditions: f.conditions,
          source: data.source,
          fetchedAt,
        })),
      }),
    ]);
    return { ok: true, location: loc, data, fetchedAt, cached: false };
  } catch (e) {
    console.warn("[weather] provider error", String(e));
    const last = await prisma.weatherObservation.findFirst({ where: { latitude: lat, longitude: lng, isDemo: false }, orderBy: { fetchedAt: "desc" } });
    if (last) {
      const forecasts = await prisma.weatherForecast.findMany({ where: { latitude: lat, longitude: lng, fetchedAt: last.fetchedAt }, orderBy: { forecastDate: "asc" } });
      return {
        ok: false,
        reason: "PROVIDER_ERROR",
        location: loc,
        message: "The weather service is unreachable. Showing the last saved reading, which may be out of date.",
        lastKnown: { data: fromRows(last, forecasts), fetchedAt: last.fetchedAt },
      };
    }
    return { ok: false, reason: "PROVIDER_ERROR", location: loc, message: "The weather service is unreachable right now. Please try again later." };
  }
}

type ObsRow = NonNullable<Awaited<ReturnType<typeof prisma.weatherObservation.findFirst>>>;
type FcRow = Awaited<ReturnType<typeof prisma.weatherForecast.findMany>>[number];
const n = (v: { toString(): string } | null) => (v === null ? null : Number(v.toString()));

function fromRows(o: ObsRow, f: FcRow[]): WeatherBundle {
  return {
    source: o.source,
    currentKind: "modelled",
    current: {
      observedAt: o.observedAt,
      temperatureC: n(o.temperatureC),
      humidityPct: n(o.humidityPct),
      precipitationMm: n(o.precipitationMm),
      windSpeedKmh: n(o.windSpeedKmh),
      weatherCode: o.weatherCode,
      conditions: o.conditions,
    },
    daily: f.map((x) => ({
      date: x.forecastDate.toISOString().slice(0, 10),
      tempMaxC: n(x.tempMaxC),
      tempMinC: n(x.tempMinC),
      precipitationMm: n(x.precipitationMm),
      precipitationProbPct: x.precipitationProbPct,
      windMaxKmh: n(x.windMaxKmh),
      weatherCode: x.weatherCode,
      conditions: x.conditions,
    })),
  };
}
