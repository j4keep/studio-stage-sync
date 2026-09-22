import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, ExternalLink, Flag, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  listBusinessDocuments,
  listBusinessesForAdmin,
  listDealsForBusinessAdmin,
  moderateDeal,
  reviewDealBusiness,
  verificationStatusLabel,
  type Deal,
  type DealBusiness,
  type DealBusinessDocument,
} from "@/lib/deals-api";
import { toast } from "sonner";

type Filter = "pending" | "approved" | "rejected" | "needs_info" | "suspended" | "all";
type AdminTab = "businesses" | "reports";

type DealReportRow = {
  id: string;
  deal_id: string;
  reporter_id: string;
  reason: string;
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  admin_notes: string | null;
  created_at: string;
  deals?: {
    id: string;
    title: string;
    business_id: string;
    status: string;
    deal_businesses?: { name: string } | null;
  } | null;
};

export default function AdminDealsVerificationPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [filter, setFilter] = useState<Filter>("pending");
  const [tab, setTab] = useState<AdminTab>("businesses");
  const [rows, setRows] = useState<DealBusiness[]>([]);
  const [selected, setSelected] = useState<DealBusiness | null>(null);
  const [docs, setDocs] = useState<DealBusinessDocument[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [acting, setActing] = useState(false);
  const [reports, setReports] = useState<DealReportRow[]>([]);
  const [reportStatus, setReportStatus] = useState<"open" | "reviewing" | "resolved" | "dismissed">("open");
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    void supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(Boolean(data));
    });
  }, [user]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [list, reportResult] = await Promise.all([
        listBusinessesForAdmin(null),
        (supabase as any)
          .from("deal_reports")
          .select("id,deal_id,reporter_id,reason,details,status,admin_notes,created_at,deals(id,title,business_id,status,deal_businesses(name))")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      setRows(list);
      if (reportResult.error) throw reportResult.error;
      setReports((reportResult.data || []) as DealReportRow[]);
    } catch (e: any) {
      toast.error(e?.message || "Could not load businesses — apply verification migration?");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, needs_info: 0, suspended: 0 };
    for (const r of rows) {
      if (r.verification_status in c) (c as any)[r.verification_status] += 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.verification_status === filter)),
    [rows, filter],
  );

  const filteredReports = useMemo(
    () => reports.filter((report) => report.status === reportStatus),
    [reports, reportStatus],
  );

  const updateReport = async (
    report: DealReportRow,
    status: "reviewing" | "resolved" | "dismissed",
    moderate?: "pause" | "hide",
  ) => {
    if (!user) return;
    setActing(true);
    try {
      if (moderate && report.deal_id) {
        await moderateDeal(report.deal_id, moderate, reportNotes[report.id] || `Report: ${report.reason}`);
      }
      const { error } = await (supabase as any)
        .from("deal_reports")
        .update({
          status,
          admin_notes: reportNotes[report.id]?.trim() || report.admin_notes || null,
          resolved_at: status === "resolved" || status === "dismissed" ? new Date().toISOString() : null,
          resolved_by: status === "resolved" || status === "dismissed" ? user.id : null,
        })
        .eq("id", report.id);
      if (error) throw error;
      toast.success(
        moderate === "hide"
          ? "Deal hidden and report resolved"
          : moderate === "pause"
            ? "Deal paused and report moved to review"
            : status === "dismissed"
              ? "Report dismissed"
              : status === "resolved"
                ? "Report resolved"
                : "Report moved to review",
      );
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Could not update report");
    } finally {
      setActing(false);
    }
  };

  const openBiz = async (b: DealBusiness) => {
    setSelected(b);
    setMessage("");
    try {
      const [d, dealRows] = await Promise.all([
        listBusinessDocuments(b.id),
        listDealsForBusinessAdmin(b.id),
      ]);
      setDocs(d);
      setDeals(dealRows);
    } catch (e: any) {
      toast.error(e?.message || "Could not load business detail");
      setDocs([]);
      setDeals([]);
    }
  };

  const decide = async (decision: "approve" | "reject" | "request_info" | "suspend" | "revoke") => {
    if (!selected) return;
    setActing(true);
    try {
      const updated = await reviewDealBusiness(selected.id, decision, message);
      toast.success(`Business ${decision.replace("_", " ")}`);
      setSelected(updated);
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Action failed");
    } finally {
      setActing(false);
    }
  };

  if (!user) {
    return (
      <div className="px-6 pt-20 text-center">
        <p className="font-bold">Sign in required</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="px-6 pt-20 text-center">
        <Shield className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="font-bold">Admin only</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-black">Deals Verification</h1>
          <p className="text-[11px] text-muted-foreground">Approve merchants · moderate offers</p>
        </div>
        <BadgeCheck className="h-5 w-5 text-orange-500" />
      </header>

      <div className="grid grid-cols-2 gap-2 px-3 pt-3">
        <button
          type="button"
          onClick={() => setTab("businesses")}
          className={`rounded-xl px-3 py-2 text-xs font-black ${
            tab === "businesses"
              ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white"
              : "bg-muted text-foreground"
          }`}
        >
          Business Verification
        </button>
        <button
          type="button"
          onClick={() => setTab("reports")}
          className={`rounded-xl px-3 py-2 text-xs font-black ${
            tab === "reports"
              ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white"
              : "bg-muted text-foreground"
          }`}
        >
          <Flag className="mr-1 inline h-3.5 w-3.5" />
          Reports ({reports.filter((report) => report.status === "open").length})
        </button>
      </div>

      {tab === "businesses" ? (
        <>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 py-3">
        {(
          [
            ["pending", "🟡 Pending", counts.pending],
            ["needs_info", "🔄 Needs info", counts.needs_info],
            ["approved", "🟢 Approved", counts.approved],
            ["rejected", "🔴 Rejected", counts.rejected],
            ["suspended", "⛔ Suspended", counts.suspended],
            ["all", "All", rows.length],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
              filter === id
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white"
                : "bg-slate-300/90 text-slate-800 dark:bg-slate-700 dark:text-slate-100"
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      <div className="space-y-2 px-3">
        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>
        ) : !filtered.length ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No businesses in this queue.</p>
        ) : (
          filtered.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => openBiz(b)}
              className={`w-full rounded-2xl border px-3 py-3 text-left ${
                selected?.id === b.id ? "border-orange-400 bg-orange-500/5" : "border-border bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{b.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {[b.city, b.state].filter(Boolean).join(", ")} · {b.category || "—"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">
                  {verificationStatusLabel(b.verification_status)}
                </span>
              </div>
              {b.needs_manual_review || (b.fraud_flags && b.fraud_flags.length) ? (
                <p className="mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                  ⚑ Fraud flags: {(b.fraud_flags || []).map((f) => f.code).join(", ") || "manual review"}
                </p>
              ) : null}
            </button>
          ))
        )}
      </div>

        </>
      ) : (
        <>
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 py-3">
            {(["open", "reviewing", "resolved", "dismissed"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setReportStatus(status)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold capitalize ${
                  reportStatus === status
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white"
                    : "bg-slate-300/90 text-slate-800 dark:bg-slate-700 dark:text-slate-100"
                }`}
              >
                {status} ({reports.filter((report) => report.status === status).length})
              </button>
            ))}
          </div>

          <div className="space-y-3 px-3">
            {loading ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Loading reports…</p>
            ) : filteredReports.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No {reportStatus} deal reports.</p>
            ) : (
              filteredReports.map((report) => (
                <article key={report.id} className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black">{report.deals?.title || "Deleted deal"}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {report.deals?.deal_businesses?.name || "Business"} · {new Date(report.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className="rounded-full bg-orange-500/10 px-2 py-1 text-[10px] font-bold capitalize text-orange-700 dark:text-orange-300">
                      {report.reason.replace(/_/g, " ")}
                    </span>
                  </div>

                  {report.details ? (
                    <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs leading-relaxed">{report.details}</p>
                  ) : null}

                  <textarea
                    value={reportNotes[report.id] ?? report.admin_notes ?? ""}
                    onChange={(event) =>
                      setReportNotes((current) => ({ ...current, [report.id]: event.target.value }))
                    }
                    placeholder="Admin notes"
                    className="mt-3 h-20 w-full resize-none rounded-xl border border-border bg-muted p-3 text-xs outline-none"
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    {report.status === "open" ? (
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => void updateReport(report, "reviewing")}
                        className="rounded-full bg-sky-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                      >
                        Review
                      </button>
                    ) : null}
                    {report.deals && report.status !== "resolved" && report.status !== "dismissed" ? (
                      <>
                        <button
                          type="button"
                          disabled={acting}
                          onClick={() => void updateReport(report, "reviewing", "pause")}
                          className="rounded-full bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                        >
                          Pause deal
                        </button>
                        <button
                          type="button"
                          disabled={acting}
                          onClick={() => void updateReport(report, "resolved", "hide")}
                          className="rounded-full bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                        >
                          Hide + resolve
                        </button>
                      </>
                    ) : null}
                    {report.status !== "resolved" && report.status !== "dismissed" ? (
                      <>
                        <button
                          type="button"
                          disabled={acting}
                          onClick={() => void updateReport(report, "resolved")}
                          className="rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          disabled={acting}
                          onClick={() => void updateReport(report, "dismissed")}
                          className="rounded-full bg-muted px-3 py-1.5 text-[11px] font-bold disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      )}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-background p-4 shadow-xl sm:rounded-2xl">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-black">{selected.name}</h2>
                <p className="text-[11px] text-muted-foreground">
                  {verificationStatusLabel(selected.verification_status)}
                  {selected.is_verified ? " · ✔ Verified Business" : ""}
                </p>
              </div>
              <button type="button" className="text-sm font-semibold text-muted-foreground" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <Row label="Phone" value={selected.phone} />
              <Row label="Email" value={selected.email} />
              <Row label="Website" value={selected.website} />
              <Row
                label="Address"
                value={[selected.address, selected.city, selected.state, selected.postal_code]
                  .filter(Boolean)
                  .join(", ")}
              />
              <Row label="Category" value={selected.category} />
              <Row label="Description" value={selected.description} />
              <Row label="Violations" value={String(selected.violation_count || 0)} />
            </div>

            {(selected.fraud_flags || []).length ? (
              <div className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs">
                <p className="font-bold">Fraud / risk flags</p>
                <ul className="mt-1 list-disc pl-4">
                  {(selected.fraud_flags || []).map((f, i) => (
                    <li key={i}>
                      {f.code}
                      {f.detail ? ` — ${f.detail}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-4">
              <p className="text-xs font-bold">Uploaded documents</p>
              {!docs.length ? (
                <p className="mt-1 text-[11px] text-muted-foreground">No documents</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {docs.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted px-2.5 py-2 text-[11px]">
                      <span className="truncate font-semibold capitalize">{d.doc_type.replace(/_/g, " ")}</span>
                      <a href={d.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-orange-600">
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4">
              <p className="text-xs font-bold">Submitted deals</p>
              {!deals.length ? (
                <p className="mt-1 text-[11px] text-muted-foreground">None yet</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {deals.slice(0, 8).map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-2 text-[11px]">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{d.title}</p>
                        <p className="capitalize text-muted-foreground">{d.status.replace("_", " ")}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          className="rounded-full bg-muted px-2 py-1 font-bold"
                          onClick={async () => {
                            try {
                              await moderateDeal(d.id, "pause", "Admin pause");
                              toast.success("Deal paused");
                              setDeals(await listDealsForBusinessAdmin(selected.id));
                            } catch (e: any) {
                              toast.error(e?.message || "Failed");
                            }
                          }}
                        >
                          Pause
                        </button>
                        <button
                          type="button"
                          className="rounded-full bg-muted px-2 py-1 font-bold"
                          onClick={async () => {
                            try {
                              await moderateDeal(d.id, "hide", "Admin hide");
                              toast.success("Deal hidden");
                              setDeals(await listDealsForBusinessAdmin(selected.id));
                            } catch (e: any) {
                              toast.error(e?.message || "Failed");
                            }
                          }}
                        >
                          Hide
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <label className="mt-4 block text-xs font-semibold">
              Message / reason
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1 h-20 w-full rounded-xl border border-border bg-muted p-3 text-sm"
                placeholder="Optional note for reject / request more info"
              />
            </label>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={acting}
                onClick={() => decide("approve")}
                className="rounded-xl bg-emerald-600 py-2.5 text-xs font-black text-white disabled:opacity-50"
              >
                ✅ Approve
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={() => decide("reject")}
                className="rounded-xl bg-red-600 py-2.5 text-xs font-black text-white disabled:opacity-50"
              >
                ❌ Reject
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={() => decide("request_info")}
                className="rounded-xl bg-sky-600 py-2.5 text-xs font-black text-white disabled:opacity-50"
              >
                🔄 Request more info
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={() => decide("suspend")}
                className="rounded-xl bg-foreground py-2.5 text-xs font-black text-background disabled:opacity-50"
              >
                Suspend posting
              </button>
            </div>
            {selected.is_verified ? (
              <button
                type="button"
                disabled={acting}
                onClick={() => decide("revoke")}
                className="mt-2 w-full rounded-xl border border-border py-2.5 text-xs font-bold"
              >
                Revoke verification
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium whitespace-pre-wrap">{value}</p>
    </div>
  );
}
