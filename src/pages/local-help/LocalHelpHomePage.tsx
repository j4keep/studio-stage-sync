import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BriefcaseBusiness, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { LOCAL_HELP_CATEGORIES, TRENDING_SERVICES } from "@/lib/local-help";
import AskYajHelpSheet from "@/components/local-help/AskYajHelpSheet";
import PostGigSheet from "@/components/jobs/PostGigSheet";
import { LocalHelpCategoryVisual } from "@/components/local-help/LocalHelpCategoryVisual";

const RECENT_KEY = "yaj_local_help_recent";

/** Explore → Find Local Help home (YAJ design, Nextdoor workflow). */
export default function LocalHelpHomePage() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [askOpen, setAskOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [recents, setRecents] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const cats = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return LOCAL_HELP_CATEGORIES;
    return LOCAL_HELP_CATEGORIES.filter(
      (c) => c.label.toLowerCase().includes(n) || c.searchHint.toLowerCase().includes(n),
    );
  }, [q]);

  const submitSearch = (raw?: string) => {
    const term = (raw ?? q).trim();
    if (!term) return;
    setQ(term);
    const next = [term, ...recents.filter((r) => r !== term)].slice(0, 6);
    setRecents(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    const match = LOCAL_HELP_CATEGORIES.find(
      (c) => c.label.toLowerCase().includes(term.toLowerCase()) || c.searchHint.includes(term.toLowerCase()),
    );
    if (match) nav(`/local-help/${match.id}?q=${encodeURIComponent(term)}`);
    else nav(`/local-help/handyman?q=${encodeURIComponent(term)}`);
  };

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="mb-3 flex items-center gap-2">
          <button type="button" onClick={() => nav("/explore")} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">YAJ Local Services</p>
            <h1 className="text-lg font-black tracking-tight">Find trusted local help</h1>
          </div>
          <button
            type="button"
            onClick={() => nav("/local-help/business")}
            className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
          >
            My Business
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch();
          }}
          className="relative"
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for plumbers, electricians, photographers, DJs…"
            className="h-12 w-full rounded-2xl border border-border bg-muted pl-10 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
      </header>

      <section className="space-y-3 px-4 pt-4">
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,hsl(var(--primary)/.14),hsl(var(--background)),hsl(var(--muted)))] p-4">
            <div className="absolute right-[-30px] top-[-35px] h-28 w-28 rounded-full border border-primary/10 bg-primary/5" />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primary">
                <ShieldCheck className="h-3 w-3" /> Hire with confidence
              </span>
              <h2 className="mt-3 max-w-[280px] text-xl font-black leading-tight">Find the right person for the job.</h2>
              <p className="mt-1 max-w-[330px] text-[12px] leading-relaxed text-muted-foreground">
                Compare local helpers by services, portfolio, rates, reviews and availability.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 border-t border-border">
            <button
              type="button"
              onClick={() => setAskOpen(true)}
              className="border-r border-border p-3.5 text-left transition active:bg-muted"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <p className="mt-2 text-[13px] font-black">Describe the job</p>
              <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">YAJ can suggest the best service category.</p>
            </button>
            <button
              type="button"
              onClick={() => nav("/local-help/business")}
              className="p-3.5 text-left transition active:bg-muted"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BriefcaseBusiness className="h-4 w-4" />
              </span>
              <p className="mt-2 text-[13px] font-black">Offer your services</p>
              <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">Create a professional helper profile.</p>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPostOpen(true)}
            className="rounded-2xl border border-border bg-card p-3 text-left shadow-sm"
          >
            <p className="text-[13px] font-black">Post a gig</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Let local helpers come to you</p>
          </button>
          <button
            type="button"
            onClick={() => nav("/gigs")}
            className="rounded-2xl border border-border bg-card p-3 text-left shadow-sm"
          >
            <p className="text-[13px] font-black">Gig board</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">See what neighbors need fixed</p>
          </button>
          <button
            type="button"
            onClick={() => nav("/my-gigs")}
            className="col-span-2 rounded-2xl border border-border bg-card p-3 text-left shadow-sm transition active:bg-muted"
          >
            <p className="text-[13px] font-black">My gigs dashboard</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Track helpers, completion & ratings</p>
          </button>
        </div>
      </section>


      {!q && recents.length > 0 && (
        <section className="mt-4 px-4">
          <p className="mb-2 text-xs font-bold text-muted-foreground">Recent</p>
          <div className="flex flex-wrap gap-2">
            {recents.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => submitSearch(r)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold"
              >
                {r}
              </button>
            ))}
          </div>
        </section>
      )}

      {!q && (
        <section className="mt-4 px-4">
          <p className="mb-2 text-xs font-bold text-muted-foreground">Trending</p>
          <div className="flex flex-wrap gap-2">
            {TRENDING_SERVICES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => submitSearch(t)}
                className="rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold"
              >
                {t}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mt-5 px-4">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-base font-black">Browse services</h2>
            <p className="text-[11px] text-muted-foreground">Local professionals, freelancers and skilled neighbors</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {cats.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => nav(`/local-help/${cat.id}`)}
              className="group overflow-hidden rounded-2xl border border-border bg-card text-left shadow-[0_8px_24px_rgba(0,0,0,.06)] transition active:scale-[0.98]"
            >
              <div className="aspect-[5/3] overflow-hidden">
                <LocalHelpCategoryVisual categoryId={cat.id} label={cat.label} />
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[13px] font-black leading-snug">{cat.label}</p>
                <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{cat.searchHint}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <AskYajHelpSheet open={askOpen} onClose={() => setAskOpen(false)} />
      <PostGigSheet open={postOpen} onClose={() => setPostOpen(false)} onCreated={() => setPostOpen(false)} />
    </div>
  );
}
