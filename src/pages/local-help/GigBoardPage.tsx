import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, MapPin, Plus, Search, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { listBlockedPeerIds } from "@/lib/blocks";
import { timeAgo, URGENCY_OPTIONS } from "@/lib/jobs";
import { formatGigBudget } from "@/lib/gigs";
import { LOCAL_HELP_CATEGORIES } from "@/lib/local-help";
import PostGigSheet from "@/components/jobs/PostGigSheet";
import AskYajHelpSheet from "@/components/local-help/AskYajHelpSheet";

type GigRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  location: string | null;
  budget_min: number | null;
  budget_max: number | null;
  urgency: string;
  created_at: string;
  poster_id: string;
};

/** Explore → Gigs board. Neighbors post what they need fixed; helpers claim it. */
export default function GigBoardPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [gigs, setGigs] = useState<GigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [postOpen, setPostOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [snapOpen, setSnapOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("gig_listings")
      .select("id,title,description,category,location,budget_min,budget_max,urgency,created_at,poster_id")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(60);
    const blocked = user ? await listBlockedPeerIds(user.id) : new Set<string>();
    setGigs(((data ?? []) as GigRow[]).filter((g) => !g.poster_id || !blocked.has(g.poster_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    let items = gigs;
    if (cat !== "all") items = items.filter((g) => g.category === cat);
    if (n) {
      items = items.filter(
        (g) =>
          g.title.toLowerCase().includes(n) ||
          (g.description || "").toLowerCase().includes(n) ||
          (g.location || "").toLowerCase().includes(n) ||
          g.category.toLowerCase().includes(n),
      );
    }
    return items;
  }, [gigs, q, cat]);

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav("/explore")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Post it • Fix it • Rate it</p>
            <h1 className="text-lg font-black tracking-tight">Gigs</h1>
          </div>
          <button
            type="button"
            onClick={() => nav("/my-gigs")}
            className="rounded-full bg-muted px-3 py-1.5 text-[11px] font-bold"
          >
            My gigs
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search gigs — leaky sink, moving help, yard work…"
            className="h-12 w-full rounded-2xl border border-border bg-muted pl-10 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <section className="space-y-3 px-4 pt-4">
        <button
          type="button"
          onClick={() => (user ? setSnapOpen(true) : nav("/auth"))}
          className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-violet-500 to-fuchsia-500 p-4 text-left text-primary-foreground shadow-sm"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_40%)]" />
          <div className="relative">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-bold">
              <Sparkles className="h-3 w-3" /> YAJ Buddy
            </span>
            <p className="mt-2 text-base font-black">Snap a photo of what's broken</p>
            <p className="mt-1 text-[11px] text-white/90">
              Opens your camera — Buddy writes the gig: category, budget range and what to tell helpers.
            </p>
          </div>
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPostOpen(true)}
            className="flex items-center gap-2 rounded-2xl bg-primary p-3 text-left text-primary-foreground shadow-sm"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>
              <span className="block text-[13px] font-black">Post a gig</span>
              <span className="block text-[11px] opacity-90">Get it fixed</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => nav("/local-help")}
            className="rounded-2xl border border-border bg-card p-3 text-left shadow-sm"
          >
            <p className="text-[13px] font-black">Find Local Help</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Browse pros directly</p>
          </button>
        </div>
      </section>

      <div className="mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {[{ id: "all", label: "All gigs", emoji: "🧰" }, ...LOCAL_HELP_CATEGORIES.map((c) => ({ id: c.id, label: c.label, emoji: c.emoji }))].map(
          (c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCat(c.id)}
              className={`h-8 shrink-0 rounded-full px-3 text-[11px] font-bold ${
                cat === c.id ? "bg-foreground text-background" : "bg-muted text-foreground"
              }`}
            >
              {c.emoji} {c.label}
            </button>
          ),
        )}
      </div>

      <section className="space-y-2 px-4 pt-3">
        {loading && <p className="py-10 text-center text-sm text-muted-foreground">Loading gigs…</p>}
        {!loading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-sm font-semibold">No open gigs here yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {user ? "Be the first — post what you need fixed." : "Sign in to post what you need fixed."}
            </p>
            <button
              type="button"
              onClick={() => (user ? setPostOpen(true) : nav("/auth"))}
              className="mt-4 h-9 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground"
            >
              {user ? "Post a gig" : "Sign in"}
            </button>
          </div>
        )}
        {filtered.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => nav(`/gigs/${g.id}`)}
            className="w-full rounded-2xl border border-border bg-card p-3 text-left shadow-sm active:scale-[0.99] transition"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold leading-snug">{g.title}</p>
              <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-600">
                Gig
              </span>
            </div>
            {g.description && <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{g.description}</p>}
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              {g.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {g.location}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {timeAgo(g.created_at)}
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                {formatGigBudget(g.budget_min, g.budget_max)}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">
                {URGENCY_OPTIONS.find((u) => u.id === g.urgency)?.label ?? g.urgency}
              </span>
            </div>
          </button>
        ))}
      </section>

      <AskYajHelpSheet open={askOpen} onClose={() => setAskOpen(false)} />
      <PostGigSheet
        open={snapOpen}
        autoOpenPhotos
        onClose={() => setSnapOpen(false)}
        onCreated={() => {
          setSnapOpen(false);
          void load();
        }}
      />
      <PostGigSheet
        open={postOpen}
        onClose={() => setPostOpen(false)}
        onCreated={() => {
          setPostOpen(false);
          void load();
        }}
      />
    </div>
  );
}
