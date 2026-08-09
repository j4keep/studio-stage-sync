import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Point = { lat: number; lng: number; label: string };

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");

const googleReady = () => Boolean(LOVABLE_API_KEY && GOOGLE_MAPS_API_KEY);

const gatewayHeaders = (extra: Record<string, string> = {}) => ({
  Authorization: `Bearer ${LOVABLE_API_KEY}`,
  "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY!,
  ...extra,
});

/** Google Geocoding — accepts an address string or a place id. */
async function googleGeocode(params: Record<string, string>): Promise<Point | null> {
  if (!googleReady()) return null;
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${GATEWAY}/maps/api/geocode/json?${qs}`, { headers: gatewayHeaders() });
  if (!res.ok) {
    console.error(`Google geocode failed [${res.status}]: ${await res.text()}`);
    return null;
  }
  const body = (await res.json()) as {
    status?: string;
    results?: Array<{ formatted_address: string; geometry: { location: { lat: number; lng: number } } }>;
  };
  const hit = body.results?.[0];
  if (!hit) {
    console.error(`Google geocode empty (status ${body.status})`);
    return null;
  }
  return { lat: hit.geometry.location.lat, lng: hit.geometry.location.lng, label: hit.formatted_address };
}

/** Fallback so addresses still resolve if the Google connection is unavailable. */
async function osmGeocode(address: string): Promise<Point | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { "User-Agent": "YAJ/1.0 (address lookup)" } });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (!rows?.length) return null;
  return { lat: Number(rows[0].lat), lng: Number(rows[0].lon), label: rows[0].display_name };
}

async function geocode(address: string): Promise<Point | null> {
  return (await googleGeocode({ address })) ?? (await osmGeocode(address));
}

/** Straight-line miles with a road factor so the quote tracks real driving distance. */
function miles(a: Point, b: Point) {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const straight = 2 * R * Math.asin(Math.sqrt(h));
  return Math.round(straight * 1.25 * 10) / 10;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, address, sellerId, lat, lng, placeId } = await req.json();
    const clean = typeof address === "string" ? address.trim().slice(0, 200) : "";
    const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

    if (action === "geocode") {
      if (!clean && typeof placeId !== "string") return json({ error: "An address is required" }, 400);
      const point =
        typeof placeId === "string" && placeId
          ? await googleGeocode({ place_id: placeId })
          : await geocode(clean);
      if (!point) return json({ error: "We could not find that address" }, 404);
      return json(point);
    }

    /** Google-style type-ahead suggestions (Places API New). */
    if (action === "suggest") {
      if (clean.length < 3) return json({ results: [] });
      if (googleReady()) {
        const res = await fetch(`${GATEWAY}/places/v1/places:autocomplete`, {
          method: "POST",
          headers: gatewayHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ input: clean, includedRegionCodes: ["us"] }),
        });
        if (res.ok) {
          const body = (await res.json()) as {
            suggestions?: Array<{
              placePrediction?: { placeId?: string; text?: { text?: string } };
            }>;
          };
          const results = (body.suggestions || [])
            .map((s) => s.placePrediction)
            .filter((p): p is { placeId?: string; text?: { text?: string } } => Boolean(p?.text?.text))
            .map((p) => ({ label: p.text!.text!, placeId: p.placeId ?? null }));
          return json({ results });
        }
        console.error(`Places autocomplete failed [${res.status}]: ${await res.text()}`);
      }
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(clean)}`,
        { headers: { "User-Agent": "YAJ/1.0 (address suggestions)" } },
      );
      if (!res.ok) return json({ results: [] });
      const rows = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      return json({
        results: (rows || []).map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) })),
      });
    }

    /** Turn coordinates back into a readable place name (used by "use my current location"). */
    if (action === "reverse") {
      if (!hasCoords) return json({ error: "Coordinates are required" }, 400);
      const point = await googleGeocode({ latlng: `${Number(lat)},${Number(lng)}` });
      if (point) return json({ lat: Number(lat), lng: Number(lng), label: point.label });
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${Number(lat)}&lon=${Number(lng)}`,
        { headers: { "User-Agent": "YAJ/1.0 (address lookup)" } },
      );
      const body = res.ok ? ((await res.json()) as { display_name?: string }) : null;
      return json({
        lat: Number(lat),
        lng: Number(lng),
        label: body?.display_name || `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`,
      });
    }

    if (action !== "quote" || typeof sellerId !== "string") {
      return json({ error: "Invalid request" }, 400);
    }
    if (!clean && !hasCoords) return json({ error: "An address is required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: store, error } = await supabase
      .from("marketplace_profiles")
      .select("store_lat, store_lng, store_address, delivery_per_mile, delivery_min_fee, delivery_max_miles")
      .eq("user_id", sellerId)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);

    // Platform fallback so buyers always see a delivery estimate, even before a seller sets a rate.
    const DEFAULT_PER_MILE = 1;
    const DEFAULT_MIN_FEE = 2;
    const sellerRate = Number(store?.delivery_per_mile || 0);
    const estimated = sellerRate <= 0;
    const rate = estimated ? DEFAULT_PER_MILE : sellerRate;

    let origin: Point | null =
      store?.store_lat != null && store?.store_lng != null
        ? { lat: Number(store.store_lat), lng: Number(store.store_lng), label: store.store_address || "Store" }
        : store?.store_address
          ? await geocode(store.store_address)
          : null;
    if (!origin) return json({ configured: false });

    const dest: Point | null = hasCoords
      ? { lat: Number(lat), lng: Number(lng), label: clean || "Your location" }
      : await geocode(clean);
    if (!dest) return json({ error: "We could not find that address" }, 404);

    const distance = miles(origin, dest);
    const maxMiles = Number(store?.delivery_max_miles || 0);
    const minFee = estimated ? DEFAULT_MIN_FEE : Number(store?.delivery_min_fee || 0);
    const fee = Math.max(Math.round(rate * distance * 100) / 100, minFee);

    return json({
      configured: true,
      estimated,
      miles: distance,
      fee,
      perMile: rate,
      minFee,
      maxMiles,
      tooFar: maxMiles > 0 && distance > maxMiles,
      label: dest.label,
    });
  } catch (e) {
    console.error("mp-delivery-quote failed:", e);
    return json({ error: (e as Error).message || "Delivery quote failed" }, 500);
  }
});
