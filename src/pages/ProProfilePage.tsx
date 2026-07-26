import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Home,
  MapPin,
  MessageCircle,
  Trophy,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  HOURS_OPTIONS,
  PROJECT_TYPES,
  TIMELINE_OPTIONS,
  WORK_FOCUS,
  formatHourly,
  formatResponseTime,
  getHireCategory,
} from "@/lib/hire-pro";
import { getProProfile, listProReviews, type ProProfile } from "@/lib/pro-profiles";
import UserRatingStars from "@/components/UserRatingStars";
import EditProProfileSheet from "@/components/hire/EditProProfileSheet";

export default function ProProfilePage() {
  const { userId } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [pro, setPro] = useState<ProProfile | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(params.get("edit") === "1");
  const [showAllServices, setShowAllServices] = useState(false);
  const [showAllAbout, setShowAllAbout] = useState(false);
  const [zip, setZip] = useState("");
  const [timeline, setTimeline] = useState("");
  const [hours, setHours] = useState("");
  const [projectTypes, setProjectTypes] = useState<string[]>([]);
  const [workFocus, setWorkFocus] = useState<string[]>([]);

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [p, r] = await Promise.all([getProProfile(userId), listProReviews(userId)]);
      setPro(p);
      setReviews(r);
    } catch (e: any) {
      toast.error(e?.message || "Could not load pro");
      setPro(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [userId]);

  const isOwner = Boolean(user && userId && user.id === userId);
  const name = pro?.business_name || pro?.display_name || "Pro";
  const about = pro?.about || pro?.gig_experience_bio || "";
  const price = formatHourly(pro?.hourly_rate);
  const primaryCat = pro?.categories?.[0] ? getHireCategory(pro.categories[0]) : null;

  const enabledSkills = useMemo(() => {
    if (!pro) return [] as string[];
    const fromMaps = [
      ...PROJECT_TYPES.filter((o) => pro.project_types[o.id]).map((o) => o.label),
      ...WORK_FOCUS.filter((o) => pro.work_focus[o.id]).map((o) => o.label),
    ];
    return [...new Set([...(pro.skills || []), ...fromMaps])].slice(0, 12);
  }, [pro]);

  const messagePro = () => {
    if (!user) return toast.error("Sign in to message");
    if (!pro) return;
    const details = [
      zip && `Zip: ${zip}`,
      timeline && `Timeline: ${timeline}`,
      hours && `Hours: ${hours}`,
      projectTypes.length && `Project type: ${projectTypes.join(", ")}`,
      workFocus.length && `Work focus: ${workFocus.join(", ")}`,
    ]
      .filter(Boolean)
      .join(" · ");
    nav("/messages", {
      state: {
        startWithUserId: pro.user_id,
        startWithProfile: {
          user_id: pro.user_id,
          display_name: name,
          avatar_url: pro.avatar_url,
        },
        gigTitle: details || `Hire request — ${name}`,
      },
    });
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!pro) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-semibold">Pro profile not found</p>
        {isOwner && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="h-10 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground"
          >
            Create my pro profile
          </button>
        )}
        <button type="button" onClick={() => nav("/hire")} className="text-sm text-primary">
          Back to Hire a Pro
        </button>
        <EditProProfileSheet
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            void load();
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur">
        <button type="button" onClick={() => nav(-1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        <button type="button" onClick={() => nav("/hire")} className="rounded-full border border-border px-3 py-1.5 text-[11px] font-bold">
          See more pros
        </button>
        {isOwner && (
          <button type="button" onClick={() => setEditOpen(true)} className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground">
            Edit
          </button>
        )}
      </header>

      {/* Header summary */}
      <div className="border-b border-border px-4 py-4">
        <div className="flex gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
            {pro.avatar_url ? (
              <img src={pro.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xl font-bold text-primary">
                {name[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black tracking-tight">{name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <UserRatingStars rating={pro.rating} variant="full" />
              <span className="text-xs text-muted-foreground">
                ({pro.rating.isDefault ? "New" : pro.rating.count})
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {pro.hired_count >= 5 && (
                <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" /> Top pro
                </span>
              )}
              <span>{formatResponseTime(pro.responds_minutes)}</span>
            </div>
          </div>
        </div>
        {price && <p className="mt-4 text-base font-bold">{price} Base price</p>}
      </div>

      {/* Inquiry form */}
      <div className="space-y-3 border-b border-border px-4 py-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Zip code</span>
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="e.g. 33023"
            className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Your timeline</span>
          <select value={timeline} onChange={(e) => setTimeline(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm">
            <option value="">Select answer</option>
            {TIMELINE_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Estimated hours</span>
          <select value={hours} onChange={(e) => setHours(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm">
            <option value="">Select answer</option>
            {HOURS_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
        <MultiSelect
          label="Project type"
          options={PROJECT_TYPES.map((o) => o.label)}
          value={projectTypes}
          onChange={setProjectTypes}
        />
        <MultiSelect
          label="Work focus"
          options={WORK_FOCUS.map((o) => o.label)}
          value={workFocus}
          onChange={setWorkFocus}
        />
        <button
          type="button"
          onClick={messagePro}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground"
        >
          Check availability
        </button>
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <MessageCircle className="h-3.5 w-3.5" />
          {formatResponseTime(pro.responds_minutes)}
        </p>
      </div>

      {/* Projects and media */}
      <section className="border-b border-border px-4 py-5">
        <h2 className="mb-3 text-base font-bold">Projects and media</h2>
        {pro.media.length === 0 ? (
          <div className="relative h-36 overflow-hidden rounded-2xl bg-muted">
            {primaryCat && (
              <img src={primaryCat.image} alt="" className="h-full w-full object-cover opacity-80" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-3 left-3 text-white">
              <p className="text-xs font-semibold opacity-90">Home Help</p>
              <p className="text-sm font-bold">{primaryCat?.label || "Services"}</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pro.media.map((m, i) => (
              <div key={`${m.url}-${i}`} className="relative h-36 w-52 shrink-0 overflow-hidden rounded-2xl bg-muted">
                <img src={m.url} alt="" className="h-full w-full object-cover" />
                {(m.label || m.category) && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <p className="text-[11px] font-bold text-white">{m.label || m.category}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Overview */}
      <section className="border-b border-border px-4 py-5">
        <h2 className="mb-3 text-base font-bold">Overview</h2>
        {pro.hired_count >= 5 && <p className="mb-2 text-sm font-semibold">Top pro</p>}
        <ul className="space-y-2.5 text-sm text-foreground">
          <li className="flex items-center gap-2.5">
            <Home className="h-4 w-4 text-muted-foreground" />
            {pro.similar_jobs_count || Math.max(pro.hired_count, 1)} similar jobs done near you
          </li>
          <li className="flex items-center gap-2.5">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            Hired {pro.hired_count} times
          </li>
          {pro.service_area && (
            <li className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Serves {pro.service_area}
            </li>
          )}
        </ul>
      </section>

      {/* About */}
      <section className="border-b border-border px-4 py-5">
        <h2 className="mb-2 text-base font-bold">About</h2>
        <p className={`text-sm leading-relaxed text-muted-foreground ${showAllAbout ? "" : "line-clamp-3"}`}>
          {about || "This pro hasn't added an about section yet."}
        </p>
        {about.length > 120 && (
          <button type="button" onClick={() => setShowAllAbout((v) => !v)} className="mt-2 text-sm font-semibold text-primary">
            {showAllAbout ? "Show less" : "Show more"} <ChevronDown className="inline h-4 w-4" />
          </button>
        )}
      </section>

      {/* Skills strip */}
      {enabledSkills.length > 0 && (
        <section className="border-b border-border px-4 py-5">
          <ul className="space-y-2">
            {enabledSkills.slice(0, showAllServices ? undefined : 6).map((s) => (
              <li key={s} className="flex items-center gap-2 text-sm text-muted-foreground">
                <X className="h-3.5 w-3.5" /> {s}
              </li>
            ))}
          </ul>
          {enabledSkills.length > 6 && (
            <button type="button" onClick={() => setShowAllServices((v) => !v)} className="mt-2 text-sm font-semibold text-primary">
              {showAllServices ? "Show less" : "Show more"}
            </button>
          )}
        </section>
      )}

      {/* Services with check / strike */}
      <section className="border-b border-border px-4 py-5">
        <h2 className="mb-4 text-base font-bold">Services</h2>
        <ServiceGroup title="Project type" options={PROJECT_TYPES} map={pro.project_types} />
        <div className="my-4" />
        <ServiceGroup title="Work focus" options={WORK_FOCUS} map={pro.work_focus} />
      </section>

      {/* Reviews */}
      <section className="px-4 py-5">
        <h2 className="mb-2 text-base font-bold">Reviews</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Customers rated this pro highly for <span className="font-semibold text-foreground">work quality</span>,{" "}
          <span className="font-semibold text-foreground">professionalism</span>, and{" "}
          <span className="font-semibold text-foreground">punctuality</span>.
        </p>
        <p className="text-lg font-bold">
          {pro.rating.average >= 4.8 ? "Exceptional" : "Great"} {pro.rating.average.toFixed(1)}
        </p>
        <UserRatingStars rating={pro.rating} variant="full" className="mt-1" />
        <p className="mt-1 text-sm text-muted-foreground">
          {pro.rating.isDefault ? "No reviews yet — starter 5.0 rating" : `${pro.rating.count} reviews`}
        </p>

        <div className="mt-5 space-y-4">
          {reviews.length === 0 && (
            <p className="text-sm text-muted-foreground">Reviews will show here after completed gigs.</p>
          )}
          {reviews.map((r) => (
            <div key={r.id} className="border-b border-border pb-4 last:border-0">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 overflow-hidden rounded-full bg-muted">
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-bold text-primary">
                      {(r.display_name || "?")[0]}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">{r.display_name}</p>
                  <UserRatingStars average={r.score} count={1} variant="compact" />
                </div>
              </div>
              {r.comment && <p className="mt-2 text-sm leading-relaxed text-foreground">{r.comment}</p>}
              <p className="mt-2 text-[11px] text-muted-foreground">
                {r.context_type === "gig" ? "Gig" : "YAJ"} · {new Date(r.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <button
          type="button"
          onClick={messagePro}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground"
        >
          <MessageCircle className="h-4 w-4" /> Message / Check availability
        </button>
      </div>

      <EditProProfileSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        existing={pro}
        onSaved={() => {
          setEditOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function ServiceGroup({
  title,
  options,
  map,
}: {
  title: string;
  options: { id: string; label: string }[];
  map: Record<string, boolean>;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold">{title}</h3>
      <ul className="space-y-2">
        {options.map((o) => {
          const on = map[o.id] !== false;
          return (
            <li key={o.id} className="flex items-center gap-2.5 text-sm">
              {on ? (
                <Check className="h-4 w-4 text-foreground" strokeWidth={2.5} />
              ) : (
                <X className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={on ? "text-foreground" : "text-muted-foreground line-through"}>{o.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center justify-between rounded-xl border border-border bg-muted px-3 text-left text-sm"
      >
        <span className={value.length ? "text-foreground" : "text-muted-foreground"}>
          {value.length ? value.join(", ") : "Select answer(s)"}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-lg">
          {options.map((o) => {
            const on = value.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted"
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                  {on && <Check className="h-3 w-3" />}
                </span>
                {o}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
