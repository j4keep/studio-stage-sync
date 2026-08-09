import { useState } from "react";
import { useLocation } from "react-router-dom";
import { MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMyMarketplaceLocation } from "@/hooks/use-marketplace-location";
import MarketplaceLocationCard from "@/components/marketplace/MarketplaceLocationCard";

/** Sections where people do business with people nearby — location is required once. */
const GATED_PREFIXES = [
  "/marketplace",
  "/events",
  "/jobs",
  "/opportunities",
  "/deals",
  "/wellness",
  "/local-help",
  "/gigs",
  "/my-gigs",
];

/** Pages people need before they can even set a location — never gate those. */
const ALLOWED = ["/settings", "/marketplace/settings"];

export const isLocationGatedPath = (pathname: string) =>
  !ALLOWED.some((p) => pathname === p) && GATED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * One shared location prompt for every "near me" section. Shows once until the
 * person saves an address (or uses GPS); after that it never appears again.
 */
export default function LocationGate() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { ready, loading, refresh } = useMyMarketplaceLocation(user?.id);
  const [done, setDone] = useState(false);

  if (!user || loading || ready || done || !isLocationGatedPath(pathname)) return null;


  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-background/95 backdrop-blur-sm sm:items-center sm:justify-center">
      <div className="w-full space-y-3 rounded-t-3xl border-t border-border bg-background p-4 pb-8 sm:max-w-md sm:rounded-3xl sm:border">
        <p className="flex items-center gap-2 text-base font-black">
          <MapPin className="h-5 w-5 text-primary" />
          Turn on your location
        </p>
        <p className="text-[12.5px] text-muted-foreground">
          Start typing your address and pick it from the list, or tap the arrow to use your current location. We use it
          to show how far people, jobs, deals and items are from you. You only do this once, and you can turn it off any
          time in Settings.
        </p>
        <MarketplaceLocationCard
          userId={user.id}
          title="Your location"
          onChanged={() => {
            setDone(true);
            void refresh();
          }}
        />
      </div>
    </div>
  );
}
