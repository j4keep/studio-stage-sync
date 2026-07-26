import { useEffect, useState } from "react";
import { ArrowLeft, HandHelping, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { timeAgo } from "@/lib/jobs";
import { formatGigBudget, gigHelperId, gigStatusLabel } from "@/lib/gigs";

type Tab = "posted" | "working" | "completed";

type GigRow = {
  id: string;
  title: string;
  location: string | null;
  budget_min: number | null;
  budget_max: number | null;
  status: string;
  created_at: string;
  poster_id: string;
  assigned_to: string | null;
  worker_id?: string | null;
  poster_completed_at?: string | null;
  worker_completed_at?: string | null;
};

/** Gig dashboard — Posted / Working / Completed (mirrors My Jobs). */
export default function MyGigsPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("posted");
  const [posted, setPosted] = useState<GigRow[]>([]);
  const [working, setWorking] = useState<GigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [postOpen, setPostOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const base =
      "id,title,location,budget_min,budget_max,status,created_at,poster_id,assigned_to";
    const withComplete = `${base},poster_completed_at,worker_completed_at`;

    const fetchSide = async (column: "poster_id" | "assigned_to") => {
      let res = await (supabase as any)
        .from("gig_listings")
        .select(withComplete)
        .eq(column, user.id)
        .order("created_at", { ascending: false });
      if (res.error) {
        res = await (supabase as any)
          .from("gig_listings")
          .select(base)
          .eq(column, user.id)
          .order("created_at", { ascending: false });
      }
      return (res.data ?? []) as GigRow[];
    };

    const [p, w] = await Promise.all([fetchSide("poster_id"), fetchSide("assigned_to")]);
    setPosted(p);
    setWorking(w);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [user]);

  const activePosted = posted.filter((g) => g.status !== "completed" && g.status !== "cancelled");
  const activeWorking = working.filter((g) => g.status !== "completed" && g.status !== "cancelled");
  const completed = [...posted, ...working].filter(
    (g, i, arr) => g.status === "completed" && arr.findIndex((x) => x.id === g.id) === i,
  );

  const list = tab === "posted" ? activePosted : tab === "working" ? activeWorking : completed;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur">
        <button type="button" onClick={() => nav(-1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex-1 text-base font-bold">My Gigs</h1>
        <button
          type="button"
          onClick={() => nav("/local-help")}
          className="h-8 rounded-full bg-muted px-3 text-[11px] font-bold"
        >
          Local Help
        </button>
        <button
          type="button"
          onClick={() => setPostOpen(true)}
          className="h-8 rounded-full bg-primary px-3 text-[11px] font-bold text-primary-foreground"
        >
          Post a gig
        </button>
      </header>

      <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-3">
        {(
          [
            ["posted", `Posted (${activePosted.length})`],
            ["working", `Working (${activeWorking.length})`],
            ["completed", `Completed (${completed.length})`],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`h-8 shrink-0 rounded-full px-3 text-xs font-bold ${
              tab === t ? "bg-foreground text-background" : "bg-muted text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-2 p-4 pb-24">
        {loading && <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}
        {!loading && list.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <HandHelping className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">
              {tab === "posted" && "No gigs posted yet"}
              {tab === "working" && "No gigs you're helping with"}
              {tab === "completed" && "No completed gigs yet"}
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {tab === "completed"
                ? "When both sides press Complete on a gig, it shows up here so you can rate each other."
                : "Post a gig or join one from Opportunities — manage everything here."}
            </p>
            {tab !== "completed" && (
              <button
                type="button"
                onClick={() => nav("/jobs")}
                className="mt-4 h-9 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground"
              >
                Go to Opportunities
              </button>
            )}
          </div>
        )}
        {list.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => nav(`/gigs/${g.id}`)}
            className="w-full rounded-2xl border border-border bg-card p-3 text-left"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-foreground">{g.title}</p>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">
                {gigStatusLabel(g.status)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              {g.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {g.location}
                </span>
              )}
              <span>{formatGigBudget(g.budget_min, g.budget_max)}</span>
              <span>{timeAgo(g.created_at)}</span>
            </div>
            {tab === "posted" && gigHelperId(g) && g.status !== "completed" && (
              <p className="mt-2 text-[11px] font-semibold text-primary">Helper assigned — open to message or complete</p>
            )}
            {(g.poster_completed_at || g.worker_completed_at) && g.status !== "completed" && (
              <p className="mt-2 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                Waiting for both sides to press Complete before rating
              </p>
            )}
            {tab === "completed" && (
              <p className="mt-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Open to rate the other person
              </p>
            )}
          </button>
        ))}
      </div>

      <PostGigSheet
        open={postOpen}
        onClose={() => setPostOpen(false)}
        onCreated={() => {
          setPostOpen(false);
          void load();
        }}
      />
    </div>
  );
}
