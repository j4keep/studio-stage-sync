import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  MapPin,
  Clock,
  Briefcase,
  Sparkles,
  Plus,
  X,
  User,
  Settings2,
  Building2,
  BadgeCheck,
  Wrench,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  JOB_CATEGORIES,
  formatSalary,
  timeAgo,
  EMPLOYMENT_TYPES,
  scoreListing,
  resolveJobCover,
  type Prefs,
} from "@/lib/jobs";
import { formatGigBudget } from "@/lib/gigs";
import { listBlockedPeerIds } from "@/lib/blocks";
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
  employer_id: string;
  skills?: string[] | null;
  media?: unknown;
  cover_image_url?: string | null;
  __kind: "job";
};

type GigRow = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  location: string | null;
  budget_min: number | null;
  budget_max: number | null;
  urgency: string;
  created_at: string;
  poster_id: string;
  media?: unknown;
  __kind: "gig";
};

type FeedItem = JobRow | GigRow;
type FeedKind = "all" | "jobs" | "gigs";
type HireMode = null | "choose";

const RECENT_KEY = "yaj_jobs_recent_searches";

function gigCover(media: unknown): string | null {
  if (!Array.isArray(media)) return null;
  for (const item of media) {
    if (typeof item === "string" && item) return item;
    if (item && typeof item === "object" && typeof (item as { url?: string }).url === "string") {
      return (item as { url: string }).url;
    }
  }
  return null;
}

function matchesNearYou(location: string | null, prefs: Prefs | null): boolean {
  const loc = (location || "").trim().toLowerCase();
  if (!loc) return false;
  const preferred = (prefs?.locations || []).map((l) => l.trim().toLowerCase()).filter(Boolean);
  if (preferred.length === 0) return true; // any located listing when no prefs set
  return preferred.some((p) => loc.includes(p) || p.includes(loc));
}

export default function JobsPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("featured");
  const [feedKind, setFeedKind] = useState<FeedKind>("all");
  const [listings, setListings] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJobSheet, setShowJobSheet] = useState(false);
  const [showGigSheet, setShowGigSheet] = useState(false);
  const [hireMode, setHireMode] = useState<HireMode>(null);
  const [forYou, setForYou] = useState(false);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [recents, setRecents] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    } catch {
      return [];
    }
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
    const [{ data: jobs }, { data: gigs }] = await Promise.all([
      supabase
        .from("job_listings")
        .select(
          "id,title,category,employment_type,salary_min,salary_max,location,remote_mode,created_at,employer_id,skills,media",
        )
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50),
      (supabase as any)
        .from("gig_listings")
        .select("id,title,description,category,location,budget_min,budget_max,urgency,created_at,poster_id,media")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const blocked = user ? await listBlockedPeerIds(user.id) : new Set<string>();
    const openJobs = ((jobs ?? []) as Omit<JobRow, "__kind">[]).filter(
      (j) => !j.employer_id || !blocked.has(j.employer_id),
    );
    const openGigs = ((gigs ?? []) as Omit<GigRow, "__kind">[]).filter(
      (g) => !g.poster_id || !blocked.has(g.poster_id),
    );

    const merged: FeedItem[] = [
      ...openJobs.map((j) => ({ ...j, __kind: "job" as const })),
      ...openGigs.map((g) => ({ ...g, __kind: "gig" as const })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setListings(merged);

    const employerIds = Array.from(new Set(openJobs.map((j) => j.employer_id).filter(Boolean)));
    if (employerIds.length) {
      const { data: emps } = await supabase
        .from("employer_profiles")
        .select("user_id,company_name,verified")
        .in("user_id", employerIds);
      setVerifiedEmployers(new Set((emps ?? []).filter((e: any) => e.verified).map((e: any) => e.user_id)));
      setEmployerBrands(
        Object.fromEntries(
          (emps ?? []).map((e: any) => [e.user_id, { company_name: e.company_name || "", logo_url: null as string | null }]),
        ),
      );
    } else {
      setVerifiedEmployers(new Set());
      setEmployerBrands({});
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const submitSearch = () => {
    const q = query.trim();
    if (!q) return;
    const next = [q, ...recents.filter((r) => r !== q)].slice(0, 6);
    setRecents(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
  };

  const findWork = () => {
    setFeedKind("all");
    setActiveCategory("featured");
    setQuery("");
    setForYou(false);
    setHireMode(null);
  };

  const filtered = useMemo(() => {
    const n = query.trim().toLowerCase();
    let items = listings;

    if (feedKind === "jobs") items = items.filter((i) => i.__kind === "job");
    if (feedKind === "gigs") items = items.filter((i) => i.__kind === "gig");

    if (activeCategory === "remote") {
      items = items.filter((i) => i.__kind === "job" && i.remote_mode === "remote");
    } else if (activeCategory === "near-you") {
      items = items.filter((i) => matchesNearYou(i.location, prefs));
    } else if (activeCategory !== "featured") {
      items = items.filter((i) => {
        if (i.__kind === "job") return i.category === activeCategory;
        // Gigs use local-help categories; keep them only on Featured / Near You / All-gigs feed
        return false;
      });
    }

    if (n) {
      items = items.filter((i) => {
        if (i.__kind === "gig") {
          return (
            i.title.toLowerCase().includes(n) ||
            (i.description || "").toLowerCase().includes(n) ||
            (i.location ?? "").toLowerCase().includes(n) ||
            i.category.toLowerCase().includes(n)
          );
        }
        const brand = employerBrands[i.employer_id];
        const skillsHit = (i.skills || []).some((s) => s.toLowerCase().includes(n));
        return (
          i.title.toLowerCase().includes(n) ||
          (i.location ?? "").toLowerCase().includes(n) ||
          i.category.toLowerCase().includes(n) ||
          (brand?.company_name || "").toLowerCase().includes(n) ||
          skillsHit
        );
      });
    }
    return items;
  }, [query, activeCategory, listings, employerBrands, feedKind, prefs]);

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
          <button
            type="button"
            onClick={() => nav("/my-jobs")}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-muted px-3 text-[11px] font-bold"
            aria-label="My applications"
          >
            <User className="h-3.5 w-3.5" />
            My Jobs
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch();
          }}
          className="relative mt-3"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search jobs, skills, companies, gigs"
            className="w-full h-11 rounded-xl bg-muted border border-border pl-10 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/35"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label="Clear"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        {!query && recents.length > 0 && (
          <div className="mt-2 h-scroll-isolate flex gap-2 overflow-x-auto scrollbar-hide">
            {recents.map((r) => (
              <button
                key={r}
                onClick={() => setQuery(r)}
                className="shrink-0 px-2.5 h-7 rounded-full bg-muted border border-border text-[11px] text-muted-foreground"
              >
                {r}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setForYou((v) => !v)}
            className={`inline-flex items-center gap-1 px-3 h-8 rounded-full text-[11px] font-bold ${
              forYou ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
            }`}
          >
            <Sparkles className="w-3 h-3" /> {forYou ? "For You ✓" : "For You"}
          </button>
          <button
            onClick={() => nav("/job-preferences")}
            className="inline-flex items-center gap-1 px-3 h-8 rounded-full bg-muted text-[11px] font-semibold"
          >
            <Settings2 className="w-3 h-3" /> Preferences
          </button>
          {forYou && !prefs && (
            <span className="text-[10px] text-muted-foreground">Set preferences for personalized matches</span>
          )}
        </div>
      </header>

      <div className="px-4 pb-2 flex gap-2">
        {(
          [
            { id: "all", label: "All" },
            { id: "jobs", label: "Jobs" },
            { id: "gigs", label: "Gigs" },
          ] as const
        ).map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setFeedKind(k.id)}
            className={`h-8 px-3 rounded-full text-[11px] font-bold border transition-colors ${
              feedKind === k.id
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-foreground border-border"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="h-scroll-isolate flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
        {JOB_CATEGORIES.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-full border text-xs font-semibold transition-colors ${
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              <span className="text-base leading-none">{cat.emoji}</span>
              {cat.label}
            </button>
          );
        })}
      </div>



      <section className="px-4 pb-24 space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-semibold">No listings yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Check back soon for new opportunities.</p>
          </div>
        ) : (
          displayed.map((item) => {
            if (item.__kind === "gig") {
              const cover = gigCover(item.media);
              return (
                <button
                  key={`gig-${item.id}`}
                  type="button"
                  onClick={() => nav(`/gigs/${item.id}`)}
                  className="w-full rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 active:scale-[0.99]"
                >
                  <span className="inline-block rounded-md bg-amber-500/15 px-2 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    Local gig
                  </span>
                  <div className="mt-2 flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
                      {cover ? (
                        <img src={cover} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Wrench className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[17px] font-bold leading-snug text-foreground">{item.title}</p>
                      <p className="mt-0.5 text-[13px] capitalize text-muted-foreground">{item.category}</p>
                      <p className="text-[13px] text-muted-foreground">{item.location ?? "—"}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-[13px] font-bold text-emerald-700 dark:text-emerald-400">
                      {formatGigBudget(item.budget_min, item.budget_max)}
                    </span>
                    <span className="rounded-md bg-muted px-2.5 py-1.5 text-[13px] font-semibold capitalize">
                      {item.urgency?.replace(/_/g, " ") || "Flexible"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {timeAgo(item.created_at)} ago
                    </span>
                  </div>
                </button>
              );
            }

            const s = forYou && prefs ? scoreListing(item, prefs) : 0;
            const verified = verifiedEmployers.has(item.employer_id);
            const brand = employerBrands[item.employer_id];
            const jobCover = resolveJobCover(item);
            const typeLabel = EMPLOYMENT_TYPES.find((t) => t.id === item.employment_type)?.label;
            return (
              <button
                key={`job-${item.id}`}
                type="button"
                onClick={() => nav(`/jobs/${item.id}`)}
                className="w-full rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 active:scale-[0.99]"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary">
                    Easily apply
                  </span>
                  {s >= 30 && (
                    <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                      Great match
                    </span>
                  )}
                </div>

                <div className="mt-2.5 flex items-start gap-3">
                  {jobCover && (
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                      <img src={jobCover} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[17px] font-bold leading-snug tracking-tight text-foreground">{item.title}</p>
                    <div className="mt-1 flex items-center gap-1">
                      <p className="truncate text-[13px] text-muted-foreground">
                        {brand?.company_name || "Employer"}
                      </p>
                      {verified && (
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-500" aria-label="Verified employer" />
                      )}
                    </div>
                    <p className="inline-flex items-center gap-1 text-[13px] text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {item.location ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-[13px] font-bold text-emerald-700 dark:text-emerald-400">
                    ✓ {formatSalary(item.salary_min, item.salary_max)}
                  </span>
                  {typeLabel && (
                    <span className="rounded-md bg-muted px-2.5 py-1.5 text-[13px] font-semibold">{typeLabel}</span>
                  )}
                  {item.remote_mode && (
                    <span className="rounded-md bg-muted px-2.5 py-1.5 text-[13px] font-semibold capitalize">
                      {item.remote_mode}
                    </span>
                  )}
                </div>

                {(item.skills || []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(item.skills || []).slice(0, 3).map((sk) => (
                      <span key={sk} className="rounded-md bg-muted px-2.5 py-1.5 text-[13px] font-semibold">
                        {sk}
                      </span>
                    ))}
                  </div>
                )}

                <p className="mt-2.5 inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Posted {timeAgo(item.created_at)} ago
                </p>
              </button>
            );
          })
        )}
      </section>
    </div>
  );
}

