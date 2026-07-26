import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Sparkles, X } from "lucide-react";
import { LOCAL_HELP_CATEGORIES, TRENDING_SERVICES } from "@/lib/local-help";
import AskYajHelpSheet from "@/components/local-help/AskYajHelpSheet";
import PostGigSheet from "@/components/jobs/PostGigSheet";

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
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Create • Connect • Elevate</p>
            <h1 className="text-lg font-black tracking-tight">Find Local Help</h1>
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
        <button
          type="button"
          onClick={() => setAskOpen(true)}
          className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-violet-500 to-fuchsia-500 p-4 text-left text-primary-foreground shadow-sm"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_40%)]" />
          <div className="relative">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-bold">
              <Sparkles className="h-3 w-3" /> YAJ Buddy
            </span>
            <p className="mt-2 text-base font-black">Need help? Describe it.</p>
            <p className="mt-1 text-[11px] text-white/90">
              Upload photos or type what you need — Buddy suggests category, budget, and helpers.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => nav("/local-help/business")}
          className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Offer services</p>
          <p className="mt-1 text-base font-black">Become a Handyman (or DJ, cleaner…)</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Create your Local Help business page — logo, rates, services, portfolio — and go live.
          </p>
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPostOpen(true)}
            className="rounded-2xl border border-border bg-card p-3 text-left shadow-sm"
          >
            <p className="text-[13px] font-black">Post a need</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Let local helpers come to you</p>
          </button>
          <button
            type="button"
            onClick={() => nav("/my-gigs")}
            className="rounded-2xl border border-border bg-card p-3 text-left shadow-sm"
          >
            <p className="text-[13px] font-black">My requests</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Track helpers & completion</p>
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
                onClick={() => {
                  setQ(r);
                  nav(`/local-help/handyman?q=${encodeURIComponent(r)}`);
                }}
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
            <h2 className="text-base font-bold">Services</h2>
            <p className="text-[11px] text-muted-foreground">Neighbors, freelancers, students & pros</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {cats.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => nav(`/local-help/${cat.id}`)}
              className="overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm active:scale-[0.98] transition"
            >
              <div className={`flex aspect-[5/3] items-center justify-center bg-gradient-to-br ${cat.gradient}`}>
                <span className="text-5xl drop-shadow">{cat.emoji}</span>
              </div>
              <p className="px-3 py-2.5 text-[13px] font-bold leading-snug">{cat.label}</p>
            </button>
          ))}
        </div>
      </section>

      <AskYajHelpSheet open={askOpen} onClose={() => setAskOpen(false)} />
      <PostGigSheet open={postOpen} onClose={() => setPostOpen(false)} onCreated={() => setPostOpen(false)} />
    </div>
  );
}
