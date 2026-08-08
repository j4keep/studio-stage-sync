import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Copy,
  MessageSquare,
  Pause,
  Pencil,
  Plus,
  Share2,
  Square,
  Trash2,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { conversionRate, formatExpiresLabel, remainingClaims } from "@/lib/deals";
import {
  deleteDeal,
  duplicateDeal,
  getBusinessDashboard,
  listBusinessDocuments,
  listMyBusinesses,
  updateDealStatus,
  verificationStatusLabel,
  type Deal,
  type DealBusiness,
  type DealBusinessDocument,
} from "@/lib/deals-api";
import VerifiedBusinessBadge from "@/components/deals/VerifiedBusinessBadge";
import ShareDealSheet from "@/components/deals/ShareDealSheet";
import { toast } from "sonner";

type DashTab = "dashboard" | "verification";

export default function DealBusinessDashboardPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<DealBusiness[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [docs, setDocs] = useState<DealBusinessDocument[]>([]);
  const [totals, setTotals] = useState({ views: 0, saves: 0, claims: 0, redemptions: 0 });
  const [conversion, setConversion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DashTab>("dashboard");
  const [shareDeal, setShareDeal] = useState<Deal | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const list = await listMyBusinesses(user.id);
      if (!list.length) {
        nav("/deals/become-business", { replace: true });
        return;
      }
      setBusinesses(list);
      const bid = businessId || list[0].id;
      setBusinessId(bid);
      const [dash, docRows] = await Promise.all([
        getBusinessDashboard(bid),
        listBusinessDocuments(bid).catch(() => [] as DealBusinessDocument[]),
      ]);
      setDeals(dash.deals);
      setTotals(dash.totals);
      setConversion(dash.conversion);
      setDocs(docRows);
    } catch (e: any) {
      toast.error(e?.message || "Could not load dashboard");
    } finally {
      setLoading(false);
    }
  }, [user, businessId, nav]);

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
          <h1 className="text-lg font-black">Business Dashboard</h1>
          <p className="truncate text-[11px] text-muted-foreground">{biz?.name}</p>
        </div>
        <button
          type="button"
          onClick={() => nav("/deals/create")}
          className="flex h-9 items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-3 text-xs font-bold text-white"
        >
          <Plus className="h-3.5 w-3.5" /> Post Deal
        </button>
      </header>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 py-3">
        {(
          [
            { id: "dashboard" as const, label: "Dashboard", icon: BarChart3 },
            { id: "post", label: "Post Deal", icon: Plus, path: "/deals/create" },
            { id: "my", label: "My Deals", icon: Pencil, path: null },
            { id: "verification" as const, label: "Verification", icon: BadgeCheck },
            { id: "messages", label: "Messages", icon: MessageSquare, soon: true },
            { id: "payouts", label: "Payouts", icon: Wallet, soon: true },
          ] as const
        ).map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              if ("soon" in item && item.soon) {
                toast.message(`${item.label} coming soon`);
                return;
              }
              if ("path" in item && item.path) {
                nav(item.path);
                return;
              }
              if (item.id === "my") {
                setTab("dashboard");
                document.getElementById("biz-deals-list")?.scrollIntoView({ behavior: "smooth" });
                return;
              }
              if (item.id === "dashboard" || item.id === "verification") setTab(item.id);
            }}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${
              tab === item.id
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white"
                : "bg-slate-300/90 text-slate-800 dark:bg-slate-700 dark:text-slate-100"
            }`}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="px-3 pb-3">
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

        {tab === "verification" ? (
          <div className="mb-3 space-y-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black">Business verification</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Status:{" "}
                    <span className="font-semibold">
                      {verificationStatusLabel(biz?.verification_status)}
                    </span>
                  </p>
                </div>
                {biz?.is_verified ? <VerifiedBusinessBadge /> : null}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Verification is optional. You can create and publish deals right now — getting verified just adds the
                ✔ Verified Business badge so shoppers trust your offers faster.
              </p>
              {biz?.admin_request_message ? (
                <p className="mt-3 rounded-xl bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-800 dark:text-sky-200">
                  Admin needs more info: {biz.admin_request_message}
                </p>
              ) : null}
              {biz?.verification_note && biz.verification_status === "rejected" ? (
                <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-300">
                  Rejected: {biz.verification_note}
                </p>
              ) : null}
              {biz?.posting_suspended ? (
                <p className="mt-3 rounded-xl bg-foreground/10 px-3 py-2 text-xs font-semibold">
                  Deal posting is temporarily suspended. Contact support if you believe this is an error.
                </p>
              ) : null}
              {biz?.is_verified ? (
                <p className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  ✔ Verified Business — badge shown on all your deals.
                </p>
              ) : (
                <p className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  You’re cleared to publish deals now. Verification is optional.
                </p>
              )}
              {biz && !biz.is_verified ? (
                <button
                  type="button"
                  onClick={() => nav("/deals/become-business")}
                  className="mt-3 h-10 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-xs font-black text-white"
                >
                  {biz.verification_status === "needs_info" || biz.verification_status === "rejected"
                    ? "Update profile & resubmit"
                    : "Get the Verified badge (optional)"}
                </button>
              ) : null}

            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-black">Uploaded documents</p>
              {!docs.length ? (
                <p className="mt-2 text-xs text-muted-foreground">No documents yet.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {docs.map((d) => (
                    <li key={d.id} className="rounded-lg bg-muted px-2.5 py-2 text-[11px]">
                      <span className="font-semibold capitalize">{d.doc_type.replace(/_/g, " ")}</span>
                      {" · "}
                      {d.file_name || "Document"}
                      {" · "}
                      <span className="capitalize text-muted-foreground">{d.status}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                Reputation: {Number(biz?.avg_rating || 0).toFixed(1)}★ · {biz?.review_count || 0} reviews ·{" "}
                {biz?.violation_count || 0} violations
              </p>
            </div>
          </div>
        ) : null}

        {biz?.posting_suspended && tab === "dashboard" ? (
          <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            Deal posting is temporarily suspended for this business.
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

      <div id="biz-deals-list" className="space-y-3 px-3">
        <h2 className="text-sm font-bold">My Deals</h2>
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
                  icon={Share2}
                  label="Share"
                  onClick={() => setShareDeal(d)}
                />
                <Action
                  icon={Square}
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
                <Action
                  icon={Trash2}
                  label="Delete"
                  onClick={async () => {
                    if (!window.confirm(`Delete "${d.title}" permanently? This cannot be undone.`)) return;
                    try {
                      await deleteDeal(d.id, d.business_id);
                      toast.success("Deal deleted");
                      void load();
                    } catch (e: any) {
                      toast.error(e?.message || "Could not delete deal");
                    }
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {shareDeal ? <ShareDealSheet deal={shareDeal} onClose={() => setShareDeal(null)} /> : null}
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
