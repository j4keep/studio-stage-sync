import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, MessageCircle, Search, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

type ConnectionProfile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country_flag: string | null;
};

const INTENTS = [
  { id: "dating", label: "Dating", emoji: "❤️" },
  { id: "friends", label: "Friends", emoji: "👥" },
  { id: "networking", label: "Networking", emoji: "💼" },
  { id: "gaming", label: "Gaming buddies", emoji: "🎮" },
  { id: "fitness", label: "Workout partners", emoji: "🏃" },
  { id: "concerts", label: "Concert buddies", emoji: "🎵" },
  { id: "coffee", label: "Coffee meetup", emoji: "☕" },
];

const INTERESTS = [
  { id: "near", label: "Near me", emoji: "📍" },
  { id: "music", label: "Music lovers", emoji: "🎵" },
  { id: "foodies", label: "Foodies", emoji: "🍔" },
  { id: "gamers", label: "Gamers", emoji: "🎮" },
  { id: "dating", label: "Dating", emoji: "❤️" },
  { id: "entrepreneurs", label: "Entrepreneurs", emoji: "💼" },
  { id: "fitness", label: "Fitness", emoji: "🏋️" },
  { id: "dogs", label: "Dog lovers", emoji: "🐶" },
];

/** People discovery experience — lives inside My Circle. */
export default function ConnectionsDiscovery() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState<string | null>(null);
  const [activeInterests, setActiveInterests] = useState<string[]>([]);
  const [people, setPeople] = useState<ConnectionProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, bio, country_flag")
        .order("updated_at", { ascending: false })
        .limit(60);
      if (!cancelled) {
        setPeople((data as ConnectionProfile[]) || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return people;
    return people.filter((p) => [p.display_name, p.bio].join(" ").toLowerCase().includes(needle));
  }, [people, query]);

  const toggleInterest = (id: string) =>
    setActiveInterests((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="pb-6">
      <div className="px-4 pt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, interests…"
            className="h-9 w-full rounded-full border border-border bg-muted/70 pl-9 pr-4 text-[13px] outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <section className="px-4 pt-4">
        <h2 className="text-[12px] font-black uppercase tracking-[0.12em] text-muted-foreground">
          What are you looking for?
        </h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {INTENTS.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => setIntent((prev) => (prev === i.id ? null : i.id))}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition active:scale-95 ${
                intent === i.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground"
              }`}
            >
              <span className="mr-1">{i.emoji}</span>
              {i.label}
            </button>
          ))}
        </div>
      </section>

      <section className="px-4 pt-5">
        <h2 className="text-[12px] font-black uppercase tracking-[0.12em] text-muted-foreground">
          Discover by interest
        </h2>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {INTERESTS.map((i) => {
            const on = activeInterests.includes(i.id);
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => toggleInterest(i.id)}
                className={`shrink-0 rounded-2xl border px-3 py-2 text-[12px] font-semibold transition active:scale-95 ${
                  on ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground"
                }`}
              >
                <span className="mr-1">{i.emoji}</span>
                {i.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="px-4 pt-6">
        <div className="mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[13px] font-black">People in your city</h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
            ))}
          </div>
        ) : filtered.length ? (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((p) => (
              <article
                key={p.user_id}
                className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_4px_14px_rgba(15,23,42,0.06)]"
              >
                <div className="aspect-square w-full bg-muted">
                  {p.avatar_url ? (
                    <img
                      src={p.avatar_url}
                      alt={p.display_name || "Member"}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl">
                      {p.country_flag || "🙂"}
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="truncate text-[13px] font-bold">{p.display_name || "YAJ member"}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3" /> Nearby
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => navigate(`/artist/${p.user_id}`)}
                      className="flex-1 rounded-full border border-border px-2 py-1.5 text-[11px] font-semibold active:scale-95"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/messages?to=${p.user_id}`)}
                      className="rounded-full bg-primary px-2.5 py-1.5 text-primary-foreground active:scale-95"
                      aria-label="Message"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
            <p className="font-bold">No people matched that search.</p>
            <p className="mt-1 text-sm text-muted-foreground">Try another interest or clear your search.</p>
          </div>
        )}
      </section>
    </div>
  );
}
