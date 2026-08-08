import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarClock, MapPin, Search, Share2, SlidersHorizontal } from "lucide-react";
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

function formatPrice(cents: number | null) {
  if (cents == null) return null;
  if (cents === 0) return "Free";
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

/** Explore → Events: discovery only. Creating/managing events lives in the Professional Dashboard. */
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
      await (supabase as any)
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", hostId);
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
        toast.success("You're going — only the host sees this");
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
  }, [rows, query, filters, hosts]);

  return (
    <div className="min-h-screen bg-background pb-32 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav("/explore")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-11 flex-1 items-center gap-2 rounded-full border border-border bg-card px-4 shadow-sm">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find things to do"
              className="h-full w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            aria-label="Filter"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilterCount ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </div>
        {filters.categories.length ? (
          <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
            {filters.categories.map((c) => (
              <span
                key={c}
                className="whitespace-nowrap rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground"
              >
                {EVENT_CATEGORIES.find((x) => x.id === c)?.label || c}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <section className="space-y-6 px-4 py-4">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No events match your search.
          </p>
        ) : (
          visible.map((row) => {
            const host = hosts[row.user_id];
            const isGoing = goingIds.includes(row.id);
            const isHost = user?.id === row.user_id;
            return (
              <article key={row.id} className="text-left">
                <div className="mb-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => nav(`/artist/${row.user_id}`)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                      {host?.avatar_url ? (
                        <img src={host.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[11px] font-bold text-muted-foreground">
                          {(host?.display_name || "?")[0]?.toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 truncate text-[13px] font-bold">
                      {host?.display_name || "Creator"}
                    </span>
                  </button>
                  {!isHost ? (
                    <button
                      type="button"
                      onClick={() => void toggleFollow(row.user_id)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                        followingIds.includes(row.user_id)
                          ? "border border-border bg-muted text-foreground"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {followingIds.includes(row.user_id) ? "Following" : "Follow"}
                    </button>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => nav(`/events/${row.id}`)}
                  className="w-full overflow-hidden rounded-2xl text-left"
                >
                  {row.media_url ? (
                    <div className="aspect-[3/2] w-full overflow-hidden rounded-2xl bg-muted">
                      {row.media_type === "video" ? (
                        <video src={row.media_url} muted playsInline className="h-full w-full object-cover" />
                      ) : (
                        <img src={row.media_url} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                  ) : (
                    <div className="flex aspect-[3/2] items-center justify-center rounded-2xl bg-muted text-sm text-muted-foreground">
                      Event
                    </div>
                  )}
                </button>

                <div className="mt-2 flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => nav(`/events/${row.id}`)}
                    className="min-w-0 flex-1 space-y-1 text-left"
                  >
                    <p className="text-[17px] font-black leading-snug">{row.title}</p>
                    {formatWhen(row.starts_at) ? (
                      <p className="flex items-center gap-1 text-[13px] text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {formatWhen(row.starts_at)}
                      </p>
                    ) : null}
                    {row.address ? (
                      <p className="flex items-center gap-1 text-[13px] text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {row.address}
                      </p>
                    ) : null}
                    {formatPrice(row.price_cents) ? (
                      <p className="text-[13px] font-bold">{formatPrice(row.price_cents)}</p>
                    ) : null}
                  </button>
                  <div className="flex shrink-0 items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShareEvent(row)}
                      aria-label="Share event"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    {!isHost ? (
                      <button
                        type="button"
                        onClick={() => void toggleGoing(row.id)}
                        className={`rounded-full px-4 py-2 text-[12px] font-bold active:scale-95 ${
                          isGoing
                            ? "border border-border bg-muted text-foreground"
                            : "bg-primary text-primary-foreground"
                        }`}
                      >
                        {isGoing ? "Going ✓" : "Going"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>

      {showFilters ? (
        <EventFilterSheet value={filters} onApply={setFilters} onClose={() => setShowFilters(false)} />
      ) : null}

      {shareEvent ? <ShareEventSheet event={shareEvent} onClose={() => setShareEvent(null)} /> : null}
    </div>
  );
}
