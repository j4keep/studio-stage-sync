import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Point = { lat: number; lng: number; label: string };

/** Free, keyless geocoding (OpenStreetMap). Local delivery accuracy is plenty for mileage pricing. */
async function geocode(address: string): Promise<Point | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { "User-Agent": "YAJ-Marketplace/1.0 (delivery quotes)" } });
  if (!res.ok) {
    console.error(`Geocode failed [${res.status}]: ${await res.text()}`);
    return null;
  }
  const rows = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (!rows?.length) return null;
  return { lat: Number(rows[0].lat), lng: Number(rows[0].lon), label: rows[0].display_name };
}

/** Straight-line miles with a road factor so the quote tracks real driving distance. */
function miles(a: Point, b: Point) {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const straight = 2 * R * Math.asin(Math.sqrt(h));
  return Math.round(straight * 1.25 * 10) / 10;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, address, sellerId } = await req.json();
    const clean = typeof address === "string" ? address.trim().slice(0, 200) : "";
    if (!clean) return json({ error: "An address is required" }, 400);

    if (action === "geocode") {
      const point = await geocode(clean);
      if (!point) return json({ error: "We could not find that address" }, 404);
      return json({ lat: point.lat, lng: point.lng, label: point.label });
    }

    if (action !== "quote" || typeof sellerId !== "string") {
      return json({ error: "Invalid request" }, 400);
    }

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

    const rate = Number(store?.delivery_per_mile || 0);
    if (!store || rate <= 0) return json({ configured: false });

    let origin: Point | null =
      store.store_lat != null && store.store_lng != null
        ? { lat: Number(store.store_lat), lng: Number(store.store_lng), label: store.store_address || "Store" }
        : store.store_address
          ? await geocode(store.store_address)
          : null;
    if (!origin) return json({ configured: false });

    const dest = await geocode(clean);
    if (!dest) return json({ error: "We could not find that address" }, 404);

    const distance = miles(origin, dest);
    const maxMiles = Number(store.delivery_max_miles || 0);
    const minFee = Number(store.delivery_min_fee || 0);
    const fee = Math.max(Math.round(rate * distance * 100) / 100, minFee);

    return json({
      configured: true,
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
