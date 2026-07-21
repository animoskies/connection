import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";

type WeatherPayload = {
  fallbackTimezone?: string | null;
  latitude?: number | null;
  location?: string | null;
  longitude?: number | null;
  startsAtUtc?: string | null;
};

type GeocodingResult = {
  latitude: number;
  longitude: number;
};

type ForecastResult = {
  hourly?: {
    precipitation_probability?: number[];
    time?: string[];
  };
};

async function geocodeLocation(location: string) {
  const candidates = [
    location,
    ...location
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .reverse()
  ];

  for (const candidate of [...new Set(candidates)]) {
    const geocodeUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
    geocodeUrl.searchParams.set("name", candidate);
    geocodeUrl.searchParams.set("count", "1");
    geocodeUrl.searchParams.set("language", "en");
    geocodeUrl.searchParams.set("format", "json");

    const geocodeResponse = await fetch(geocodeUrl, { next: { revalidate: 60 * 60 * 24 * 30 } });
    if (!geocodeResponse.ok) continue;
    const geocode = (await geocodeResponse.json()) as { results?: GeocodingResult[] };
    const result = geocode.results?.[0];
    if (result) return result;
  }

  return null;
}

function timezoneFallbackLocation(timezone?: string | null) {
  const city = timezone?.split("/").pop()?.replace(/_/g, " ").trim();
  return city && city.length > 1 ? city : null;
}

function nextWeatherCheckAt(startsAtUtc: DateTime, status: "sunny" | "rain") {
  const now = DateTime.utc();
  if (startsAtUtc <= now) return null;

  if (status === "rain") {
    return DateTime.min(now.plus({ hours: 6 }), startsAtUtc).toISO();
  }

  const dayBefore = startsAtUtc.minus({ days: 1 }).startOf("day");
  if (dayBefore > now) return dayBefore.toISO();
  return DateTime.min(now.plus({ hours: 12 }), startsAtUtc).toISO();
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as WeatherPayload;
  const location = body.location?.trim();
  const fallbackLocation = timezoneFallbackLocation(body.fallbackTimezone);
  const latitude = typeof body.latitude === "number" ? body.latitude : null;
  const longitude = typeof body.longitude === "number" ? body.longitude : null;
  const startsAtUtc = body.startsAtUtc ? DateTime.fromISO(body.startsAtUtc, { zone: "utc" }) : null;

  if (!startsAtUtc?.isValid) {
    return NextResponse.json({ weather: null });
  }

  const result =
    latitude !== null && longitude !== null
      ? { latitude, longitude }
      : location
        ? await geocodeLocation(location)
        : fallbackLocation
          ? await geocodeLocation(fallbackLocation)
          : null;
  if (!result) return NextResponse.json({ weather: null });

  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.searchParams.set("latitude", String(result.latitude));
  forecastUrl.searchParams.set("longitude", String(result.longitude));
  forecastUrl.searchParams.set("hourly", "precipitation_probability");
  forecastUrl.searchParams.set("timezone", "UTC");
  forecastUrl.searchParams.set("start_date", startsAtUtc.toISODate() ?? "");
  forecastUrl.searchParams.set("end_date", startsAtUtc.toISODate() ?? "");

  const forecastResponse = await fetch(forecastUrl, { cache: "no-store" });
  if (!forecastResponse.ok) return NextResponse.json({ weather: null });
  const forecast = (await forecastResponse.json()) as ForecastResult;
  const times = forecast.hourly?.time ?? [];
  const probabilities = forecast.hourly?.precipitation_probability ?? [];
  if (!times.length || !probabilities.length) return NextResponse.json({ weather: null });

  const eventMillis = startsAtUtc.toMillis();
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  times.forEach((time, index) => {
    const forecastMillis = DateTime.fromISO(time, { zone: "utc" }).toMillis();
    const distance = Math.abs(forecastMillis - eventMillis);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  const rainProbability = Math.max(0, Math.min(100, Math.round(probabilities[bestIndex] ?? 0)));
  const status = rainProbability > 80 ? "rain" : "sunny";
  const emoji = status === "rain" ? "☂️" : "☀️";

  return NextResponse.json({
    weather: {
      checkedAt: DateTime.utc().toISO(),
      emoji,
      nextCheckAt: nextWeatherCheckAt(startsAtUtc, status),
      rainProbability,
      source: "open-meteo",
      status
    }
  });
}
