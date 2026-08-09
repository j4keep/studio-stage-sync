import { supabase } from "@/integrations/supabase/client";

export type DeliveryQuote = {
  configured: boolean;
  miles?: number;
  fee?: number;
  perMile?: number;
  minFee?: number;
  maxMiles?: number;
  tooFar?: boolean;
  label?: string;
};

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("mp-delivery-quote", { body });
  if (error) {
    const details = (error as any)?.context ? await (error as any).context.text() : error.message;
    let message = "Could not check the address";
    try {
      message = JSON.parse(details)?.error || message;
    } catch {
      /* keep the friendly fallback */
    }
    throw new Error(message);
  }
  return data as T;
}

/** Turn a typed address (or a picked Google place) into coordinates. */
export function geocodeAddress(address: string, placeId?: string | null) {
  return call<{ lat: number; lng: number; label: string }>({ action: "geocode", address, placeId });
}


/** Turn phone GPS coordinates into a readable address label. */
export function reverseGeocode(lat: number, lng: number) {
  return call<{ lat: number; lng: number; label: string }>({ action: "reverse", lat, lng });
}

/** Miles + delivery price for a buyer's address, using the seller's per-mile rate. */
export function getDeliveryQuote(sellerId: string, address: string) {
  return call<DeliveryQuote>({ action: "quote", sellerId, address });
}

/** Same quote, but straight from saved coordinates — no typing, instant price. */
export function getDeliveryQuoteAt(sellerId: string, lat: number, lng: number, label?: string) {
  return call<DeliveryQuote>({ action: "quote", sellerId, lat, lng, address: label });
}

/** Ask the phone for its current position (used by the location toggle). */
export function getBrowserPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Location isn't available on this device"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error("We couldn't get your location — allow location access or type your address")),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  });
}

export const milesAwayLabel = (m?: number | null) =>
  m == null ? null : m < 1 ? "Less than 1 mi away" : `${m} mi away`;

export type AddressSuggestion = { lat: number; lng: number; label: string };

/** Type-ahead address matches, so people pick instead of typing a full address. */
export async function suggestAddresses(q: string): Promise<AddressSuggestion[]> {
  if (q.trim().length < 3) return [];
  try {
    const { results } = await call<{ results: AddressSuggestion[] }>({ action: "suggest", address: q });
    return results || [];
  } catch {
    return [];
  }
}
