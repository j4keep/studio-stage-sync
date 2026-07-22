import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Clock, Briefcase, Sparkles, Plus, X, User, Settings2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { JOB_CATEGORIES, formatSalary, timeAgo, EMPLOYMENT_TYPES, scoreListing, type Prefs } from "@/lib/jobs";
import PostChooserSheet from "@/components/jobs/PostChooserSheet";
import PostJobSheet from "@/components/jobs/PostJobSheet";
import PostGigSheet from "@/components/jobs/PostGigSheet";

type JobRow = {
  id: string;
  title: string;
  category: string;
  employment_type: string;
  salary_min: number | null;
  salary_max: number | null;
  location: string | null;
  remote_mode: string;
  created_at: string;
  __kind: "job";
};
type GigRow = {
  id: string;
  title: string;
  category: string;
  location: string | null;
  budget_min: number | null;
  budget_max: number | null;
  urgency: string;
  created_at: string;
  __kind: "gig";
};
type Listing = JobRow | GigRow;

const RECENT_KEY = "yaj_jobs_recent_searches";

export default function JobsPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("featured");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChooser, setShowChooser] = useState(false);
  const [showJobSheet, setShowJobSheet] = useState(false);
  const [showGigSheet, setShowGigSheet] = useState(false);
  const [forYou, setForYou] = useState(false);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [recents, setRecents] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("job_preferences").select("*").eq("user_id", user.id).maybeSingle();
      if (data) setPrefs(data as Prefs);
    })();
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: jobs }, { data: gigs }] = await Promise.all([
      supabase.from("job_listings").select("id,title,category,employment_type,salary_min,salary_max,location,remote_mode,created_at")
        .eq("status", "open").order("created_at", { ascending: false }).limit(50),
      supabase.from("gig_listings").select("id,title,category,location,budget_min,budget_max,urgency,created_at")
        .eq("status", "open").order("created_at", { ascending: false }).limit(50),
    ]);
    const merged: Listing[] = [
      ...(jobs ?? []).map((j) => ({ ...j, __kind: "job" as const })),
      ...(gigs ?? []).map((g) => ({ ...g, __kind: "gig" as const })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setListings(merged);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submitSearch = () => {
    const q = query.trim();
    if (!q) return;
    const next = [q, ...recents.filter((r) => r !== q)].slice(0, 6);
    setRecents(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
  };

  const filtered = useMemo(() => {
    const n = query.trim().toLowerCase();
    let items = listings;
    if (activeCategory === "remote") {
      items = items.filter((i) => i.__kind === "job" && (i as JobRow).remote_mode === "remote");
    } else if (activeCategory === "need-help") {
      items = items.filter((i) => i.__kind === "gig");
    } else if (activeCategory !== "featured") {
      items = items.filter((i) => i.category === activeCategory);
    }
    if (n) {
      items = items.filter((i) =>
        i.title.toLowerCase().includes(n) ||
        (i.location ?? "").toLowerCase().includes(n) ||
        i.category.toLowerCase().includes(n),
      );
    }
    return items;
  }, [query, activeCategory, listings]);

  const displayed = useMemo(() => {
    if (!forYou || !prefs) return filtered;
    return [...filtered]
      .map((i) => ({ i, s: scoreListing(i, prefs) }))
      .sort((a, b) => b.s - a.s)
      .map(({ i }) => i);
  }, [filtered, forYou, prefs]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-primary">Create • Connect • Elevate</p>
            <h1 className="text-2xl font-black tracking-tight">Opportunities</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => nav("/my-jobs")}
              className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"
              aria-label="My jobs"
            >
              <User className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowChooser(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm active:scale-95 transition-transform"
            >
              <Plus className="w-3.5 h-3.5" />
              Post
            </button>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); submitSearch(); }} className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search jobs, gigs, skills, companies"
            className="w-full h-11 rounded-xl bg-muted border border-border pl-10 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/35"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Clear">
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        {!query && recents.length > 0 && (
          <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-hide">
            {recents.map((r) => (
              <button key={r} onClick={() => setQuery(r)}
                className="shrink-0 px-2.5 h-7 rounded-full bg-muted border border-border text-[11px] text-muted-foreground">
                {r}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button onClick={() => setForYou((v) => !v)}
            className={`inline-flex items-center gap-1 px-3 h-8 rounded-full text-[11px] font-bold ${forYou ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
            <Sparkles className="w-3 h-3" /> {forYou ? "For You ✓" : "For You"}
          </button>
          <button onClick={() => nav("/job-preferences")} className="inline-flex items-center gap-1 px-3 h-8 rounded-full bg-muted text-[11px] font-semibold">
            <Settings2 className="w-3 h-3" /> Preferences
          </button>
          <button onClick={() => nav("/employer-dashboard")} className="inline-flex items-center gap-1 px-3 h-8 rounded-full bg-muted text-[11px] font-semibold">
            <Building2 className="w-3 h-3" /> Hiring
          </button>
          {forYou && !prefs && (
            <span className="text-[10px] text-muted-foreground">Set preferences for personalized matches</span>
          )}
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide touch-pan-x">
        {JOB_CATEGORIES.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <button key={cat.id} type="button" onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-full border text-xs font-semibold transition-colors ${
                active ? "bg-foreground text-background border-foreground" : "bg-card text-foreground border-border hover:bg-muted"
              }`}>
              <span className="text-base leading-none">{cat.emoji}</span>
              {cat.label}
            </button>
          );
        })}
      </div>

      {activeCategory === "featured" && !query && (
        <section className="px-4 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setActiveCategory("remote")}
              className="relative overflow-hidden rounded-2xl p-4 text-left bg-gradient-to-br from-emerald-400 to-cyan-500 text-white shadow-sm active:scale-[0.98] transition">
              <Sparkles className="w-5 h-5 mb-2" />
              <p className="text-sm font-bold">Find Work</p>
              <p className="text-[11px] opacity-90">Jobs, gigs & internships</p>
            </button>
            <button onClick={() => setShowChooser(true)}
              className="relative overflow-hidden rounded-2xl p-4 text-left bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm active:scale-[0.98] transition">
              <Briefcase className="w-5 h-5 mb-2" />
              <p className="text-sm font-bold">Hire Someone</p>
              <p className="text-[11px] opacity-90">Post a job or gig</p>
            </button>
          </div>
        </section>
      )}

      <section className="px-4 pb-24 space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-semibold">No opportunities yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {user ? "Be the first to post one." : "Sign in to post a job or gig."}
            </p>
          </div>
        ) : (
          displayed.map((item) => {
            const s = forYou && prefs ? scoreListing(item, prefs) : 0;
            return (
            <button key={`${item.__kind}-${item.id}`} type="button"
              onClick={() => nav(item.__kind === "job" ? `/jobs/${item.id}` : `/gigs/${item.id}`)}
              className="w-full text-left p-4 rounded-2xl bg-card border border-border hover:border-primary/40 transition-colors active:scale-[0.99]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-foreground truncate">{item.title}</p>
                    {item.__kind === "gig" && (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-600 px-1.5 py-0.5 rounded">Gig</span>
                    )}
                    {s >= 30 && (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide bg-primary/15 text-primary px-1.5 py-0.5 rounded">Match</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate capitalize">{item.category}</p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{item.location ?? "—"}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(item.created_at)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground">
                    {item.__kind === "job"
                      ? formatSalary((item as JobRow).salary_min, (item as JobRow).salary_max)
                      : ((item as GigRow).budget_min || (item as GigRow).budget_max)
                        ? `$${(item as GigRow).budget_min ?? ""}${(item as GigRow).budget_min && (item as GigRow).budget_max ? "–" : ""}${(item as GigRow).budget_max ?? ""}`
                        : "Open"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {item.__kind === "job"
                      ? EMPLOYMENT_TYPES.find((t) => t.id === (item as JobRow).employment_type)?.label
                      : (item as GigRow).urgency}
                  </p>
                </div>
              </div>
            </button>
            );
          })

        )}
      </section>

      <PostChooserSheet
        open={showChooser}
        onClose={() => setShowChooser(false)}
        onPickJob={() => { setShowChooser(false); setShowJobSheet(true); }}
        onPickGig={() => { setShowChooser(false); setShowGigSheet(true); }}
      />
      <PostJobSheet open={showJobSheet} onClose={() => setShowJobSheet(false)} onCreated={load} />
      <PostGigSheet open={showGigSheet} onClose={() => setShowGigSheet(false)} onCreated={load} />
    </div>
  );
}
