import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMyMarketplaceLocation } from "@/hooks/use-marketplace-location";
import { getDeliveryQuoteAt, milesAwayLabel, type DeliveryQuote } from "@/lib/marketplace-delivery";

/** "Nearby · 3 mi" style distance between the shopper and a seller, plus the delivery quote. */
export function useSellerDistance(sellerId?: string | null) {
  const { user } = useAuth();
  const { location, ready } = useMyMarketplaceLocation(user?.id);
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);

  useEffect(() => {
    if (!sellerId || !ready || location.lat == null || location.lng == null) {
      setQuote(null);
      return;
    }
    let alive = true;
    void getDeliveryQuoteAt(sellerId, location.lat, location.lng, location.address || undefined)
      .then((q) => alive && setQuote(q))
      .catch(() => alive && setQuote(null));
    return () => {
      alive = false;
    };
  }, [sellerId, ready, location.lat, location.lng, location.address]);

  return { quote, ready, away: milesAwayLabel(quote?.miles) };
}
