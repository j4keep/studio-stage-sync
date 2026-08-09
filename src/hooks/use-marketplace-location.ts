import { useCallback, useEffect, useState } from "react";
import { getMarketplaceProfile, updateMarketplaceProfile, type MarketplaceProfile } from "@/lib/marketplace-api";

export type MyLocation = {
  address: string | null;
  lat: number | null;
  lng: number | null;
  sharing: boolean;
};

const fromProfile = (p: MarketplaceProfile | null): MyLocation => ({
  address: p?.buyer_address ?? null,
  lat: p?.buyer_lat != null ? Number(p.buyer_lat) : null,
  lng: p?.buyer_lng != null ? Number(p.buyer_lng) : null,
  sharing: Boolean(p?.share_location),
});

/** The shopper's saved delivery location — used to price delivery without typing an address. */
export function useMyMarketplaceLocation(userId?: string | null) {
  const [location, setLocation] = useState<MyLocation>({ address: null, lat: null, lng: null, sharing: false });
  const [loading, setLoading] = useState(Boolean(userId));

  const refresh = useCallback(async () => {
    if (!userId) {
      setLocation({ address: null, lat: null, lng: null, sharing: false });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setLocation(fromProfile(await getMarketplaceProfile(userId)));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (next: { address: string | null; lat: number | null; lng: number | null; sharing?: boolean }) => {
      if (!userId) return;
      const sharing = next.sharing ?? true;
      await updateMarketplaceProfile(userId, {
        buyer_address: next.address,
        buyer_lat: next.lat,
        buyer_lng: next.lng,
        share_location: sharing,
      });
      setLocation({ address: next.address, lat: next.lat, lng: next.lng, sharing });
    },
    [userId],
  );

  const setSharing = useCallback(
    async (sharing: boolean) => {
      if (!userId) return;
      await updateMarketplaceProfile(userId, { share_location: sharing });
      setLocation((l) => ({ ...l, sharing }));
    },
    [userId],
  );

  const ready = Boolean(location.sharing && location.lat != null && location.lng != null);

  return { location, ready, loading, refresh, save, setSharing };
}
