import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/contexts/AuthContext";
import { mapsUrl } from "@/lib/deals";
import {
  listMyClaims,
  listMySavedDeals,
  markDealUsed,
  type Deal,
  type DealClaim,
} from "@/lib/deals-api";
import DealCard from "@/components/deals/DealCard";
import { toast } from "sonner";

type Tab = "saved" | "claimed" | "used" | "expired";

export default function MyDealsPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("saved");
  const [saved, setSaved] = useState<Deal[]>([]);
  const [claims, setClaims] = useState<DealClaim[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [s, c] = await Promise.all([listMySavedDeals(user.id), listMyClaims(user.id)]);
      setSaved(s);
      setClaims(c);
    } catch (e: any) {
      toast.error(e?.message || "Could not load My Deals");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const claimed = claims.filter((c) => c.status === "claimed");
    const used = claims.filter((c) => c.status === "used");
    const expired = claims.filter((c) => c.status === "expired");
    return { claimed, used, expired };
  }, [claims]);

  if (!user) {
    return (
      <div className="px-6 pt-20 text-center">
        <p className="font-bold">Sign in to see My Deals</p>
        <button type="button" onClick={() => nav("/auth")} className="mt-4 text-sm font-semibold text-orange-600">
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => nav("/deals")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-black">My Deals</h1>
      </header>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 py-3">
        {(["saved", "claimed", "used", "expired"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold capitalize ${
              tab === t ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white" : "bg-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-3 px-3">
        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>
        ) : tab === "saved" ? (
          saved.length ? (
            saved.map((d) => <DealCard key={d.id} deal={d} />)
          ) : (
            <Empty text="No saved deals yet." action={() => nav("/deals")} actionLabel="Browse deals" />
          )
        ) : (
          (() => {
            const list = grouped[tab];
            if (!list.length) {
              return <Empty text={`No ${tab} deals.`} action={() => nav("/deals")} actionLabel="Browse deals" />;
            }
            return list.map((c) => (
              <ClaimCard
                key={c.id}
                claim={c}
                onUsed={async () => {
                  try {
                    await markDealUsed(c.id);
                    toast.success("Marked as used");
                    void load();
                  } catch (e: any) {
                    toast.error(e?.message || "Failed");
                  }
                }}
              />
            ));
          })()
        )}
      </div>
    </div>
  );
}

function Empty({ text, action, actionLabel }: { text: string; action: () => void; actionLabel: string }) {
  return (
    <div className="px-4 py-16 text-center">
      <p className="font-semibold">{text}</p>
      <button type="button" onClick={action} className="mt-3 text-sm font-bold text-orange-600">
        {actionLabel}
      </button>
    </div>
  );
}

function ClaimCard({ claim, onUsed }: { claim: DealClaim; onUsed: () => void }) {
  const nav = useNavigate();
  const deal = claim.deals;
  if (!deal) return null;
  const url = mapsUrl(deal);

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <button type="button" className="w-full text-left" onClick={() => nav(`/deals/${deal.id}`)}>
        <p className="text-sm font-bold">{deal.title}</p>
        <p className="text-xs text-muted-foreground">{deal.deal_businesses?.name}</p>
      </button>
      {claim.redemption_code ? (
        <p className="mt-2 font-mono text-lg font-black tracking-widest">{claim.redemption_code}</p>
      ) : null}
      {claim.qr_payload && claim.status === "claimed" ? (
        <div className="mt-2 flex justify-center rounded-xl bg-white p-2">
          <QRCodeSVG value={claim.qr_payload} size={120} />
        </div>
      ) : null}
      <p className="mt-2 text-[11px] text-muted-foreground">
        {claim.expires_at ? `Expires ${new Date(claim.expires_at).toLocaleString()}` : ""}
      </p>
      {deal.terms ? <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{deal.terms}</p> : null}
      <div className="mt-3 flex gap-2">
        {claim.status === "claimed" ? (
          <button type="button" onClick={onUsed} className="rounded-full bg-foreground px-3 py-1.5 text-xs font-bold text-background">
            Mark as Used
          </button>
        ) : null}
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="rounded-full bg-muted px-3 py-1.5 text-xs font-bold">
            Get Directions
          </a>
        ) : null}
      </div>
    </div>
  );
}
