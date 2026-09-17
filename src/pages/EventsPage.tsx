import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  ChevronRight,
  MapPin,
  Plus,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ShareEventSheet from "@/components/events/ShareEventSheet";
import EventFilterSheet, {
  DEFAULT_EVENT_FILTERS,
  EVENT_CATEGORIES,
  type EventFilters,
} from "@/components/events/EventFilterSheet";

type EventRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  media_url: string | null;
  media_type: string;
  address: string | null;
  map_url: string | null;
  price_cents: number | null;
  starts_at: string | null;
  ends_at: string | null;
  expires_at: string | null;
  capacity: number | null;
  created_at: string;
};

type HostProfile = { user_id: string; display_name: string | null; avatar_url: string | null };
type FeedMode = "for-you" | "following" | "going";

function formatPrice(cents: number | null) {
  if (cents == null) return "RSVP";
  if (cents === 0) return "Free RSVP";
  return `From $${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function formatWhen(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function compactWhen(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase();
}

/** Bold My Circle event discovery. Event creation/management stays in the existing host dashboard. */
export default function EventsPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [hosts, setHosts] = useState<Record<string, HostProfile>>({});
  const [goingIds, setGoingIds] = useState<string[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_EVENT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [shareEvent, setShareEvent] = useState<EventRow | null>(null);
  const [feedMode, setFeedMode] = useState<FeedMode>("for-you");
  const [category, setCategory] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("event_listings")
      .select("*")
      .eq("status", "active")
      .order("starts_at", { ascending: true, nullsFirst: false })
      .limit(80);
    const list = error ? [] : ((data as EventRow[]) || []);
    setRows(list);

    const hostIds = Array.from(new Set(list.map((r) => r.user_id)));
    if (hostIds.length) {
      const { data: profs } = await (supabase as any)
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", hostIds);
      const map: Record<string, HostProfile> = {};
      ((profs as HostProfile[]) || []).forEach((p) => {
        map[p.user_id] = p;
      });
      setHosts(map);
    }

    if (user) {
      const { data: rsvps } = await (supabase as any)
        .from("event_rsvps")
        .select("event_id, user_id")
        .eq("user_id", user.id);
      setGoingIds(((rsvps as { event_id: string }[]) || []).map((r) => r.event_id));

      const { data: fol } = await (supabase as any)
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);
      setFollowingIds(((fol as { following_id: string }[]) || []).map((f) => f.following_id));
    } else {
      setGoingIds([]);
      setFollowingIds([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFollow = async (hostId: string) => {
    if (!user) {
      toast.error("Sign in to follow");
      return;
    }
    const isFollowing = followingIds.includes(hostId);
    setFollowingIds((prev) => (isFollowing ? prev.filter((id) => id !== hostId) : [...prev, hostId]));
    if (isFollowing) {
      await (supabase as any).from("follows").delete().eq("follower_id", user.id).eq("following_id", hostId);
    } else {
      const { error } = await (supabase as any)
        .from("follows")
        .insert({ follower_id: user.id, following_id: hostId });
      if (error) {
        setFollowingIds((prev) => prev.filter((id) => id !== hostId));
        toast.error("Could not follow");
      }
    }
  };

  const toggleGoing = async (eventId: string) => {
    if (!user) {
      toast.error("Sign in to RSVP");
      return;
    }
    const isGoing = goingIds.includes(eventId);
    setGoingIds((prev) => (isGoing ? prev.filter((id) => id !== eventId) : [...prev, eventId]));
    if (isGoing) {
      const { error } = await (supabase as any)
        .from("event_rsvps")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", user.id);
      if (error) {
        setGoingIds((prev) => [...prev, eventId]);
        toast.error("Could not update RSVP");
      }
    } else {
      const { error } = await (supabase as any)
        .from("event_rsvps")
        .insert({ event_id: eventId, user_id: user.id, status: "going" });
      if (error) {
        setGoingIds((prev) => prev.filter((id) => id !== eventId));
        toast.error("Could not update RSVP");
      } else {
        toast.success("Reservation saved");
      }
    }
  };

  const activeFilterCount =
    filters.categories.length + (filters.price !== "any" ? 1 : 0) + (filters.sort !== "relevance" ? 1 : 0);

  const visible = useMemo(() => {
    let list = rows;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const host = hosts[r.user_id]?.display_name?.toLowerCase() || "";
        return (
          r.title.toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q) ||
          (r.address || "").toLowerCase().includes(q) ||
          host.includes(q)
        );
      });
    }

    if (feedMode === "following") list = list.filter((r) => followingIds.includes(r.user_id));
    if (feedMode === "going") list = list.filter((r) => goingIds.includes(r.id));
    if (category !== "all") list = list.filter((r) => r.category === category);
    if (filters.categories.length) list = list.filter((r) => filters.categories.includes(r.category));
    if (filters.price === "free") list = list.filter((r) => (r.price_cents ?? 0) === 0);
    if (filters.price === "25") list = list.filter((r) => (r.price_cents ?? 0) <= 2500);
    if (filters.price === "50") list = list.filter((r) => (r.price_cents ?? 0) <= 5000);
    if (filters.sort === "date") {
      list = [...list].sort(
        (a, b) => new Date(a.starts_at || a.created_at).getTime() - new Date(b.starts_at || b.created_at).getTime(),
      );
    }
    return list;
  }, [rows, query, feedMode, category, filters, hosts, followingIds, goingIds]);

  const categoryChoices = [{ id: "all", label: "All" }, ...EVENT_CATEGORIES.slice(0, 8)];

  return (
    <div className="min-h-[100dvh] bg-black pb-32 text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/88 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => nav("/circle")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]"
            aria-label="Back to My Circle"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">My Circle</p>
            <h1 className="truncate text-[20px] font-black tracking-[-0.03em]">Events</h1>
          </div>
          <button
            type="button"
            onClick={() => nav("/pro/events")}
            className="flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-[12px] font-black text-black"
          >
            <Plus className="h-4 w-4" /> Host
          </button>
        </div>
      </header>

      <section className="px-4 pb-2 pt-7">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-300">
              <Sparkles className="h-3.5 w-3.5" /> Find your next thing
            </div>
            <h2 className="max-w-[320px] text-[42px] font-black leading-[0.9] tracking-[-0.055em] sm:text-[52px]">
              Your city. Your people.
            </h2>
          </div>
          <div className="mb-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-xl shadow-fuchsia-500/20">
            <Ticket className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-6 flex h-13 items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4">
          <Search className="h-4 w-4 shrink-0 text-white/45" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events, hosts, places"
            className="h-12 w-full bg-transparent text-[13px] font-semibold text-white outline-none placeholder:text-white/35"
          />
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            aria-label="Filter events"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[9px] font-black">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </section>

      <section className="mt-4">
        <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-none">
          {([
            ["for-you", "For You"],
            ["following", "Following"],
            ["going", "Saved / Going"],
          ] as [FeedMode, string][]).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFeedMode(id)}
              className={`shrink-0 rounded-full px-4 py-2 text-[12px] font-black ${
                feedMode === id ? "bg-white text-black" : "border border-white/10 bg-white/[0.04] text-white/55"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-none">
          {categoryChoices.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                category === item.id ? "bg-fuchsia-500 text-white" : "bg-white/[0.06] text-white/45"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5 space-y-8 px-4">
        {loading ? (
          <div className="flex min-h-[35dvh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] px-6 py-14 text-center">
            <CalendarClock className="mx-auto h-8 w-8 text-white/35" />
            <h3 className="mt-4 text-xl font-black">Nothing here yet</h3>
            <p className="mx-auto mt-2 max-w-xs text-[13px] text-white/45">
              Try another category, follow more hosts, or create the first event for your crowd.
            </p>
            <button type="button" onClick={() => nav("/pro/events")} className="mt-6 rounded-full bg-white px-5 py-3 text-[12px] font-black text-black">
              Host an event
            </button>
          </div>
        ) : (
          visible.map((row) => {
            const host = hosts[row.user_id];
            const isGoing = goingIds.includes(row.id);
            const isHost = user?.id === row.user_id;
            return (
              <article key={row.id} className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.045]">
                <button
                  type="button"
                  onClick={() => nav(`/events/${row.id}`)}
                  className="relative block aspect-[4/5] w-full overflow-hidden bg-zinc-900 text-left"
                >
                  {row.media_url ? (
                    row.media_type === "video" ? (
                      <video src={row.media_url} muted playsInline className="h-full w-full object-cover" />
                    ) : (
                      <img src={row.media_url} alt="" className="h-full w-full object-cover" />
                    )
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-fuchsia-700 to-orange-500" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/90" />
                  <div className="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] backdrop-blur-xl">
                    {compactWhen(row.starts_at) || row.category}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/58">{row.category}</p>
                    <h3 className="mt-1 text-[30px] font-black leading-[0.95] tracking-[-0.045em]">{row.title}</h3>
                    {row.address ? (
                      <p className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-white/65">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="truncate">{row.address}</span>
                      </p>
                    ) : null}
                  </div>
                </button>

                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => nav(`/artist/${row.user_id}`)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                      <span className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
                        {host?.avatar_url ? (
                          <img src={host.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[12px] font-black text-white/50">
                            {(host?.display_name || "?")[0]?.toUpperCase()}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-black">{host?.display_name || "YAJ Host"}</span>
                        <span className="mt-0.5 block text-[10px] font-semibold text-white/40">Host</span>
                      </span>
                    </button>
                    {!isHost && (
                      <button
                        type="button"
                        onClick={() => void toggleFollow(row.user_id)}
                        className={`rounded-full px-3 py-2 text-[11px] font-black ${
                          followingIds.includes(row.user_id) ? "bg-white/10 text-white" : "bg-white text-black"
                        }`}
                      >
                        {followingIds.includes(row.user_id) ? "Following" : "Follow"}
                      </button>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-[12px] font-semibold text-white/58">
                    {formatWhen(row.starts_at) && (
                      <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{formatWhen(row.starts_at)}</span>
                      </span>
                    )}
                    <span className="shrink-0 font-black text-white">{formatPrice(row.price_cents)}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
                    {isHost ? (
                      <button
                        type="button"
                        onClick={() => nav(`/events/${row.id}`)}
                        className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-white text-[12px] font-black text-black"
                      >
                        Manage event <ChevronRight className="h-4 w-4" />
                      </button>
                    ) : row.price_cents && row.price_cents > 0 ? (
                      <button
                        type="button"
                        onClick={() => nav(`/events/${row.id}`)}
                        className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-white text-[12px] font-black text-black"
                      >
                        View tickets <Ticket className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void toggleGoing(row.id)}
                        className={`h-11 rounded-2xl text-[12px] font-black ${
                          isGoing ? "border border-white/15 bg-white/10 text-white" : "bg-white text-black"
                        }`}
                      >
                        {isGoing ? "Reserved ✓" : "Reserve spot"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShareEvent(row)}
                      aria-label="Share event"
                      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => nav(`/events/${row.id}`)}
                      aria-label="View event"
                      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>

      <button
        type="button"
        onClick={() => nav("/pro/events")}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-20 flex h-14 items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 text-[13px] font-black text-white shadow-2xl shadow-fuchsia-500/20"
      >
        <Plus className="h-5 w-5" /> Create event
      </button>

      {showFilters && <EventFilterSheet value={filters} onApply={setFilters} onClose={() => setShowFilters(false)} />}
      {shareEvent && <ShareEventSheet event={shareEvent} onClose={() => setShareEvent(null)} />}
    </div>
  );
}
