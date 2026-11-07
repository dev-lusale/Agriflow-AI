import { describeWeatherCode, type WeatherBundle, type WeatherProvider } from "./provider";

/**
 * Open-Meteo adapter (https://open-meteo.com): free, no API key required.
 * "Current" values are model analysis for the grid cell, not a ground-station observation.
 */
export class OpenMeteoProvider implements WeatherProvider {
  name = "Open-Meteo";
  constructor(private baseUrl = "https://api.open-meteo.com/v1/forecast") {}

  async fetchWeather(lat: number, lng: number, signal?: AbortSignal): Promise<WeatherBundle> {
    const params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lng.toFixed(4),
      current: "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
      timezone: "Africa/Lusaka",
      forecast_days: "7",
    });
    const res = await fetch(`${this.baseUrl}?${params}`, { signal, cache: "no-store" });
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const j = (await res.json()) as OpenMeteoResponse;
    if (!j.current || !j.daily?.time) throw new Error("Open-Meteo returned an unexpected payload");
    const daily = j.daily;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return {
      source: this.name,
      currentKind: "modelled",
      current: {
        // With timezone=Africa/Lusaka, times are local (UTC+2) without an offset suffix
        observedAt: new Date(`${j.current.time}:00+02:00`),
        temperatureC: num(j.current.temperature_2m),
        humidityPct: num(j.current.relative_humidity_2m),
        precipitationMm: num(j.current.precipitation),
        windSpeedKmh: num(j.current.wind_speed_10m),
        weatherCode: num(j.current.weather_code),
        conditions: describeWeatherCode(num(j.current.weather_code)),
      },
      daily: daily.time.map((date, i) => ({
        date,
        tempMaxC: num(daily.temperature_2m_max?.[i]),
        tempMinC: num(daily.temperature_2m_min?.[i]),
        precipitationMm: num(daily.precipitation_sum?.[i]),
        precipitationProbPct: num(daily.precipitation_probability_max?.[i]),
        windMaxKmh: num(daily.wind_speed_10m_max?.[i]),
        weatherCode: num(daily.weather_code?.[i]),
        conditions: describeWeatherCode(num(daily.weather_code?.[i])),
      })),
    };
  }
}

type OpenMeteoResponse = {
  current?: { time: string; temperature_2m?: number; relative_humidity_2m?: number; precipitation?: number; wind_speed_10m?: number; weather_code?: number };
  daily?: {
    time: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    precipitation_probability_max?: number[];
    wind_speed_10m_max?: number[];
  };
};
