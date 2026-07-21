import { NextRequest, NextResponse } from "next/server";

type NominatimPlace = {
  addresstype?: string;
  class?: string;
  display_name: string;
  lat: string;
  lon: string;
  osm_id: number;
  osm_type: string;
  place_id: number;
  type?: string;
};

const nominatimHeaders = {
  "accept-language": "en",
  "user-agent": "Connection PWA (https://connection-amber.vercel.app)"
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ locations: [] });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "0");

  const response = await fetch(url, {
    headers: nominatimHeaders,
    next: { revalidate: 60 * 60 * 24 * 7 }
  });

  if (!response.ok) {
    return NextResponse.json({ locations: [] });
  }

  const places = (await response.json()) as NominatimPlace[];
  return NextResponse.json({
    locations: places.map((place) => ({
      displayName: place.display_name,
      id: `${place.osm_type}:${place.osm_id}:${place.place_id}`,
      latitude: Number(place.lat),
      longitude: Number(place.lon),
      type: place.addresstype ?? place.type ?? place.class ?? "place"
    }))
  });
}
