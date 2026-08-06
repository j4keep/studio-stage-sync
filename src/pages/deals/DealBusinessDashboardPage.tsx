import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Pause, Pencil, Plus, Square, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { conversionRate, formatExpiresLabel, remainingClaims } from "@/lib/deals";
import {
  duplicateDeal,
  getBusinessDashboard,
  getOrCreateBusinessForUser,
  listMyBusinesses,
  updateDealStatus,
  type Deal,
  type DealBusiness,
} from "@/lib/deals-api";
import { toast } from "sonner";

export default function DealBusinessDashboardPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<DealBusiness[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [totals, setTotals] = useState({ views: 0, saves: 0, claims: 0, redemptions: 0 });
  const [conversion, setConversion] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let list = await listMyBusinesses(user.id);
      if (!list.length) {
        list = [await getOrCreateBusinessForUser(user.id)];
      }
      setBusinesses(list);
      const bid = businessId || list[0].id;
      setBusinessId(bid);
      const dash = await getBusinessDashboard(bid);
      setDeals(dash.deals);
      setTotals(dash.totals);
      setConversion(dash.conversion);
    } catch (e: any) {
      toast.error(e?.message || "Could not load dashboard");
    } finally {
      setLoading(false);
    }
  }, [user, businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) {
    return (
      <div className="px-6 pt-20 text-center">
        <p className="font-bold">Sign in for the business dashboard</p>
        <button type="button" onClick={() => nav("/auth")} className="mt-4 text-sm font-semibold text-orange-600">
          Sign in
        </button>
      </div>
    );
  }

  const biz = businesses.find((b) => b.id === businessId);

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
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-black">Deals dashboard</h1>
          <p className="truncate text-[11px] text-muted-foreground">{biz?.name}</p>
        </div>
        <button
          type="button"
          onClick={() => nav("/deals/create")}
          className="flex h-9 items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-3 text-xs font-bold text-white"
        >
          <Plus className="h-3.5 w-3.5" /> Create
        </button>
      </header>

      <div className="px-3 py-3">
        {businesses.length > 1 ? (
          <select
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            className="mb-3 h-10 w-full rounded-xl border border-border bg-muted px-3 text-sm"
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        ) : null}

        {!biz?.is_verified && !biz?.can_publish ? (
          <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            Business verification required to publish active public deals.
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Views" value={totals.views} />
          <Stat label="Saves" value={totals.saves} />
          <Stat label="Claims" value={totals.claims} />
          <Stat label="Redemptions" value={totals.redemptions} />
          <Stat label="Conversion" value={`${conversion}%`} />
          <Stat label="Active" value={deals.filter((d) => d.status === "active").length} />
        </div>
      </div>

      <div className="space-y-3 px-3">
        <h2 className="text-sm font-bold">Your deals</h2>
        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : !deals.length ? (
          <div className="py-12 text-center">
            <p className="font-semibold">No deals yet</p>
            <button type="button" onClick={() => nav("/deals/create")} className="mt-3 text-sm font-bold text-orange-600">
              Create your first deal
            </button>
          </div>
        ) : (
          deals.map((d) => (
            <div key={d.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{d.title}</p>
                  <p className="text-[11px] capitalize text-muted-foreground">
                    {d.status.replace("_", " ")} · {formatExpiresLabel(d.expires_at)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {d.views_count} views · {d.saves_count} saves · {d.claims_count} claims ·{" "}
                    {d.redemption_count} redeemed · {conversionRate(d.views_count, d.claims_count)}% conv
                    {remainingClaims(d) != null ? ` · ${remainingClaims(d)} left` : ""}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Action
                  icon={Pencil}
                  label="Edit"
                  onClick={() => nav(`/deals/create?edit=${d.id}`)}
                />
                {d.status === "active" ? (
                  <Action
                    icon={Pause}
                    label="Pause"
                    onClick={async () => {
                      try {
                        await updateDealStatus(d.id, "paused", d.business_id);
                        toast.success("Paused");
                        void load();
                      } catch (e: any) {
                        toast.error(e?.message || "Failed");
                      }
                    }}
                  />
                ) : null}
                {d.status === "paused" ? (
                  <Action
                    icon={Square}
                    label="Resume→Review"
                    onClick={async () => {
                      try {
                        await updateDealStatus(d.id, "pending_review", d.business_id);
                        toast.success("Sent back to review");
                        void load();
                      } catch (e: any) {
                        toast.error(e?.message || "Failed");
                      }
                    }}
                  />
                ) : null}
                <Action
                  icon={Copy}
                  label="Duplicate"
                  onClick={async () => {
                    try {
                      await duplicateDeal(d.id, user.id);
                      toast.success("Duplicated as draft");
                      void load();
                    } catch (e: any) {
                      toast.error(e?.message || "Failed");
                    }
                  }}
                />
                {d.status === "active" || d.status === "paused" ? (
                  <Action
                    icon={Square}
                    label="End early"
                    onClick={async () => {
                      try {
                        await updateDealStatus(d.id, "expired", d.business_id);
                        toast.success("Ended");
                        void load();
                      } catch (e: any) {
                        toast.error(e?.message || "Failed");
                      }
                    }}
                  />
                ) : null}
                <Action
                  icon={Trash2}
                  label="Archive"
                  onClick={async () => {
                    try {
                      await updateDealStatus(d.id, "archived", d.business_id);
                      toast.success("Archived");
                      void load();
                    } catch (e: any) {
                      toast.error(e?.message || "Failed");
                    }
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-orange-500/15 bg-orange-500/5 px-2 py-2.5 text-center">
      <p className="text-base font-black">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Action({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold"
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}
