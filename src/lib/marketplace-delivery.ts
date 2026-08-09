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

/** Turn a typed address into coordinates (used when a seller saves their store address). */
export function geocodeAddress(address: string) {
  return call<{ lat: number; lng: number; label: string }>({ action: "geocode", address });
}

/** Miles + delivery price for a buyer's address, using the seller's per-mile rate. */
export function getDeliveryQuote(sellerId: string, address: string) {
  return call<DeliveryQuote>({ action: "quote", sellerId, address });
}
