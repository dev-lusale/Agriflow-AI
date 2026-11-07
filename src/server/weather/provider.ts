/** Weather provider abstraction — add new providers by implementing WeatherProvider. */
export type CurrentConditions = {
  observedAt: Date;
  temperatureC: number | null;
  humidityPct: number | null;
  precipitationMm: number | null;
  windSpeedKmh: number | null;
  weatherCode: number | null;
  conditions: string | null;
};

export type DailyForecast = {
  date: string; // YYYY-MM-DD (Africa/Lusaka)
  tempMaxC: number | null;
  tempMinC: number | null;
  precipitationMm: number | null;
  precipitationProbPct: number | null;
  windMaxKmh: number | null;
  weatherCode: number | null;
  conditions: string | null;
};

export type WeatherBundle = {
  source: string;
  /** "modelled" = numerical weather model analysis (not a ground station reading) */
  currentKind: "station" | "modelled";
  current: CurrentConditions;
  daily: DailyForecast[];
};

export interface WeatherProvider {
  name: string;
  fetchWeather(lat: number, lng: number, signal?: AbortSignal): Promise<WeatherBundle>;
}

const WMO: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

export const describeWeatherCode = (code: number | null | undefined) =>
  code === null || code === undefined ? null : (WMO[code] ?? `Code ${code}`);

/** Rule-based (deterministic) weather flags. Used for alerts and given to the AI as verified context. */
export function weatherFlags(b: WeatherBundle) {
  const flags: string[] = [];
  const next3 = b.daily.slice(0, 3);
  const rain3 = next3.reduce((a, d) => a + (d.precipitationMm ?? 0), 0);
  const rain7 = b.daily.reduce((a, d) => a + (d.precipitationMm ?? 0), 0);
  if (next3.some((d) => (d.precipitationMm ?? 0) >= 30))
    flags.push("Heavy rain (30 mm or more in a day) forecast within 3 days: check drainage and avoid top-dressing fertilizer just before heavy rain.");
  if (rain7 < 5 && b.daily.length >= 5) flags.push("Little rain (under 5 mm) forecast over the next week: monitor soil moisture and irrigate where available.");
  if (b.daily.some((d) => (d.tempMaxC ?? 0) >= 35)) flags.push("High temperatures (35 °C or more) forecast: heat-stress risk, especially at flowering.");
  if (b.daily.some((d) => (d.windMaxKmh ?? 0) >= 40)) flags.push("Strong winds (40 km/h or more) forecast: avoid spraying on windy days.");
  if (next3.some((d) => d.weatherCode !== null && d.weatherCode >= 95)) flags.push("Thunderstorms forecast: secure stored produce and avoid field work during storms.");
  return { flags, rainNext3DaysMm: Math.round(rain3 * 10) / 10, rainNext7DaysMm: Math.round(rain7 * 10) / 10 };
}
