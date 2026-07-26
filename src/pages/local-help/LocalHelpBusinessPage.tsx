import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Eye,
  ImagePlus,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  LOCAL_HELP_CATEGORIES,
  PROJECT_TYPES,
  WORK_FOCUS,
  defaultServiceMap,
} from "@/lib/local-help";
import UserRatingStars from "@/components/UserRatingStars";
import UserReviewsSection from "@/components/UserReviewsSection";
import { fetchUserDisplayRating, resolveDisplayRating, type DisplayRating } from "@/lib/ratings";
import {
  getLocalHelpPro,
  upsertLocalHelpPro,
  type ProMedia,
} from "@/lib/pro-profiles";

/**
 * Full business account page for Local Help helpers
 * (handyman, cleaner, DJ, photographer, etc.) — not a tiny sheet.
 */
export default function LocalHelpBusinessPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const portfolioRef = useRef<HTMLInputElement>(null);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exists, setExists] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [about, setAbout] = useState("");
  const [hourly, setHourly] = useState("");
  const [area, setArea] = useState("");
  const [website, setWebsite] = useState("");
  const [hours, setHours] = useState("Mon–Fri 9am–6pm");
  const [certs, setCerts] = useState("");
  const [languages, setLanguages] = useState("English");
  const [insurance, setInsurance] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [media, setMedia] = useState<ProMedia[]>([]);
  const [categories, setCategories] = useState<string[]>(["handyman"]);
  const [projectTypes, setProjectTypes] = useState(defaultServiceMap(PROJECT_TYPES, true));
  const [workFocus, setWorkFocus] = useState(defaultServiceMap(WORK_FOCUS, true));
  const [isActive, setIsActive] = useState(true);
  const [hiredCount, setHiredCount] = useState(0);
  const [verified, setVerified] = useState(false);
  const [rating, setRating] = useState<DisplayRating>(() => resolveDisplayRating(null, 0));

  useEffect(() => {
    if (!user) return;
    void (async () => setRating(await fetchUserDisplayRating(user.id)))();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      try {
        const existing = await getLocalHelpPro(user.id);
        if (existing) {
          setExists(true);
          setBusinessName(existing.business_name || existing.display_name || "");
          setAbout(existing.about || "");
          setHourly(existing.hourly_rate != null ? String(existing.hourly_rate) : "");
          setArea(existing.service_area || "");
          setWebsite(existing.website || "");
          setHours(existing.business_hours || "Mon–Fri 9am–6pm");
          setCerts((existing.certifications || []).join(", "));
          setLanguages((existing.languages || []).join(", ") || "English");
          setInsurance(existing.insurance_note || "");
          setLogoUrl(existing.logo_url || existing.avatar_url);
          setBannerUrl(existing.banner_url);
          setMedia(existing.media || []);
          setCategories(existing.categories?.length ? existing.categories : ["handyman"]);
          setProjectTypes(existing.project_types);
          setWorkFocus(existing.work_focus);
          setIsActive(existing.is_active);
          setHiredCount(existing.hired_count);
          setVerified(existing.verified);
        }
      } catch {
        /* new business */
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const uploadFile = async (file: File, kind: "logo" | "banner" | "portfolio") => {
    if (!user) return null;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `local-help/${user.id}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
      return pub.publicUrl as string;
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    const url = await uploadFile(file, "logo");
    if (url) setLogoUrl(url);
  };

  const onBanner = async (file: File | undefined) => {
    if (!file) return;
    const url = await uploadFile(file, "banner");
    if (url) setBannerUrl(url);
  };

  const MAX_BEFORE_AFTER = 6;
  const beforeAfter = media.filter((m) => m.category === "before" || m.category === "after");

  const onPortfolio = async (file: File | undefined) => {
    if (!file) return;
    const url = await uploadFile(file, "portfolio");
    if (url) setMedia((m) => [...m, { url, label: "Project", category: "portfolio" }]);
  };

  const onBeforeAfter = async (file: File | undefined, category: "before" | "after") => {
    if (!file) return;
    if (beforeAfter.length >= MAX_BEFORE_AFTER) {
      toast.error(`Keep it neat — up to ${MAX_BEFORE_AFTER} before/after photos`);
      return;
    }
    const url = await uploadFile(file, "portfolio");
    if (url) setMedia((m) => [...m, { url, label: category === "before" ? "Before" : "After", category }]);
  };

  const toggleCat = (id: string) => {
    setCategories((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) {
          toast.error("Keep at least one service");
          return prev;
        }
        return prev.filter((c) => c !== id);
      }
      return [...prev, id];
    });
  };

  const save = async (goLive?: boolean) => {
    if (!user) return toast.error("Sign in first");
    if (!businessName.trim()) return toast.error("Add a business or display name");
    if (!categories.length) return toast.error("Pick what you do (e.g. Handyman)");

    setSaving(true);
    try {
      const active = goLive === undefined ? isActive : goLive;
      await upsertLocalHelpPro(user.id, {
        business_name: businessName.trim(),
        about: about.trim() || null,
        hourly_rate: hourly ? Number(hourly) : null,
        service_area: area.trim() || null,
        website: website.trim() || null,
        business_hours: hours.trim() || null,
        certifications: certs
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        languages: languages
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        insurance_note: insurance.trim() || null,
        logo_url: logoUrl,
        banner_url: bannerUrl,
        categories,
        project_types: projectTypes,
        work_focus: workFocus,
        media,
        skills: categories.map((id) => LOCAL_HELP_CATEGORIES.find((c) => c.id === id)?.label || id),
        responds_minutes: 45,
        is_active: active,
      });
      setExists(true);
      setIsActive(active);
      toast.success(active ? "Your Local Help business is live" : "Business saved (hidden from search)");
    } catch (e: any) {
      toast.error(e?.message || "Could not save business");
    } finally {
      setSaving(false);
    }
  };

  const requestVerification = async () => {
    if (!user) return;
    if (!businessName.trim()) return toast.error("Save your business name first");
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user.id,
      subject: `🛠 Local Help verification — ${businessName}`,
      message: `Please verify Local Help business.\nName: ${businessName}\nCategories: ${categories.join(", ")}\nArea: ${area || "—"}\nWebsite: ${website || "—"}`,
      status: "open",
    });
    if (error) return toast.error(error.message);
    toast.success("Verification requested — we'll review shortly");
  };

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-semibold">Sign in to create your Local Help business</p>
        <button type="button" onClick={() => nav("/auth")} className="h-10 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground">
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => nav("/local-help")} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Local Help</p>
            <h1 className="truncate text-sm font-black">My Business</h1>
          </div>
          {exists && (
            <button
              type="button"
              onClick={() => nav(`/local-help/pro/${user.id}`)}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-[11px] font-bold"
            >
              <Eye className="h-3.5 w-3.5" /> Preview
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-6">
          {/* Intro */}
          <section className="rounded-2xl bg-gradient-to-br from-teal-500 via-emerald-500 to-cyan-600 p-4 text-white">
            <div className="inline-flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-bold">
              <Building2 className="h-3 w-3" /> Business account
            </div>
            <h2 className="mt-2 text-xl font-black leading-tight">
              {exists ? businessName || "Manage your Local Help business" : "Become a helper on YAJ"}
            </h2>
            <div className="mt-1 flex items-center gap-2 rounded-full bg-black/20 px-2 py-1 w-fit">
              <UserRatingStars rating={rating} variant="full" className="[&_span]:text-white" />
              <span className="text-[10px] font-semibold text-white/85">
                {rating.isDefault ? "New — starter rating" : `${rating.count} review${rating.count === 1 ? "" : "s"}`}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-white/90">
              Handyman, cleaner, DJ, photographer, student side hustle — list what you do and get hired nearby.
            </p>
            {exists && (
              <p className="mt-2 text-[11px] font-semibold text-white/85">
                Hired {hiredCount} times · {isActive ? "Live in search" : "Hidden from search"}
                {verified ? " · Verified" : ""}
              </p>
            )}
          </section>

          {/* What you do */}
          <section>
            <h3 className="text-sm font-bold">What do you offer?</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Pick one or more — e.g. Handyman</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {LOCAL_HELP_CATEGORIES.map((c) => {
                const on = categories.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCat(c.id)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[12px] font-bold transition ${
                      on ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    <span className="text-xl">{c.emoji}</span>
                    <span className="leading-tight">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Branding */}
          <section>
            <h3 className="text-sm font-bold">Business look</h3>
            <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onBanner(e.target.files?.[0])} />
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onLogo(e.target.files?.[0])} />
            <button
              type="button"
              onClick={() => bannerRef.current?.click()}
              className="relative mt-3 flex h-28 w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted"
            >
              {bannerUrl ? (
                <>
                  <img src={bannerUrl} alt="" data-no-zoom className="absolute inset-0 h-full w-full object-cover" />
                  <span className="absolute bottom-2 right-2 rounded-full bg-background/85 px-2 py-1 text-[10px] font-bold">
                    {uploading ? "Uploading…" : "Change background"}
                  </span>
                </>
              ) : (
                <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <ImagePlus className="h-4 w-4" /> {uploading ? "Uploading…" : "Add background image"}
                </span>
              )}

            </button>
            <div className="relative -mt-8 ml-3 flex items-end gap-3">
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-muted shadow"
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
              <p className="pb-1 text-[11px] text-muted-foreground">{uploading ? "Uploading…" : "Logo / photo"}</p>
            </div>
          </section>

          {/* Identity */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold">Business details</h3>
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">Business / display name *</span>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Roman Handyman Services"
                className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">About</span>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                rows={4}
                placeholder="Tell neighbors what you're great at…"
                className="mt-1 w-full rounded-xl border border-border bg-muted p-3 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] font-bold text-muted-foreground">Hourly rate ($)</span>
                <input
                  value={hourly}
                  onChange={(e) => setHourly(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="60"
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold text-muted-foreground">Service area</span>
                <input
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="City / zip"
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">Business hours</span>
              <input
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="Mon–Fri 9am–6pm"
                className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">Website</span>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://"
                className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">Certifications (comma-separated)</span>
              <input
                value={certs}
                onChange={(e) => setCerts(e.target.value)}
                placeholder="Licensed electrician, Insured"
                className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">Languages</span>
              <input
                value={languages}
                onChange={(e) => setLanguages(e.target.value)}
                placeholder="English, Spanish"
                className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">Insurance (optional)</span>
              <input
                value={insurance}
                onChange={(e) => setInsurance(e.target.value)}
                placeholder="Fully insured for residential work"
                className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
              />
            </label>
          </section>

          {/* Services checklist */}
          <section>
            <h3 className="text-sm font-bold">Services you offer</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Customers see ✓ offered / ✕ not offered</p>
            <p className="mt-3 text-[11px] font-bold text-muted-foreground">Project type</p>
            <div className="mt-2 space-y-1.5">
              {PROJECT_TYPES.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={projectTypes[o.id] !== false}
                    onChange={(e) => setProjectTypes((p) => ({ ...p, [o.id]: e.target.checked }))}
                  />
                  {o.label}
                </label>
              ))}
            </div>
            <p className="mt-4 text-[11px] font-bold text-muted-foreground">Work focus</p>
            <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
              {WORK_FOCUS.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={workFocus[o.id] !== false}
                    onChange={(e) => setWorkFocus((p) => ({ ...p, [o.id]: e.target.checked }))}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </section>

          {/* Portfolio */}
          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Portfolio</h3>
              <button
                type="button"
                onClick={() => portfolioRef.current?.click()}
                className="rounded-full bg-muted px-3 py-1.5 text-[11px] font-bold"
              >
                Add photo
              </button>
              <input ref={portfolioRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPortfolio(e.target.files?.[0])} />
            </div>
            {media.filter((m) => m.category !== "before" && m.category !== "after").length === 0 ? (
              <p className="mt-2 text-[12px] text-muted-foreground">Show project photos of your work.</p>
            ) : (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {media.map((m, i) =>
                  m.category === "before" || m.category === "after" ? null : (
                    <div key={i} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                      <img src={m.url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setMedia((list) => list.filter((_, idx) => idx !== i))}
                        className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-[10px] font-bold text-white"
                      >
                        ✕
                      </button>
                    </div>
                  ),
                )}
              </div>
            )}
          </section>

          {/* Before & after */}
          <section>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Before &amp; after</h3>
                <p className="text-[11px] text-muted-foreground">
                  Up to {MAX_BEFORE_AFTER} photos so neighbors can see your results ({beforeAfter.length}/{MAX_BEFORE_AFTER})
                </p>
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={beforeAfter.length >= MAX_BEFORE_AFTER}
                onClick={() => beforeRef.current?.click()}
                className="flex-1 rounded-xl border border-border bg-card py-2 text-[11px] font-bold disabled:opacity-40"
              >
                + Before photo
              </button>
              <button
                type="button"
                disabled={beforeAfter.length >= MAX_BEFORE_AFTER}
                onClick={() => afterRef.current?.click()}
                className="flex-1 rounded-xl border border-border bg-card py-2 text-[11px] font-bold disabled:opacity-40"
              >
                + After photo
              </button>
              <input ref={beforeRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onBeforeAfter(e.target.files?.[0], "before"); e.target.value = ""; }} />
              <input ref={afterRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onBeforeAfter(e.target.files?.[0], "after"); e.target.value = ""; }} />
            </div>
            {beforeAfter.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {media.map((m, i) =>
                  m.category === "before" || m.category === "after" ? (
                    <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                      <img src={m.url} alt="" className="h-full w-full object-cover" />
                      <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                        {m.category}
                      </span>
                      <button
                        type="button"
                        onClick={() => setMedia((list) => list.filter((_, idx) => idx !== i))}
                        className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-[10px] font-bold text-white"
                      >
                        ✕
                      </button>
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </section>


          {/* Visibility */}
          <section className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">Show in Find Local Help</p>
                <p className="text-[11px] text-muted-foreground">When on, neighbors can find and hire you</p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive((v) => !v)}
                className={`relative h-7 w-12 rounded-full transition ${isActive ? "bg-primary" : "bg-muted"}`}
                aria-pressed={isActive}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                    isActive ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Verification */}
          <section className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-start gap-2">
              <BadgeCheck className={`mt-0.5 h-5 w-5 ${verified ? "text-primary" : "text-muted-foreground"}`} />
              <div className="flex-1">
                <p className="text-sm font-bold">{verified ? "Verified business" : "Get verified"}</p>
                <p className="text-[11px] text-muted-foreground">
                  Verified badge builds trust on your public profile.
                </p>
                {!verified && (
                  <button
                    type="button"
                    onClick={() => void requestVerification()}
                    className="mt-2 rounded-full bg-muted px-3 py-1.5 text-[11px] font-bold"
                  >
                    Request verification
                  </button>
                )}
              </div>
            </div>
          </section>

          {user && (
            <div className="-mx-4">
              <UserReviewsSection userId={user.id} title="Your reviews" />
            </div>
          )}

          <div className="space-y-2 pb-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {exists ? "Save & go live" : "Create business & go live"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="h-11 w-full rounded-2xl border border-border text-sm font-bold disabled:opacity-60"
            >
              Save draft
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
