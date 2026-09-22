import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  Plus,
  Search,
  Settings2,
  Sparkles,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  JOB_CATEGORIES,
  EMPLOYMENT_TYPES,
  formatSalary,
  resolveJobCover,
  scoreListing,
  timeAgo,
  type Prefs,
} from "@/lib/jobs";
import { listBlockedPeerIds } from "@/lib/blocks";
import PostJobSheet from "@/components/jobs/PostJobSheet";

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

type FeedItem = JobRow;
type OpportunityRole = "seeker" | "employer";

const RECENT_KEY = "yaj_jobs_recent_searches";
const ROLE_KEY = "yaj.jobs.role.v1";
const HERO_IMAGE =
  "https://images.pexels.com/photos/6585014/pexels-photo-6585014.jpeg?auto=compress&dpr=1&h=900&w=1400";

function matchesNearYou(location: string | null, prefs: Prefs | null): boolean {
  const loc = (location || "").trim().toLowerCase();
  if (!loc) return false;
  const preferred = (prefs?.locations || []).map((l) => l.trim().toLowerCase()).filter(Boolean);
  if (preferred.length === 0) return true;
  return preferred.some((p) => loc.includes(p) || p.includes(loc));
}

function loadSavedRole(): OpportunityRole | null {
  try {
    const saved = localStorage.getItem(ROLE_KEY);
    return saved === "seeker" || saved === "employer" ? saved : null;
  } catch {
    return null;
  }
}

export default function JobsPage() {
  const nav = useNavigate();
  const { user } = useAuth();

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("featured");
  const [listings, setListings] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [forYou, setForYou] = useState(true);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [showPostJob, setShowPostJob] = useState(false);
  const [role, setRole] = useState<OpportunityRole | null>(() => loadSavedRole());
  const [showWelcome, setShowWelcome] = useState(() => !loadSavedRole());
  const [recents, setRecents] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const [verifiedEmployers, setVerifiedEmployers] = useState<Set<string>>(new Set());
  const [employerBrands, setEmployerBrands] = useState<
    Record<string, { company_name: string; logo_url: string | null }>
  >({});

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: prefData }, { data: profile }] = await Promise.all([
        supabase.from("job_preferences").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
      ]);
      if (prefData) setPrefs(prefData as Prefs);
      if (profile?.display_name) setDisplayName(profile.display_name);
    })();
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: jobs, error } = await supabase
      .from("job_listings")
      .select(
        "id,title,category,employment_type,salary_min,salary_max,location,remote_mode,created_at,employer_id,skills,media",
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      console.warn("Could not load opportunities", error);
      setListings([]);
      setLoading(false);
      return;
    }

    const blocked = user ? await listBlockedPeerIds(user.id) : new Set<string>();
    const openJobs = ((jobs ?? []) as Omit<JobRow, "__kind">[]).filter(
      (job) => !job.employer_id || !blocked.has(job.employer_id),
    );

    setListings(openJobs.map((job) => ({ ...job, __kind: "job" as const })));

    const employerIds = Array.from(new Set(openJobs.map((job) => job.employer_id).filter(Boolean)));
    if (employerIds.length) {
      const { data: employers } = await (supabase as any).rpc("yaj_employer_public_profiles", {
        p_user_ids: employerIds,
      });
      const rows = employers ?? [];
      setVerifiedEmployers(
        new Set(rows.filter((row: any) => row.verified).map((row: any) => row.user_id)),
      );
      setEmployerBrands(
        Object.fromEntries(
          rows.map((row: any) => [
            row.user_id,
            {
              company_name: row.company_name || "",
              logo_url: row.logo_url || null,
            },
          ]),
        ),
      );
    } else {
      setVerifiedEmployers(new Set());
      setEmployerBrands({});
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const chooseRole = (next: OpportunityRole) => {
    setRole(next);
    setShowWelcome(false);
    try {
      localStorage.setItem(ROLE_KEY, next);
    } catch {
      // Ignore storage failures.
    }
  };

  const submitSearch = () => {
    const text = query.trim();
    if (!text) return;
    const next = [text, ...recents.filter((item) => item.toLowerCase() !== text.toLowerCase())].slice(0, 6);
    setRecents(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage failures.
    }
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let items = listings;

    if (activeCategory === "remote") {
      items = items.filter((item) => item.remote_mode === "remote");
    } else if (activeCategory === "near-you") {
      items = items.filter((item) => matchesNearYou(item.location, prefs));
    } else if (activeCategory !== "featured") {
      items = items.filter((item) => item.category === activeCategory);
    }

    if (needle) {
      items = items.filter((item) => {
        const brand = employerBrands[item.employer_id];
        return (
          item.title.toLowerCase().includes(needle) ||
          (item.location || "").toLowerCase().includes(needle) ||
          item.category.toLowerCase().includes(needle) ||
          (brand?.company_name || "").toLowerCase().includes(needle) ||
          (item.skills || []).some((skill) => skill.toLowerCase().includes(needle))
        );
      });
    }

    return items;
  }, [activeCategory, employerBrands, listings, prefs, query]);

  const displayed = useMemo(() => {
    if (!forYou || !prefs) return filtered;
    return [...filtered]
      .map((item) => ({ item, score: scoreListing(item, prefs) }))
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }, [filtered, forYou, prefs]);

  const roleLabel = role === "employer" ? "Employer" : "Job seeker";
  const firstName = (displayName || user?.email?.split("@")[0] || "").split(" ")[0];

  return (
    <div className="min-h-screen bg-[#f6f8fc] pb-24 text-slate-950 dark:bg-background dark:text-foreground">
      <section className="border-b border-slate-200/80 bg-white dark:border-border dark:bg-background">
        <div className="mx-auto max-w-3xl px-4 pb-5 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">
                YAJ Opportunities
              </p>
              <h1 className="mt-1 text-[28px] font-black leading-tight tracking-[-0.035em]">
                {role === "employer" ? "Hire with confidence" : firstName ? `Welcome, ${firstName}` : "Find your next opportunity"}
              </h1>
              <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-slate-500 dark:text-muted-foreground">
                {role === "employer"
                  ? "Post roles, manage applicants and move great candidates through your hiring pipeline."
                  : "Search smarter, build your résumé and keep every application in one place."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowWelcome(true)}
              className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-700 dark:border-border dark:bg-muted dark:text-foreground"
            >
              {roleLabel}
            </button>
          </div>

          {role !== "employer" ? (
            <>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitSearch();
                }}
                className="relative mt-5"
              >
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Job title, skill, company or location"
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-12 text-[15px] font-medium shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-border dark:bg-card"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-muted"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </form>

              {!query && recents.length > 0 && (
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {recents.map((recent) => (
                    <button
                      key={recent}
                      type="button"
                      onClick={() => setQuery(recent)}
                      className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 dark:border-border dark:bg-card dark:text-muted-foreground"
                    >
                      {recent}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowPostJob(true)}
                className="rounded-2xl bg-blue-600 p-4 text-left text-white shadow-sm active:scale-[0.99]"
              >
                <Plus className="h-5 w-5" />
                <p className="mt-4 text-[15px] font-extrabold">Post a job</p>
                <p className="mt-1 text-[11px] leading-snug text-blue-100">Create a new opportunity</p>
              </button>
              <button
                type="button"
                onClick={() => nav("/employer-dashboard")}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm active:scale-[0.99] dark:border-border dark:bg-card"
              >
                <UsersRound className="h-5 w-5 text-blue-600" />
                <p className="mt-4 text-[15px] font-extrabold">Applicants</p>
                <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-muted-foreground">Review your hiring pipeline</p>
              </button>
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 py-5">
        {role === "employer" ? (
          <EmployerHome
            onPost={() => setShowPostJob(true)}
            onDashboard={() => nav("/employer-dashboard")}
            onCompany={() => nav("/employer-dashboard")}
          />
        ) : (
          <>
            <section className="rounded-[24px] bg-[#eaf2ff] p-4 dark:bg-blue-950/25">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[16px] font-extrabold">Strengthen your job search</p>
                  <p className="mt-1 text-[12px] text-slate-600 dark:text-blue-100/70">
                    Complete the basics once, then apply faster.
                  </p>
                </div>
                <Sparkles className="h-5 w-5 shrink-0 text-blue-600" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => nav("/resume-builder")}
                  className="rounded-2xl bg-white p-3.5 text-left shadow-sm dark:bg-card"
                >
                  <FileText className="h-4 w-4 text-blue-600" />
                  <p className="mt-3 text-[13px] font-extrabold">Build your résumé</p>
                  <p className="mt-1 text-[10px] leading-snug text-slate-500 dark:text-muted-foreground">
                    Create or update your YAJ résumé
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => nav("/job-preferences")}
                  className="rounded-2xl bg-white p-3.5 text-left shadow-sm dark:bg-card"
                >
                  <Settings2 className="h-4 w-4 text-blue-600" />
                  <p className="mt-3 text-[13px] font-extrabold">Set preferences</p>
                  <p className="mt-1 text-[10px] leading-snug text-slate-500 dark:text-muted-foreground">
                    Improve your recommendations
                  </p>
                </button>
              </div>
            </section>

            <section className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-extrabold tracking-tight">Search by category</h2>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-muted-foreground">
                    Narrow the feed to what fits you.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForYou((value) => !value)}
                  className={`rounded-full px-3 py-2 text-[11px] font-bold transition ${
                    forYou
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 bg-white text-slate-700 dark:border-border dark:bg-card dark:text-foreground"
                  }`}
                >
                  For You {forYou ? "✓" : ""}
                </button>
              </div>

              <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {JOB_CATEGORIES.map((category) => {
                  const active = activeCategory === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setActiveCategory(category.id)}
                      className={`shrink-0 rounded-full border px-3.5 py-2 text-[12px] font-bold transition ${
                        active
                          ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                          : "border-slate-200 bg-white text-slate-700 dark:border-border dark:bg-card dark:text-foreground"
                      }`}
                    >
                      <span className="mr-1.5">{category.emoji}</span>
                      {category.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-[20px] font-black tracking-tight">
                    {query ? "Search results" : forYou ? "Matches for you" : "Latest opportunities"}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-muted-foreground">
                    {loading ? "Finding opportunities…" : `${displayed.length} open ${displayed.length === 1 ? "role" : "roles"}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => nav("/my-jobs")}
                  className="inline-flex items-center gap-1 text-[12px] font-extrabold text-blue-600"
                >
                  My Jobs <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {loading ? (
                <div className="rounded-3xl border border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-500 dark:border-border dark:bg-card dark:text-muted-foreground">
                  Loading opportunities…
                </div>
              ) : displayed.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center dark:border-border dark:bg-card">
                  <BriefcaseBusiness className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-3 text-sm font-bold">No jobs matched this search.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setActiveCategory("featured");
                    }}
                    className="mt-3 text-xs font-bold text-blue-600"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayed.map((item) => {
                    const brand = employerBrands[item.employer_id];
                    const verified = verifiedEmployers.has(item.employer_id);
                    const jobCover = resolveJobCover(item);
                    const employment = EMPLOYMENT_TYPES.find((type) => type.id === item.employment_type)?.label;
                    const score = forYou && prefs ? scoreListing(item, prefs) : 0;
                    const ageMs = Date.now() - new Date(item.created_at).getTime();
                    const isNew = ageMs >= 0 && ageMs < 1000 * 60 * 60 * 24 * 7;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => nav(`/jobs/${item.id}`)}
                        className="w-full rounded-[22px] border border-slate-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-blue-300 hover:shadow-md active:scale-[0.995] dark:border-border dark:bg-card"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-border dark:bg-muted">
                            {jobCover ? (
                              <img src={jobCover} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Building2 className="h-5 w-5 text-slate-400" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-extrabold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                Easily apply
                              </span>
                              {isNew && (
                                <span className="rounded-md bg-pink-50 px-2 py-1 text-[10px] font-extrabold text-pink-700 dark:bg-pink-950/30 dark:text-pink-300">
                                  New
                                </span>
                              )}
                              {score >= 30 && (
                                <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                  Great match
                                </span>
                              )}
                            </div>

                            <p className="mt-2 text-[17px] font-black leading-snug tracking-[-0.02em]">
                              {item.title}
                            </p>
                            <div className="mt-1 flex items-center gap-1 text-[12px] font-medium text-slate-600 dark:text-muted-foreground">
                              <span className="truncate">{brand?.company_name || "Employer"}</span>
                              {verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-blue-500" />}
                            </div>
                            <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-slate-500 dark:text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                              {item.location || (item.remote_mode === "remote" ? "Remote" : "Location not listed")}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[12px] font-extrabold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                            ✓ {formatSalary(item.salary_min, item.salary_max)}
                          </span>
                          {employment && (
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[12px] font-bold text-slate-700 dark:bg-muted dark:text-foreground">
                              {employment}
                            </span>
                          )}
                          {item.remote_mode && (
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[12px] font-bold capitalize text-slate-700 dark:bg-muted dark:text-foreground">
                              {item.remote_mode.replace("_", " ")}
                            </span>
                          )}
                        </div>

                        {(item.skills || []).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(item.skills || []).slice(0, 3).map((skill) => (
                              <span key={skill} className="text-[11px] font-semibold text-slate-500 dark:text-muted-foreground">
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}

                        <p className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          Posted {timeAgo(item.created_at)} ago
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <PostJobSheet
        open={showPostJob}
        onClose={() => setShowPostJob(false)}
        onCreated={() => {
          setShowPostJob(false);
          void load();
        }}
      />

      {showWelcome && (
        <OpportunityWelcome
          selectedRole={role}
          onChoose={chooseRole}
          onClose={role ? () => setShowWelcome(false) : undefined}
        />
      )}
    </div>
  );
}

function EmployerHome({
  onPost,
  onDashboard,
  onCompany,
}: {
  onPost: () => void;
  onDashboard: () => void;
  onCompany: () => void;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-border dark:bg-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[18px] font-black tracking-tight">Your hiring workspace</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-muted-foreground">
              Publish jobs, review candidates, schedule interviews and manage your company presence.
            </p>
          </div>
          <Building2 className="h-6 w-6 shrink-0 text-blue-600" />
        </div>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={onDashboard}
            className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3.5 text-left dark:bg-muted"
          >
            <UsersRound className="h-5 w-5 text-blue-600" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-extrabold">Manage applicants</p>
              <p className="text-[10px] text-slate-500 dark:text-muted-foreground">Review applications and interview candidates</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>
          <button
            type="button"
            onClick={onCompany}
            className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3.5 text-left dark:bg-muted"
          >
            <BadgeCheck className="h-5 w-5 text-blue-600" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-extrabold">Company profile & verification</p>
              <p className="text-[10px] text-slate-500 dark:text-muted-foreground">Build trust with candidates</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] bg-slate-950 text-white">
        <div className="grid grid-cols-[1.1fr_0.9fr]">
          <div className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-300">Ready to hire?</p>
            <h2 className="mt-2 text-[21px] font-black leading-tight">Reach candidates directly on YAJ.</h2>
            <button
              type="button"
              onClick={onPost}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-blue-600 px-4 text-[12px] font-extrabold text-white"
            >
              <Plus className="h-4 w-4" /> Post a Job
            </button>
          </div>
          <img src={HERO_IMAGE} alt="Professional job interview" className="h-full min-h-[190px] w-full object-cover object-center opacity-85" />
        </div>
      </section>
    </div>
  );
}

function OpportunityWelcome({
  selectedRole,
  onChoose,
  onClose,
}: {
  selectedRole: OpportunityRole | null;
  onChoose: (role: OpportunityRole) => void;
  onClose?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/55 backdrop-blur-sm sm:items-center">
      <div className="max-h-[94dvh] w-full overflow-y-auto rounded-t-[30px] bg-white shadow-2xl sm:max-w-lg sm:rounded-[30px] dark:bg-card">
        <div className="relative h-56 overflow-hidden sm:h-64">
          <img src={HERO_IMAGE} alt="Professionals in a job interview" className="h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.17em] text-blue-200">YAJ Opportunities</p>
            <h2 className="mt-1 text-[26px] font-black leading-tight tracking-[-0.03em]">Build what comes next.</h2>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <p className="text-[17px] font-black">How are you using Opportunities?</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-muted-foreground">
            Choose a starting view. You can switch between job seeker and employer anytime.
          </p>

          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={() => onChoose("seeker")}
              className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                selectedRole === "seeker"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                  : "border-slate-200 bg-white dark:border-border dark:bg-card"
              }`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <UserRound className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-black">I’m looking for work</p>
                <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-muted-foreground">
                  Find jobs, build a résumé, save roles and track applications.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => onChoose("employer")}
              className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                selectedRole === "employer"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                  : "border-slate-200 bg-white dark:border-border dark:bg-card"
              }`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                <BriefcaseBusiness className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-black">I’m hiring</p>
                <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-muted-foreground">
                  Post jobs, manage candidates, schedule interviews and build your employer profile.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          <p className="mt-4 text-center text-[10px] leading-relaxed text-slate-400">
            Your choice only changes your Opportunities starting view. It does not limit what you can do on YAJ.
          </p>
        </div>
      </div>
    </div>
  );
}
