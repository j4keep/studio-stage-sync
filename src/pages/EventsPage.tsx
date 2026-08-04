import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  media_url: string | null;
  media_type: string;
  address: string | null;
  map_url: string | null;
  price_cents: number | null;
  starts_at: string | null;
  created_at: string;
};

function formatPrice(cents: number | null) {
  if (cents == null) return null;
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** Explore → Events: flyer/video + address/map + price. */
export default function EventsPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("event_listings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);
    setRows(error ? [] : ((data as EventRow[]) || []));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      const { error } = await (supabase as any).from("event_listings").insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        media_url: mediaUrl,
        media_type: mediaType,
        address: address.trim() || null,
        map_url: mapUrl,
        price_cents: priceCents,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      });
      if (error) throw error;
      toast.success("Event posted");
      setTitle("");
      setDescription("");
      setAddress("");
      setPrice("");
      setStartsAt("");
      setFile(null);
      setShowForm(false);
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Could not post event");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
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
      </header>

      {showForm ? (
        <div className="space-y-3 border-b border-border px-4 py-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35"
          />
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
              placeholder="Price ($)"
              inputMode="decimal"
              className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35"
            />
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35"
            />
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
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No events yet. Post a flyer or video to show up on Happening.
          </p>
        ) : (
          rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => nav(`/events/${row.id}`)}
              className="w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm"
            >
              {row.media_url ? (
                row.media_type === "video" ? (
                  <video src={row.media_url} muted playsInline className="aspect-[4/5] w-full object-cover" />
                ) : (
                  <img src={row.media_url} alt="" className="aspect-[4/5] w-full object-cover" />
                )
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center bg-muted text-sm text-muted-foreground">
                  Event
                </div>
              )}
              <div className="space-y-1 px-3 py-2.5">
                <p className="font-bold">{row.title}</p>
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
          ))
        )}
      </section>
    </div>
  );
}
