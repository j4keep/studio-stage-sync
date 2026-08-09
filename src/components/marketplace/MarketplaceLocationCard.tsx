import { useState } from "react";
import { Loader2, LocateFixed, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  geocodeAddress,
  getBrowserPosition,
  resolveSuggestion,
  reverseGeocode,
  type AddressSuggestion,
} from "@/lib/marketplace-delivery";

import { useMyMarketplaceLocation } from "@/hooks/use-marketplace-location";
import AddressAutocomplete from "@/components/marketplace/AddressAutocomplete";

type Props = {
  userId: string;
  /** Shown above the card */
  title?: string;
  onChanged?: () => void;
};

/**
 * One small card that handles "my location" for the marketplace: a toggle plus
 * either the phone's GPS or a picked address. Delivery prices come out automatically.
 */
export default function MarketplaceLocationCard({ userId, title = "Your location", onChanged }: Props) {
  const { location, loading, save, setSharing } = useMyMarketplaceLocation(userId);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const commit = async (point: { lat: number; lng: number; label: string }) => {
    await save({ address: point.label, lat: point.lat, lng: point.lng, sharing: true });
    setDraft("");
    toast.success("Location saved");
    onChanged?.();
  };

  const useGps = async () => {
    setBusy(true);
    try {
      const pos = await getBrowserPosition();
      const point = await reverseGeocode(pos.lat, pos.lng).catch(() => ({
        lat: pos.lat,
        lng: pos.lng,
        label: "My current location",
      }));
      await commit(point);
    } catch (e: any) {
      toast.error(e?.message || "Could not get your location");
    } finally {
      setBusy(false);
    }
  };

  const pick = async (s: AddressSuggestion) => {
    setBusy(true);
    try {
      await commit(await resolveSuggestion(s));
    } catch (e: any) {
      toast.error(e?.message || "Could not save that address");
    } finally {
      setBusy(false);
    }
  };


  const saveTyped = async () => {
    const address = draft.trim();
    if (!address) return toast.error("Enter your address first");
    setBusy(true);
    try {
      const point = await geocodeAddress(address);
      await commit({ ...point, label: point.label || address });
    } catch (e: any) {
      toast.error(e?.message || "We could not find that address");
    } finally {
      setBusy(false);
    }
  };

  const hasPoint = location.lat != null && location.lng != null;

  return (
    <section className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[12.5px] font-black">
            <MapPin className="h-4 w-4 text-primary" />
            {title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11.5px] text-muted-foreground">
            {loading ? "Loading…" : hasPoint ? location.address : "Set it once — distance and delivery prices fill in for you."}
          </p>
        </div>
        <button
          type="button"
          disabled={!hasPoint || busy}
          onClick={() => void setSharing(!location.sharing)}
          aria-label="Share my location"
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
            location.sharing && hasPoint ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-background shadow transition-all ${
              location.sharing && hasPoint ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <div className="mt-2.5 flex gap-2">
        <AddressAutocomplete
          value={draft}
          onChange={setDraft}
          onPick={(s) => void pick(s)}
          placeholder={hasPoint ? "Change address" : "Start typing your address"}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveTyped()}
          className="h-11 shrink-0 rounded-xl bg-foreground px-3.5 text-[12px] font-black text-background disabled:opacity-60"
        >
          Save
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void useGps()}
          aria-label="Use my current location"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {location.sharing && hasPoint
          ? "Location on — you'll see how far away each item is, plus the delivery price."
          : "Turn this on to see distance and delivery prices automatically."}
      </p>
    </section>
  );
}
