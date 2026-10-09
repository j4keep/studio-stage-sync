import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { getLocalAreaMode, localAreaLabel } from "@/lib/local-area";
import AddressAutocomplete from "@/components/marketplace/AddressAutocomplete";

type Props = {
  userId: string;
  /** Shown above the card */
  title?: string;
  onChanged?: () => void;
  compact?: boolean;
};

/**
 * One small card that handles "my location" for the marketplace: a toggle plus
 * either the phone's GPS or a picked address. Delivery prices come out automatically.
 */
export default function MarketplaceLocationCard({ userId, title = "YAJ Local Area", onChanged, compact = false }: Props) {
  const nav = useNavigate();
  const route = useLocation();
  const { location, loading, save, setSharing } = useMyMarketplaceLocation(userId);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  /** Address the person tapped in the dropdown — held until they press Save. */
  const [picked, setPicked] = useState<AddressSuggestion | null>(null);

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

  /** Tapping a suggestion only fills the box — saving stays in the person's hands. */
  const pick = (s: AddressSuggestion) => {
    setPicked(s);
    setDraft(s.label);
  };


  const saveTyped = async () => {
    const address = draft.trim();
    if (!address) return toast.error("Enter your address first");
    setBusy(true);
    try {
      if (picked && picked.label === address) {
        await commit(await resolveSuggestion(picked));
      } else {
        const point = await geocodeAddress(address);
        await commit({ ...point, label: point.label || address });
      }
      setPicked(null);
    } catch (e: any) {
      toast.error(e?.message || "We could not find that address");
    } finally {
      setBusy(false);
    }
  };

  const hasPoint = location.lat != null && location.lng != null;
  const editingAllowed = route.pathname === "/settings";
  const mode = getLocalAreaMode(location);

  return (
    <section className={`rounded-2xl border border-border bg-card ${compact ? "p-3" : "p-3"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[12.5px] font-black">
            <MapPin className="h-4 w-4 text-primary" />
            {title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11.5px] text-muted-foreground">
            {loading
              ? "Loading…"
              : hasPoint
                ? `${localAreaLabel(location)} · ${mode === "nearby" ? "Nearby only" : "Any area"}`
                : "Set your ZIP code or address once. YAJ uses it for local discovery."}
          </p>
        </div>
        <button
          type="button"
          disabled={!hasPoint || busy || !editingAllowed}
          onClick={() => void setSharing(!location.sharing)}
          aria-label="Show nearby activity only"
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

      {editingAllowed ? (
        <div className={compact ? "mt-2 grid grid-cols-[1fr_auto_auto] gap-2" : "mt-2.5 flex gap-2"}>
          <AddressAutocomplete
            value={draft}
            onChange={setDraft}
            onPick={(s) => void pick(s)}
            placeholder={hasPoint ? "Change ZIP code or address" : "Enter ZIP code or address"}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveTyped()}
            className={`${compact ? "h-10 px-3" : "h-11 px-3.5"} shrink-0 rounded-xl bg-foreground text-[12px] font-black text-background disabled:opacity-60`}
          >
            Save
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void useGps()}
            aria-label="Use my current location"
            className={`flex ${compact ? "h-10 w-10" : "h-11 w-11"} shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-60`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => nav("/settings")}
          className="mt-2.5 h-10 w-full rounded-xl border border-border bg-muted text-[12px] font-bold text-foreground"
        >
          Change local area in Settings
        </button>
      )}

      <p className={`${compact ? "mt-1 text-[10px]" : "mt-1.5 text-[11px]"} text-muted-foreground`}>
        {hasPoint
          ? mode === "nearby"
            ? "Nearby only — Marketplace, Deals, Opportunities, Events, Local Help and Gigs use this area."
            : "Any area — local sections can show activity outside your saved area."
          : "Save a ZIP code or address to turn on local discovery."}
      </p>
    </section>
  );
}
