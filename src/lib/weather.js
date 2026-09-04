import { PARSE, isDateKey } from "./dates.js";

export const ROERMOND = { lat: 51.1942, lon: 5.9875, tz: "Europe/Amsterdam" };

export const WMO = {
  0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "freezing fog",
  51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 56: "freezing drizzle", 57: "freezing drizzle",
  61: "light rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "freezing rain",
  71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains",
  80: "showers", 81: "heavy showers", 82: "violent showers", 85: "snow showers", 86: "heavy snow showers",
  95: "thunderstorm", 96: "thunderstorm with hail", 99: "severe thunderstorm",
};

const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const FORECAST = "https://api.open-meteo.com/v1/forecast";

function url(base, dateStr) {
  return (
    `${base}?latitude=${ROERMOND.lat}&longitude=${ROERMOND.lon}` +
    `&start_date=${dateStr}&end_date=${dateStr}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&timezone=${encodeURIComponent(ROERMOND.tz)}`
  );
}

async function ask(base, dateStr, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url(base, dateStr), { signal: ctrl.signal });
    if (!r.ok) throw new Error(`open-meteo ${r.status}`);
    const d = (await r.json())?.daily;
    const tmax = d?.temperature_2m_max?.[0];
    if (tmax === undefined || tmax === null) throw new Error("no record for that day");
    return {
      desc: WMO[d.weather_code?.[0]] ?? "",
      tmax,
      tmin: d.temperature_2m_min?.[0] ?? null,
      rain: d.precipitation_sum?.[0] ?? null,
      source: base === ARCHIVE ? "archive" : "forecast",
    };
  } finally {
    clearTimeout(t);
  }
}

/**
 * The archive lags roughly five days; the forecast endpoint reaches ~92 days
 * back and 16 forward. Try the likelier endpoint first and fall through, so a
 * date in the seam between the two still resolves.
 */
export async function fetchWeather(dateStr, { timeoutMs = 8000 } = {}) {
  if (!isDateKey(dateStr)) throw new Error("invalid date");
  const age = (Date.now() - PARSE(dateStr).getTime()) / 86400000;
  const order = age > 92 ? [ARCHIVE] : age > 8 ? [ARCHIVE, FORECAST] : [FORECAST, ARCHIVE];

  let last;
  for (const base of order) {
    try {
      return await ask(base, dateStr, timeoutMs);
    } catch (e) {
      last = e;
    }
  }
  throw last ?? new Error("no weather");
}
