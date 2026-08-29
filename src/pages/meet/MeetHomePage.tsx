import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Inbox, MapPin, Search, Sparkles, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import MeetAdultGate, { MeetBrandMark } from "@/components/meet/MeetAdultGate";
import {
  ageFromBirthYear,
  getMeetProfile,
  listMeetProfiles,
  type MeetProfile,
} from "@/lib/meet";

function MeetHomeInner() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<MeetProfile[]>([]);
  const [mine, setMine] = useState<MeetProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, me] = await Promise.all([
        listMeetProfiles({ excludeUserId: user?.id }),
        user?.id ? getMeetProfile(user.id) : Promise.resolve(null),
      ]);
      setProfiles(list);
      setMine(me);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => {
      const blob = [p.display_name, p.headline, p.bio, p.city, p.looking_for, ...(p.interests || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [profiles, query]);

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav("/explore")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <MeetBrandMark />
            <h1 className="text-lg font-black tracking-tight">Meet people nearby</h1>
          </div>
          <button
            type="button"
            onClick={() => nav("/meet/inbox")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Interview inbox"
          >
            <Inbox className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => nav("/meet/setup")}
            className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
          >
            {mine ? "My profile" : "Create profile"}
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by city, interest, vibe…"
            className="h-11 w-full rounded-2xl border border-border bg-muted pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </header>

      {!mine && (
        <button
          type="button"
          onClick={() => nav("/meet/setup")}
          className="mx-4 mt-4 flex w-[calc(100%-2rem)] items-start gap-3 rounded-2xl border border-primary/20 bg-primary/10 p-4 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </span>
          <span>
            <p className="text-sm font-bold">Create your Meet profile</p>
            <p className="text-[12px] text-muted-foreground">
              Show up in the scroll so people can ask to interview you — or browse first.
            </p>
          </span>
        </button>
      )}

      <section className="space-y-4 px-4 pt-4">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <Heart className="mx-auto mb-3 h-8 w-8 text-primary/50" />
            <p className="text-sm font-bold">Nobody here yet</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Be the first to create a Meet profile and open the floor for interviews.
            </p>
            <button
              type="button"
              onClick={() => nav("/meet/setup")}
              className="mt-4 rounded-full gradient-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              Create profile
            </button>
          </div>
        )}

        {filtered.map((p) => {
          const age = ageFromBirthYear(p.birth_year);
          const photo = p.photo_urls[0];
          return (
            <button
              key={p.user_id}
              type="button"
              onClick={() => nav(`/meet/u/${p.user_id}`)}
              className="w-full overflow-hidden rounded-3xl border border-border bg-card text-left shadow-sm"
            >
              <div className="relative aspect-[4/5] w-full bg-muted">
                {photo ? (
                  <img src={photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                    <UserRound className="h-12 w-12 opacity-40" />
                    <span className="text-xs font-semibold">Photo coming soon</span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-4 pt-16 text-white">
                  <p className="text-lg font-black">
                    {p.display_name}
                    {age != null ? <span className="font-semibold opacity-90">, {age}</span> : null}
                  </p>
                  {p.headline && <p className="text-[13px] text-white/90">{p.headline}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-white/85">
                    {p.city && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5">
                        <MapPin className="h-3 w-3" /> {p.city}
                      </span>
                    )}
                    {p.looking_for && (
                      <span className="rounded-full bg-white/15 px-2 py-0.5">{p.looking_for}</span>
                    )}
                    {p.open_to_interview && (
                      <span className="rounded-full bg-rose-500/90 px-2 py-0.5">Open to interview</span>
                    )}
                  </div>
                </div>
              </div>
              {p.interests?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 py-3">
                  {p.interests.slice(0, 5).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </section>
    </div>
  );
}

export default function MeetHomePage() {
  return (
    <MeetAdultGate>
      <MeetHomeInner />
    </MeetAdultGate>
  );
}
