import { useEffect, useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { timeAgo } from "@/lib/jobs";
import { formatGigBudget, gigStatusLabel } from "@/lib/gigs";

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
  worker_id: string | null;
  poster_completed_at: string | null;
  worker_completed_at: string | null;
};

/** Manage gigs you posted or are working on — mirrors My Jobs. */
export default function MyGigsPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("posted");
  const [posted, setPosted] = useState<GigRow[]>([]);
  const [working, setWorking] = useState<GigRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [p, w] = await Promise.all([
      (supabase as any)
        .from("gig_listings")
        .select(
          "id,title,location,budget_min,budget_max,status,created_at,poster_id,worker_id,poster_completed_at,worker_completed_at",
        )
        .eq("poster_id", user.id)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("gig_listings")
        .select(
          "id,title,location,budget_min,budget_max,status,created_at,poster_id,worker_id,poster_completed_at,worker_completed_at",
        )
        .eq("worker_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    setPosted(p.data ?? []);
    setWorking(w.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [user]);

  const completed = [...posted, ...working].filter(
    (g, i, arr) => g.status === "completed" && arr.findIndex((x) => x.id === g.id) === i,
  );
  const list =
    tab === "posted"
      ? posted.filter((g) => g.status !== "completed")
      : tab === "working"
        ? working.filter((g) => g.status !== "completed")
        : completed;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur">
        <button type="button" onClick={() => nav(-1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex-1 text-base font-bold">My Gigs</h1>
        <button
          type="button"
          onClick={() => nav("/jobs")}
          className="h-8 rounded-full bg-primary px-3 text-[11px] font-bold text-primary-foreground"
        >
          Find gigs
        </button>
      </header>

      <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-3">
        {(
          [
            ["posted", `Posted (${posted.filter((g) => g.status !== "completed").length})`],
            ["working", `Working (${working.filter((g) => g.status !== "completed").length})`],
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
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && list.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No gigs here yet</p>
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
            {(g.poster_completed_at || g.worker_completed_at) && g.status !== "completed" && (
              <p className="mt-2 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                Waiting for both sides to press Complete before rating
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
