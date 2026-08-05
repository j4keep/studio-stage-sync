import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Shield,
  Search,
  AlertTriangle,
  Clock,
  Ban,
  CheckCircle2,
  Flag,
  Scale,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  MODERATION_REASONS,
  actionLabel,
  applyModerationAction,
  fetchModerationHistory,
  statusLabel,
  suggestedActionForOffenses,
  type ModerationActionType,
  type ModerationReason,
  type ModerationStatus,
} from "@/lib/trust-safety";

type Tab =
  | "users"
  | "reports"
  | "timeouts"
  | "suspended"
  | "appeals"
  | "history";

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  moderation_status: ModerationStatus;
  moderation_until: string | null;
  moderation_reason: string | null;
  moderation_offense_count: number;
};

const ACTION_BUTTONS: ModerationActionType[] = [
  "warning",
  "cooldown_24h",
  "timeout_3d",
  "timeout_7d",
  "suspend",
  "ban",
  "restore",
  "note",
];

/**
 * Trust & Safety admin — enforcing rules (separate from Customer Relations).
 * Path: /admin/trust-safety
 */
export default function AdminTrustSafetyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("users");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileRow[]>([]);
  const [selected, setSelected] = useState<ProfileRow | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [appeals, setAppeals] = useState<any[]>([]);
  const [restricted, setRestricted] = useState<ProfileRow[]>([]);
  const [reason, setReason] = useState<ModerationReason>("Harassment");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [schemaReady, setSchemaReady] = useState<boolean | null>(null);
  const [setupBusy, setSetupBusy] = useState(false);

  const normalizeProfile = (row: any): ProfileRow => ({
    user_id: row.user_id,
    display_name: row.display_name ?? null,
    avatar_url: row.avatar_url ?? null,
    moderation_status: (row.moderation_status || "active") as ModerationStatus,
    moderation_until: row.moderation_until ?? null,
    moderation_reason: row.moderation_reason ?? null,
    moderation_offense_count: Number(row.moderation_offense_count || 0),
  });

  const checkSchema = async () => {
    const { error } = await (supabase as any)
      .from("profiles")
      .select("moderation_status")
      .limit(1);
    const ready = !error;
    setSchemaReady(ready);
    return ready;
  };

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    void supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(Boolean(data));
    });
  }, [user]);

  useEffect(() => {
    if (isAdmin) void checkSchema();
  }, [isAdmin]);

  const runSchemaSetup = async () => {
    setSetupBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("trust-safety-setup", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Trust & Safety database is ready");
      setSchemaReady(true);
    } catch (e: any) {
      toast.error(
        e?.message ||
          "Could not auto-setup. Open Lovable → Cloud → SQL and run the trust_safety migration.",
      );
      await checkSchema();
    } finally {
      setSetupBusy(false);
    }
  };

  const suggested = useMemo(
    () => suggestedActionForOffenses(selected?.moderation_offense_count ?? 0),
    [selected?.moderation_offense_count],
  );

  const loadRestricted = async () => {
    setLoading(true);
    const ready = schemaReady ?? (await checkSchema());
    if (!ready) {
      setRestricted([]);
      setLoading(false);
      return;
    }
    const { data } = await (supabase as any)
      .from("profiles")
      .select(
        "user_id, display_name, avatar_url, moderation_status, moderation_until, moderation_reason, moderation_offense_count",
      )
      .in("moderation_status", ["cooldown", "timeout", "suspended", "banned", "warned"])
      .order("updated_at", { ascending: false })
      .limit(80);
    setRestricted((data || []).map(normalizeProfile));
    setLoading(false);
  };

  const loadReports = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("content_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80);
    setReports(data || []);
    setLoading(false);
  };

  const loadAppeals = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("moderation_appeals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80);
    setAppeals(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === "reports") void loadReports();
    if (tab === "appeals") void loadAppeals();
    if (tab === "timeouts" || tab === "suspended" || tab === "history") void loadRestricted();
  }, [tab, isAdmin]);

  const searchUsers = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);

    // Always search basic profile fields first so users show up even before
    // the Trust & Safety migration is applied on Lovable Cloud.
    let basic = (supabase as any)
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .limit(20);
    if (q.includes("-") && q.length > 20) basic = basic.eq("user_id", q);
    else basic = basic.ilike("display_name", `%${q}%`);

    const { data: basicData, error: basicErr } = await basic;
    if (basicErr) {
      setLoading(false);
      toast.error(basicErr.message || "Search failed");
      return;
    }

    const baseRows = (basicData || []).map(normalizeProfile);
    const ready = schemaReady ?? (await checkSchema());
    if (!ready || baseRows.length === 0) {
      setResults(baseRows);
      setLoading(false);
      return;
    }

    const ids = baseRows.map((r) => r.user_id);
    const { data: rich } = await (supabase as any)
      .from("profiles")
      .select(
        "user_id, display_name, avatar_url, moderation_status, moderation_until, moderation_reason, moderation_offense_count",
      )
      .in("user_id", ids);

    const byId = new Map((rich || []).map((r: any) => [r.user_id, normalizeProfile(r)]));
    setResults(baseRows.map((r) => byId.get(r.user_id) || r));
    setLoading(false);
  };

  const openUser = async (row: ProfileRow) => {
    setSelected(row);
    if (!schemaReady) {
      setHistory([]);
      return;
    }
    try {
      const rows = await fetchModerationHistory(row.user_id);
      setHistory(rows);
    } catch {
      setHistory([]);
    }
  };

  const runAction = async (action: ModerationActionType) => {
    if (!selected) return;
    if (!schemaReady) {
      toast.error("Set up the Trust & Safety database first (button above)");
      return;
    }
    if (action !== "restore" && action !== "note" && !reason) {
      toast.error("Reason required");
      return;
    }
    setBusy(true);
    try {
      await applyModerationAction({
        targetUserId: selected.user_id,
        actionType: action,
        reason: action === "restore" ? "Restored by moderator" : reason,
        details: details.trim() || null,
      });
      toast.success(actionLabel(action));
      const { data } = await (supabase as any)
        .from("profiles")
        .select(
          "user_id, display_name, avatar_url, moderation_status, moderation_until, moderation_reason, moderation_offense_count",
        )
        .eq("user_id", selected.user_id)
        .maybeSingle();
      if (data) {
        setSelected(data);
        setResults((prev) => prev.map((r) => (r.user_id === data.user_id ? data : r)));
      }
      setHistory(await fetchModerationHistory(selected.user_id));
      setDetails("");
    } catch (e: any) {
      toast.error(e?.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (isAdmin === null) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="px-4 pt-6 pb-24">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <Shield className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-semibold">Admin only</p>
          <p className="mt-1 text-xs text-muted-foreground">Trust & Safety is restricted.</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "users", label: "Users", icon: Search },
    { id: "reports", label: "Reports", icon: Flag },
    { id: "timeouts", label: "Timeouts", icon: Clock },
    { id: "suspended", label: "Suspended / Banned", icon: Ban },
    { id: "appeals", label: "Appeals", icon: Scale },
    { id: "history", label: "Warned", icon: AlertTriangle },
  ];

  return (
    <div className="px-4 pb-24 pt-6">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Trust & Safety</h1>
          <p className="text-[10px] text-muted-foreground">
            Enforce rules · Customer Relations handles tickets/appeals replies
          </p>
        </div>
      </div>

      {schemaReady === false ? (
        <div className="mb-4 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3">
          <p className="text-sm font-bold text-foreground">Database setup needed</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Korina will show in search below. To warn/timeout users, apply the Trust &amp; Safety
            SQL once in Lovable Cloud (or tap auto-setup).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={setupBusy}
              onClick={() => void runSchemaSetup()}
              className="h-9 rounded-lg gradient-primary px-3 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
            >
              {setupBusy ? "Setting up…" : "Auto-setup database"}
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch(
                    "/src/../supabase/migrations/20260805200000_trust_safety_moderation.sql",
                  );
                  // Bundlers won't serve this path — copy a minimal bootstrap instead.
                  const bootstrap = `-- Paste into Lovable → Cloud → SQL Editor → Run
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS moderation_until timestamptz,
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderation_offense_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS moderation_public_note text;`;
                  await navigator.clipboard.writeText(bootstrap);
                  toast.message("SQL copied — paste into Lovable SQL Editor and Run, then search again");
                } catch {
                  toast.error("Could not copy SQL");
                }
              }}
              className="h-9 rounded-lg border border-border bg-card px-3 text-[11px] font-bold text-foreground"
            >
              Copy quick-fix SQL
            </button>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setSelected(null);
            }}
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-[10px] font-semibold ${
              tab === t.id
                ? "gradient-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground"
            }`}
          >
            <t.icon className="h-3 w-3" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" || selected ? (
        <div className="space-y-3">
          {!selected ? (
            <>
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search display name or paste user UUID"
                  className="h-10 flex-1 rounded-xl border border-border bg-card px-3 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void searchUsers();
                  }}
                />
                <button
                  type="button"
                  onClick={() => void searchUsers()}
                  className="h-10 rounded-xl gradient-primary px-4 text-xs font-bold text-primary-foreground"
                >
                  Search
                </button>
              </div>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : (
                <div className="space-y-2">
                  {results.map((r) => (
                    <button
                      key={r.user_id}
                      type="button"
                      onClick={() => void openUser(r)}
                      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {(r.display_name || "?")[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {r.display_name || "Untitled"}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">{r.user_id}</p>
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {statusLabel(r.moderation_status || "active")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs font-semibold text-primary"
              >
                ← Back to search
              </button>

              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Moderation Actions
                </p>
                <p className="mt-1 text-sm font-bold text-foreground">
                  {selected.display_name || "User"}
                </p>
                <p className="text-[10px] text-muted-foreground break-all">{selected.user_id}</p>
                <p className="mt-2 text-xs text-foreground">
                  Current Status:{" "}
                  <span className="font-bold">{statusLabel(selected.moderation_status)}</span>
                  {" · "}
                  Offenses: {selected.moderation_offense_count || 0}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Suggested next: {actionLabel(suggested)}
                </p>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Reason (required)
                </span>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ModerationReason)}
                  className="h-10 w-full rounded-xl border border-border bg-muted px-3 text-sm"
                >
                  {MODERATION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={2}
                placeholder="Moderator note (optional, may be shown to user)"
                className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm"
              />

              <div className="grid grid-cols-2 gap-2">
                {ACTION_BUTTONS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    disabled={busy}
                    onClick={() => void runAction(a)}
                    className={`rounded-xl px-3 py-2.5 text-left text-[11px] font-bold disabled:opacity-50 ${
                      a === suggested
                        ? "border border-primary/40 bg-primary/15 text-foreground"
                        : a === "ban"
                          ? "bg-rose-500/15 text-rose-400"
                          : a === "restore"
                            ? "bg-green-500/15 text-green-500"
                            : "border border-border bg-card text-foreground"
                    }`}
                  >
                    {actionLabel(a)}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-border bg-card p-3">
                <p className="mb-2 text-[11px] font-bold text-foreground">Moderation History</p>
                {history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No actions yet</p>
                ) : (
                  <div className="space-y-2">
                    {history.map((h) => (
                      <div key={h.id} className="border-b border-border/60 pb-2 last:border-0">
                        <p className="text-[11px] font-semibold text-foreground">
                          {new Date(h.created_at).toLocaleString()} · {actionLabel(h.action_type)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Reason: {h.reason}</p>
                        {h.details ? (
                          <p className="text-[10px] text-muted-foreground">{h.details}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {tab === "reports" ? (
        loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : reports.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No content reports</p>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-3">
                <p className="text-sm font-semibold text-foreground">
                  {r.target_type}: {r.reason}
                </p>
                <p className="break-all text-[10px] text-muted-foreground">
                  Target {r.target_id} · Reporter {String(r.reporter_id).slice(0, 8)}…
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()} · {r.status}
                </p>
                <button
                  type="button"
                  className="mt-2 text-[11px] font-bold text-primary"
                  onClick={() => {
                    setQuery(r.reporter_id);
                    setTab("users");
                    void (async () => {
                      setQuery(r.reporter_id);
                      const { data } = await (supabase as any)
                        .from("profiles")
                        .select(
                          "user_id, display_name, avatar_url, moderation_status, moderation_until, moderation_reason, moderation_offense_count",
                        )
                        .eq("user_id", r.reporter_id)
                        .maybeSingle();
                      if (data) void openUser(data);
                    })();
                  }}
                >
                  Open reporter in Users
                </button>
              </div>
            ))}
          </div>
        )
      ) : null}

      {(tab === "timeouts" || tab === "suspended" || tab === "history") && !selected ? (
        loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-2">
            {restricted
              .filter((r) => {
                if (tab === "timeouts") return r.moderation_status === "cooldown" || r.moderation_status === "timeout";
                if (tab === "suspended")
                  return r.moderation_status === "suspended" || r.moderation_status === "banned";
                return r.moderation_status === "warned";
              })
              .map((r) => (
                <button
                  key={r.user_id}
                  type="button"
                  onClick={() => void openUser(r)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.display_name || "User"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {statusLabel(r.moderation_status)}
                      {r.moderation_reason ? ` · ${r.moderation_reason}` : ""}
                    </p>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
          </div>
        )
      ) : null}

      {tab === "appeals" ? (
        loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : appeals.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No appeals yet</p>
        ) : (
          <div className="space-y-2">
            {appeals.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-card p-3">
                <p className="text-sm font-semibold text-foreground">Appeal · {a.status}</p>
                <p className="mt-1 text-xs text-foreground whitespace-pre-wrap">{a.message}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()} · {String(a.user_id).slice(0, 8)}…
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="text-[11px] font-bold text-primary"
                    onClick={() => {
                      setTab("users");
                      void (async () => {
                        const { data } = await (supabase as any)
                          .from("profiles")
                          .select(
                            "user_id, display_name, avatar_url, moderation_status, moderation_until, moderation_reason, moderation_offense_count",
                          )
                          .eq("user_id", a.user_id)
                          .maybeSingle();
                        if (data) void openUser(data);
                      })();
                    }}
                  >
                    Open user
                  </button>
                  <button
                    type="button"
                    className="text-[11px] font-bold text-muted-foreground"
                    onClick={() => navigate("/admin/customer-relations")}
                  >
                    Reply in Customer Relations
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
