import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Inbox, Pencil, Search, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import MeetAdultGate, { MeetBrandMark } from "@/components/meet/MeetAdultGate";
import MeetProfileCard, { MeetProfileCardSkeleton } from "@/components/meet/MeetProfileCard";
import { getMeetProfile, listMeetProfiles, type MeetProfile } from "@/lib/meet";

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
      // Include everyone (including you) so a newly created profile appears on the grid.
      const [list, me] = await Promise.all([
        listMeetProfiles({ requirePhotos: true }),
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
              Add photos and show up in the grid so people can ask to interview you.
            </p>
          </span>
        </button>
      )}

      {mine && (!mine.photo_urls?.length || !mine.is_visible) && (
        <button
          type="button"
          onClick={() => nav("/meet/setup")}
          className="mx-4 mt-4 flex w-[calc(100%-2rem)] items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
            <Heart className="h-5 w-5" />
          </span>
          <span>
            <p className="text-sm font-bold">
              {!mine.photo_urls?.length ? "Add photos to appear in Meet" : "Your profile is hidden"}
            </p>
            <p className="text-[12px] text-muted-foreground">
              {!mine.photo_urls?.length
                ? "Upload at least one photo so your card shows on this page."
                : "Turn on “Show my profile in the scroll” in setup to appear here."}
            </p>
          </span>
        </button>
      )}

      <section className="px-4 pt-4">
        {!loading && filtered.length > 0 && (
          <h2 className="mb-3 text-[13px] font-bold text-foreground">People near you</h2>
        )}

        {loading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <MeetProfileCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <Heart className="mx-auto mb-3 h-8 w-8 text-primary/50" />
            <p className="text-sm font-bold">Nobody here yet</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Be the first to create a Meet profile with photos and open the floor for interviews.
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

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((p) => (
              <MeetProfileCard key={p.user_id} profile={p} isYou={p.user_id === user?.id} />
            ))}
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={() => nav("/meet/setup")}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-30 inline-flex items-center gap-2 rounded-full gradient-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg"
      >
        <Pencil className="h-4 w-4" />
        {mine ? "Edit profile" : "Create profile"}
      </button>
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
