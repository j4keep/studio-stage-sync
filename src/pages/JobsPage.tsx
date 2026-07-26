import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Clock, Briefcase, Sparkles, Plus, X, User, Settings2, Building2, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { JOB_CATEGORIES, formatSalary, timeAgo, EMPLOYMENT_TYPES, scoreListing, resolveJobCover, type Prefs } from "@/lib/jobs";
import PostJobSheet from "@/components/jobs/PostJobSheet";
import { listBlockedPeerIds } from "@/lib/blocks";

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
  employer_id: string;
  media?: unknown;
  cover_image_url?: string | null;
  __kind: "job";
};

const RECENT_KEY = "yaj_jobs_recent_searches";

export default function JobsPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("featured");
  const [listings, setListings] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJobSheet, setShowJobSheet] = useState(false);
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

  const [verifiedEmployers, setVerifiedEmployers] = useState<Set<string>>(new Set());
  const [employerBrands, setEmployerBrands] = useState<Record<string, { company_name: string; logo_url: string | null }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data: jobs } = await supabase
      .from("job_listings")
      .select("id,title,category,employment_type,salary_min,salary_max,location,remote_mode,created_at,employer_id,media")
      .eq("status", "open").order("created_at", { ascending: false }).limit(50);
    const blocked = user ? await listBlockedPeerIds(user.id) : new Set<string>();
    const openJobs = (jobs ?? []).filter((j: any) => !j.employer_id || !blocked.has(j.employer_id));
    setListings(openJobs.map((j) => ({ ...j, __kind: "job" as const })) as JobRow[]);
    const employerIds = Array.from(new Set(openJobs.map((j: any) => j.employer_id).filter(Boolean)));
    if (employerIds.length) {
      const { data: emps } = await supabase.from("employer_profiles")
        .select("user_id,company_name,verified").in("user_id", employerIds);
      setVerifiedEmployers(new Set((emps ?? []).filter((e: any) => e.verified).map((e: any) => e.user_id)));
      setEmployerBrands(Object.fromEntries(
        (emps ?? []).map((e: any) => [e.user_id, { company_name: e.company_name || "", logo_url: null as string | null }]),
      ));
    } else {
      setVerifiedEmployers(new Set());
      setEmployerBrands({});
    }
    setLoading(false);
  }, [user]);

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
      items = items.filter((i) => i.remote_mode === "remote");
    } else if (activeCategory !== "featured") {
      items = items.filter((i) => i.category === activeCategory);
    }
    if (n) {
      items = items.filter((i) => {
        const brand = employerBrands[i.employer_id];
        return (
          i.title.toLowerCase().includes(n) ||
          (i.location ?? "").toLowerCase().includes(n) ||
          i.category.toLowerCase().includes(n) ||
          (brand?.company_name || "").toLowerCase().includes(n)
        );
      });
    }
    return items;
  }, [query, activeCategory, listings, employerBrands]);

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
            <h1 className="text-2xl font-black tracking-tight">Jobs</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => nav("/my-jobs")}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-muted px-2.5 text-[11px] font-bold"
              aria-label="My jobs dashboard"
              title="My Jobs"
            >
              <User className="h-3.5 w-3.5" />
              My Jobs
            </button>
            <button
              type="button"
              onClick={() => setShowJobSheet(true)}
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
            placeholder="Search jobs, skills, companies"
            className="w-full h-11 rounded-xl bg-muted border border-border pl-10 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/35"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Clear">
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        {!query && recents.length > 0 && (
          <div className="mt-2 h-scroll-isolate flex gap-2 overflow-x-auto scrollbar-hide">
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

      <div className="h-scroll-isolate flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
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
              <p className="text-[11px] opacity-90">Jobs & internships</p>
            </button>
            <button onClick={() => setShowJobSheet(true)}
              className="relative overflow-hidden rounded-2xl p-4 text-left bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm active:scale-[0.98] transition">
              <Briefcase className="w-5 h-5 mb-2" />
              <p className="text-sm font-bold">Hire Someone</p>
              <p className="text-[11px] opacity-90">Post a job listing</p>
            </button>
          </div>
        </section>
      )}

      <section className="px-4 pb-24 space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-semibold">No jobs yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {user ? "Be the first to post one." : "Sign in to post a job."}
            </p>
          </div>
        ) : (
          displayed.map((item) => {
            const s = forYou && prefs ? scoreListing(item, prefs) : 0;
            const verified = verifiedEmployers.has(item.employer_id);
            const brand = employerBrands[item.employer_id];
            const jobCover = resolveJobCover(item);
            return (
            <button key={`job-${item.id}`} type="button"
              onClick={() => nav(`/jobs/${item.id}`)}
              className="w-full text-left p-4 rounded-2xl bg-card border border-border hover:border-primary/40 transition-colors active:scale-[0.99]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-xl bg-muted border border-border overflow-hidden flex items-center justify-center shrink-0">
                    {jobCover ? (
                      <img src={jobCover} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {brand?.company_name && (
                      <div className="flex items-center gap-1 mb-0.5">
                        <p className="text-[11px] font-semibold text-muted-foreground truncate">{brand.company_name}</p>
                        {verified && (
                          <BadgeCheck className="w-3.5 h-3.5 text-sky-500 shrink-0" aria-label="Verified employer" />
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-foreground truncate">{item.title}</p>
                      {!brand?.company_name && verified && (
                        <BadgeCheck className="w-3.5 h-3.5 text-sky-500 shrink-0" aria-label="Verified employer" />
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
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground">
                    {formatSalary(item.salary_min, item.salary_max)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {EMPLOYMENT_TYPES.find((t) => t.id === item.employment_type)?.label}
                  </p>
                </div>
              </div>
            </button>
            );
          })
        )}
      </section>

      <PostJobSheet open={showJobSheet} onClose={() => setShowJobSheet(false)} onCreated={load} />
    </div>
  );
}
