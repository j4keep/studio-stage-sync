import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarClock, MapPin, Pencil, Plus, Share2, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ShareEventSheet from "@/components/events/ShareEventSheet";


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

const CATEGORIES = [
  { id: "party", label: "🎉 Party" },
  { id: "music", label: "🎵 Music / Concert" },
  { id: "food", label: "🍔 Food & Drinks" },
  { id: "sports", label: "🏀 Sports" },
  { id: "gaming", label: "🎮 Gaming" },
  { id: "business", label: "💼 Business / Networking" },
  { id: "community", label: "🤝 Community" },
  { id: "wellness", label: "🌿 Wellness" },
  { id: "family", label: "👨‍👩‍👧 Family / Kids" },
  { id: "other", label: "✨ Other" },
];

function formatPrice(cents: number | null) {
  if (cents == null) return null;
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function formatWhen(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Explore → Events: create & discover events. "Going" counts stay private to the host. */
export default function EventsPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [goingIds, setGoingIds] = useState<string[]>([]);
  const [myCounts, setMyCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<"discover" | "mine">("discover");
  const [filter, setFilter] = useState<string | null>(null);
  const [shareEvent, setShareEvent] = useState<EventRow | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("party");
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [capacity, setCapacity] = useState("");
  const [file, setFile] = useState<File | null>(null);

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

    if (user) {
      const { data: rsvps } = await (supabase as any)
        .from("event_rsvps")
        .select("event_id, user_id")
        .in("event_id", list.map((r) => r.id).slice(0, 200));
      const all = (rsvps as { event_id: string; user_id: string }[]) || [];
      setGoingIds(all.filter((r) => r.user_id === user.id).map((r) => r.event_id));
      const mine = new Set(list.filter((r) => r.user_id === user.id).map((r) => r.id));
      const counts: Record<string, number> = {};
      all.forEach((r) => {
        if (mine.has(r.event_id)) counts[r.event_id] = (counts[r.event_id] || 0) + 1;
      });
      setMyCounts(counts);
    } else {
      setGoingIds([]);
      setMyCounts({});
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const deleteEvent = async (eventId: string) => {
    if (!window.confirm("Delete this event? This can't be undone.")) return;
    const { error } = await (supabase as any).from("event_listings").delete().eq("id", eventId);
    if (error) {
      toast.error("Could not delete event");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== eventId));
    toast.success("Event deleted");
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

  const publish = async () => {
    if (!user) {
      toast.error("Sign in to post an event");
      return;
    }
    if (!title.trim()) {
      toast.error("Add an event title");
      return;
    }
    setPosting(true);
    try {
      let mediaUrl: string | null = null;
      let mediaType = "image";
      if (file) {
        mediaType = file.type.startsWith("video/") ? "video" : "image";
        const ext = file.name.split(".").pop() || (mediaType === "video" ? "mp4" : "jpg");
        const path = `events/${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("media")
          .upload(path, file, { contentType: file.type || undefined });
        if (upErr) throw upErr;
        mediaUrl = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      }
      const dollars = Number.parseFloat(price);
      const priceCents = Number.isFinite(dollars) ? Math.round(dollars * 100) : null;
      const mapUrl = address.trim()
        ? `https://maps.google.com/?q=${encodeURIComponent(address.trim())}`
        : null;
      const startIso = startsAt ? new Date(startsAt).toISOString() : null;
      const endIso = endsAt ? new Date(endsAt).toISOString() : null;
      const cap = Number.parseInt(capacity, 10);
      const { data: created, error } = await (supabase as any)
        .from("event_listings")
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          category,
          media_url: mediaUrl,
          media_type: mediaType,
          address: address.trim() || null,
          map_url: mapUrl,
          price_cents: priceCents,
          starts_at: startIso,
          ends_at: endIso,
          expires_at: endIso || startIso,
          capacity: Number.isFinite(cap) ? cap : null,
        })
        .select("*")
        .single();
      if (error) throw error;
      toast.success("Event posted");
      if (created) setShareEvent(created as EventRow);

      setTitle("");
      setDescription("");
      setAddress("");
      setPrice("");
      setStartsAt("");
      setEndsAt("");
      setCapacity("");
      setCategory("party");
      setFile(null);
      setShowForm(false);
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Could not post event");
    } finally {
      setPosting(false);
    }
  };

  const visible = useMemo(() => {
    let list = rows;
    if (tab === "mine") list = list.filter((r) => user && r.user_id === user.id);
    if (filter) list = list.filter((r) => r.category === filter);
    return list;
  }, [rows, tab, filter, user]);

  return (
    <div className="min-h-screen bg-background pb-32 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav("/explore")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">What’s on</p>
            <h1 className="text-lg font-black tracking-tight">Events</h1>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Post
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          {(["discover", "mine"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${
                tab === t ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground"
              }`}
            >
              {t === "discover" ? "Discover" : "My events"}
            </button>
          ))}
        </div>

        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter((p) => (p === c.id ? null : c.id))}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold ${
                filter === c.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </header>

      {showForm ? (
        <div className="space-y-3 border-b border-border px-4 py-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Event details"
            rows={3}
            className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/35"
          />
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address (opens in Maps)"
            className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Price ($, 0 = free)"
              inputMode="decimal"
              className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35"
            />
            <input
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Spots (optional)"
              inputMode="numeric"
              className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Starts</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Ends / expires</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35"
              />
            </label>
          </div>
          <label className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-muted text-xs font-semibold text-muted-foreground">
            {file ? file.name : "Upload flyer or video"}
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <button
            type="button"
            disabled={posting}
            onClick={() => void publish()}
            className="h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {posting ? "Posting…" : "Publish event"}
          </button>
        </div>
      ) : null}

      <section className="space-y-3 px-4 py-4">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            {tab === "mine" ? "You haven’t posted an event yet." : "No events yet. Post a flyer or video to get started."}
          </p>
        ) : (
          visible.map((row) => {
            const isHost = user?.id === row.user_id;
            const isGoing = goingIds.includes(row.id);
            return (
              <article
                key={row.id}
                className="overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm"
              >
                <button type="button" onClick={() => nav(`/events/${row.id}`)} className="w-full text-left">
                  {row.media_url ? (
                    <div className="flex aspect-[4/5] w-full items-center justify-center overflow-hidden bg-muted">
                      {row.media_type === "video" ? (
                        <video src={row.media_url} muted playsInline className="h-full w-full object-contain" />
                      ) : (
                        <img src={row.media_url} alt="" className="h-full w-full object-contain" />
                      )}
                    </div>
                  ) : (
                    <div className="flex aspect-[4/5] items-center justify-center bg-muted text-sm text-muted-foreground">
                      Event
                    </div>
                  )}
                  <div className="space-y-1 px-3 pt-2.5">
                    <p className="font-bold">{row.title}</p>
                    {formatWhen(row.starts_at) ? (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarClock className="h-3 w-3" />
                        {formatWhen(row.starts_at)}
                        {formatWhen(row.ends_at) ? ` → ${formatWhen(row.ends_at)}` : ""}
                      </p>
                    ) : null}
                    {row.address ? (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {row.address}
                      </p>
                    ) : null}
                    {formatPrice(row.price_cents) ? (
                      <p className="text-xs font-semibold text-primary">{formatPrice(row.price_cents)}</p>
                    ) : null}
                  </div>
                </button>
                <div className="flex flex-wrap items-center gap-2 px-3 pb-3 pt-2">
                  {isHost ? (
                    <>
                      <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-[12px] font-bold">
                        <Users className="h-3.5 w-3.5" />
                        {myCounts[row.id] || 0} going
                        <span className="font-normal text-muted-foreground">· only you see this</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShareEvent(row)}
                        className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[12px] font-bold text-primary-foreground active:scale-95"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        Share
                      </button>
                      <button
                        type="button"
                        onClick={() => nav(`/events/${row.id}?edit=1`)}
                        className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-[12px] font-bold active:scale-95"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteEvent(row.id)}
                        className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-[12px] font-bold text-destructive active:scale-95"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void toggleGoing(row.id)}
                      className={`rounded-full px-4 py-1.5 text-[12px] font-bold active:scale-95 ${
                        isGoing
                          ? "border border-border bg-muted text-foreground"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {isGoing ? "Going ✓" : "Going"}
                    </button>
                  )}
                </div>

              </article>
            );
          })
        )}
      </section>

      {shareEvent ? (
        <ShareEventSheet event={shareEvent} onClose={() => setShareEvent(null)} />
      ) : null}
    </div>

  );
}
