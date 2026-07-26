import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Clock,
  MapPin,
  MessageCircle,
  Share2,
  Sparkles,
  Star,
  Trophy,
  X as XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  PROJECT_TYPES,
  WORK_FOCUS,
  formatHourly,
  formatResponseTime,
  getLocalHelpCategory,
} from "@/lib/local-help";
import { getLocalHelpPro, listLocalHelpReviews, type LocalHelpPro } from "@/lib/pro-profiles";
import AskYajHelpSheet from "@/components/local-help/AskYajHelpSheet";
import RequestHelpSheet from "@/components/local-help/RequestHelpSheet";

type ReviewRow = {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
  display_name: string;
  avatar_url: string | null;
};

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const days = Math.floor(d / 86400000);
  if (days < 1) return "Today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function LocalHelpProPage() {
  const { userId } = useParams();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [pro, setPro] = useState<LocalHelpPro | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hireOpen, setHireOpen] = useState(params.get("hire") === "1");
  const [askOpen, setAskOpen] = useState(false);
  const [reviewSort, setReviewSort] = useState<"newest" | "highest" | "lowest">("newest");

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      setLoading(true);
      try {
        const [p, r] = await Promise.all([getLocalHelpPro(userId), listLocalHelpReviews(userId)]);
        setPro(p);
        setReviews(r as ReviewRow[]);
      } catch (e: any) {
        toast.error(e?.message || "Could not load profile");
        setPro(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  useEffect(() => {
    if (params.get("hire") === "1") setHireOpen(true);
  }, [params]);

  const sortedReviews = useMemo(() => {
    const list = [...reviews];
    if (reviewSort === "highest") list.sort((a, b) => b.score - a.score);
    else if (reviewSort === "lowest") list.sort((a, b) => a.score - b.score);
    else list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return list;
  }, [reviews, reviewSort]);

  const aiSummary = useMemo(() => {
    if (!reviews.length) return "No reviews yet — be the first neighbor to hire and rate.";
    const avg = reviews.reduce((s, r) => s + r.score, 0) / reviews.length;
    if (avg >= 4.5) return "Customers consistently praise professionalism, clear communication, and reliable work.";
    if (avg >= 3.5) return "Neighbors note solid work quality with room to grow on speed and communication.";
    return "Mixed feedback — review details carefully before hiring.";
  }, [reviews]);

  const name = pro?.business_name || pro?.display_name || "Helper";
  const price = formatHourly(pro?.hourly_rate);
  const primaryCat = pro?.categories?.[0];
  const cat = getLocalHelpCategory(primaryCat);

  const closeHire = () => {
    setHireOpen(false);
    if (params.get("hire")) {
      params.delete("hire");
      setParams(params, { replace: true });
    }
  };

  const openMessage = () => {
    if (!user || !pro) return toast.error("Sign in to message");
    nav("/messages", {
      state: {
        startWithUserId: pro.user_id,
        startWithProfile: {
          user_id: pro.user_id,
          display_name: name,
          avatar_url: pro.avatar_url,
        },
        gigTitle: `${cat?.label || "Local"} help`,
      },
    });
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!pro) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-semibold">Helper not found</p>
        <button type="button" onClick={() => nav("/local-help")} className="h-10 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground">
          Back to Find Local Help
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur">
        <button type="button" onClick={() => nav(-1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex-1 truncate text-center text-sm font-bold">{name}</h1>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(window.location.href);
            toast.success("Link copied");
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </header>

      {/* Hero */}
      <div className={`relative h-36 overflow-hidden bg-gradient-to-br ${cat?.gradient || "from-primary to-violet-500"}`}>
        {pro.banner_url ? (
          <img src={pro.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_45%)]" />
            <span className="absolute right-4 top-4 text-5xl opacity-80">{cat?.emoji || "🛠"}</span>
          </>
        )}
      </div>

      <div className="relative -mt-10 px-4">
        <div className="flex items-end gap-3">
          <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-background bg-muted shadow">
            {pro.logo_url || pro.avatar_url ? (
              <img src={pro.logo_url || pro.avatar_url || ""} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-primary">{name[0]?.toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <p className="flex items-center gap-1.5 truncate text-xl font-black">
              {name}
              {pro.verified && <BadgeCheck className="h-5 w-5 shrink-0 text-primary" />}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px]">
              <span className="inline-flex items-center gap-1 font-semibold">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {pro.rating.average.toFixed(1)}
                <span className="font-normal text-muted-foreground">
                  ({pro.rating.isDefault ? "New" : `${pro.rating.count} reviews`})
                </span>
              </span>
              {pro.hired_count >= 5 && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Trophy className="h-3 w-3 text-amber-500" /> Top helper
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={openMessage} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-sm font-bold">
            <MessageCircle className="h-4 w-4" /> Message
          </button>
          <button type="button" onClick={() => setHireOpen(true)} className="h-11 rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            Hire
          </button>
        </div>
        <button
          type="button"
          onClick={() => setAskOpen(true)}
          className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 text-xs font-bold text-primary"
        >
          <Sparkles className="h-3.5 w-3.5" /> Ask YAJ Buddy about this job
        </button>

        {/* Overview */}
        <section className="mt-6">
          <h2 className="text-base font-bold">Overview</h2>
          <ul className="mt-3 space-y-2.5 text-[13px]">
            <li className="flex items-center gap-2 text-muted-foreground">
              <Trophy className="h-4 w-4 shrink-0" />
              Hired {pro.hired_count} times
            </li>
            <li className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              {pro.similar_jobs_count || Math.max(pro.hired_count, 1)} similar jobs near you
            </li>
            <li className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              {formatResponseTime(pro.responds_minutes)}
            </li>
            {pro.service_area && (
              <li className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                Serves {pro.service_area}
              </li>
            )}
            {pro.business_hours && (
              <li className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" />
                {pro.business_hours}
              </li>
            )}
            {price && <li className="font-bold text-foreground">From {price}</li>}
            {pro.website && (
              <li>
                <a href={pro.website.startsWith("http") ? pro.website : `https://${pro.website}`} target="_blank" rel="noreferrer" className="text-primary text-[13px] font-semibold">
                  Website
                </a>
              </li>
            )}
            {pro.certifications.length > 0 && (
              <li className="text-muted-foreground">Certs: {pro.certifications.join(" · ")}</li>
            )}
            {pro.languages.length > 0 && (
              <li className="text-muted-foreground">Languages: {pro.languages.join(", ")}</li>
            )}
            {pro.insurance_note && (
              <li className="text-muted-foreground">Insurance: {pro.insurance_note}</li>
            )}
          </ul>
        </section>

        {/* About */}
        {(pro.about || pro.gig_experience_bio) && (
          <section className="mt-6">
            <h2 className="text-base font-bold">About</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {pro.about || pro.gig_experience_bio}
            </p>
          </section>
        )}

        {/* Before & after */}
        {pro.media.some((m) => m.category === "before" || m.category === "after") && (
          <section className="mt-6">
            <h2 className="text-base font-bold">Before &amp; after</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {pro.media
                .filter((m) => m.category === "before" || m.category === "after")
                .slice(0, 6)
                .map((m, i) => (
                  <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                    <img src={m.url} alt={m.label || m.category || ""} className="h-full w-full object-cover" />
                    <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                      {m.category}
                    </span>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Portfolio */}
        {pro.media.some((m) => m.category !== "before" && m.category !== "after") && (
          <section className="mt-6">
            <h2 className="text-base font-bold">Projects & media</h2>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {pro.media
                .filter((m) => m.category !== "before" && m.category !== "after")
                .map((m, i) => (
                  <div key={i} className="h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-muted">
                    <img src={m.url} alt={m.label || ""} className="h-full w-full object-cover" />
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Services */}
        <section className="mt-6">
          <h2 className="text-base font-bold">Services</h2>
          <p className="mt-3 text-xs font-semibold text-muted-foreground">Project type</p>
          <ul className="mt-2 space-y-1.5">
            {PROJECT_TYPES.map((o) => {
              const on = pro.project_types[o.id] !== false;
              return (
                <li key={o.id} className={`flex items-center gap-2 text-[13px] ${on ? "" : "text-muted-foreground line-through"}`}>
                  {on ? <Check className="h-4 w-4 text-emerald-500" /> : <XIcon className="h-4 w-4 text-muted-foreground" />}
                  {o.label}
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs font-semibold text-muted-foreground">Work focus</p>
          <ul className="mt-2 space-y-1.5">
            {WORK_FOCUS.map((o) => {
              const on = pro.work_focus[o.id] !== false;
              return (
                <li key={o.id} className={`flex items-center gap-2 text-[13px] ${on ? "" : "text-muted-foreground line-through"}`}>
                  {on ? <Check className="h-4 w-4 text-emerald-500" /> : <XIcon className="h-4 w-4 text-muted-foreground" />}
                  {o.label}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Reviews */}
        <section className="mt-6">
          <h2 className="text-base font-bold">Reviews</h2>
          <div className="mt-3 rounded-2xl border border-border bg-card p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary">YAJ Buddy summary</p>
            <p className="mt-1 text-[13px] leading-snug">{aiSummary}</p>
            <div className="mt-3 flex items-end gap-2">
              <p className="text-2xl font-black">{pro.rating.average.toFixed(1)}</p>
              <div className="flex gap-0.5 pb-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3.5 w-3.5 ${i < Math.round(pro.rating.average) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                  />
                ))}
              </div>
              <p className="pb-1 text-[11px] text-muted-foreground">
                {pro.rating.isDefault ? "New on YAJ" : `${pro.rating.count} reviews`}
              </p>
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
            {(["newest", "highest", "lowest"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setReviewSort(s)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold capitalize ${
                  reviewSort === s ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-3">
            {sortedReviews.length === 0 && (
              <p className="text-sm text-muted-foreground">No reviews yet.</p>
            )}
            {sortedReviews.map((r) => (
              <article key={r.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 overflow-hidden rounded-full bg-muted">
                    {r.avatar_url ? (
                      <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs font-bold">{r.display_name[0]}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{r.display_name}</p>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${i < r.score ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(r.created_at)}</span>
                </div>
                {r.comment && <p className="mt-2 text-[12px] leading-snug text-muted-foreground">{r.comment}</p>}
              </article>
            ))}
          </div>
        </section>
      </div>

      <RequestHelpSheet
        open={hireOpen}
        onClose={closeHire}
        pro={pro}
        categoryLabel={cat?.label}
      />

      <AskYajHelpSheet
        open={askOpen}
        onClose={() => setAskOpen(false)}
        preferredHelperId={pro.user_id}
        preferredHelperName={name}
      />
    </div>
  );
}
