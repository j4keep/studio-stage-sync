import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice } from "@/lib/marketplace";
import { listOffersForUser, updateOfferStatus } from "@/lib/marketplace-api";

export default function MarketplaceOffersPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const rows = await listOffersForUser(user.id, tab === "received" ? "seller" : "buyer");
      setOffers(rows);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load offers");
    } finally {
      setLoading(false);
    }
  }, [user, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, status: "accepted" | "declined" | "cancelled") => {
    if (!user) return;
    try {
      await updateOfferStatus(id, user.id, status);
      toast.success(`Offer ${status}`);
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Update failed");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button type="button" onClick={() => nav("/marketplace/account")} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-black">Offers</h1>
      </header>
      <div className="flex border-b border-border px-4">
        {(
          [
            ["received", "Received"],
            ["sent", "Sent"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`flex-1 border-b-2 py-2.5 text-sm font-bold ${
              tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-2 px-4 pt-3">
        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
        ) : offers.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No offers yet.</p>
        ) : (
          offers.map((o) => (
            <div key={o.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-black">{formatPrice(Number(o.amount))}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{o.status}</p>
                  {o.message && <p className="mt-1 text-xs text-muted-foreground">{o.message}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => nav(`/marketplace/listing/${o.listing_id}`)}
                  className="text-xs font-bold text-primary"
                >
                  View listing
                </button>
              </div>
              {tab === "received" && o.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => void act(o.id, "declined")} className="h-9 flex-1 rounded-full bg-muted text-xs font-bold">
                    Decline
                  </button>
                  <button type="button" onClick={() => void act(o.id, "accepted")} className="h-9 flex-1 rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    Accept
                  </button>
                </div>
              )}
              {tab === "sent" && o.status === "pending" && (
                <button type="button" onClick={() => void act(o.id, "cancelled")} className="mt-3 h-9 w-full rounded-full bg-muted text-xs font-bold">
                  Cancel offer
                </button>
              )}
            </div>
          ))
        )}
      </div>    </div>
  );
}
