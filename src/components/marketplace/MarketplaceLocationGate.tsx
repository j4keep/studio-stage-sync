import { useAuth } from "@/contexts/AuthContext";
import { useMyMarketplaceLocation } from "@/hooks/use-marketplace-location";
import MarketplaceLocationCard from "@/components/marketplace/MarketplaceLocationCard";
import { MapPin } from "lucide-react";

/**
 * Blocks an item view until the shopper has a location turned on, so distance
 * and delivery prices are always accurate. Shows nothing once it's set.
 */
export default function MarketplaceLocationGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { ready, loading } = useMyMarketplaceLocation(user?.id);

  if (!user || loading || ready) return <>{children}</>;

  return (
    <>
      {children}
      <div className="fixed inset-0 z-[60] flex items-end bg-background/95 backdrop-blur-sm sm:items-center sm:justify-center">

      <div className="w-full space-y-3 rounded-t-3xl border-t border-border bg-background p-4 pb-8 sm:max-w-md sm:rounded-3xl sm:border">
        <p className="flex items-center gap-2 text-base font-black">
          <MapPin className="h-5 w-5 text-primary" />
          Turn on your location
        </p>
        <p className="text-[12.5px] text-muted-foreground">
          We use it to show how far each item is from you and the exact delivery price. It's only used for the
          Marketplace, and you can turn it off any time in Settings.
        </p>
        <MarketplaceLocationCard userId={user.id} title="Your location" />
      </div>
    </div>
  );
}
