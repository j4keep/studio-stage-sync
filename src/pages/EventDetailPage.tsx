import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, MapPin, Pencil, Share2, Trash2, Users } from "lucide-react";
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
  capacity: number | null;
};

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

/** datetime-local value from an ISO string */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

export default function EventDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [row, setRow] = useState<EventRow | null>(null);
  const [isGoing, setIsGoing] = useState(false);
  const [goingCount, setGoingCount] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [eTitle, setETitle] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eAddress, setEAddress] = useState("");
  const [ePrice, setEPrice] = useState("");
  const [eStarts, setEStarts] = useState("");
  const [eEnds, setEEnds] = useState("");
  const [eCapacity, setECapacity] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await (supabase as any)
      .from("event_listings")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const ev = (data as EventRow) || null;
    setRow(ev);
    if (user && ev) {
      const { data: rsvps } = await (supabase as any)
        .from("event_rsvps")
        .select("user_id")
        .eq("event_id", ev.id);
      const list = (rsvps as { user_id: string }[]) || [];
      setIsGoing(list.some((r) => r.user_id === user.id));
      setGoingCount(ev.user_id === user.id ? list.length : 0);
    }
  }, [id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = useCallback((ev: EventRow) => {
    setETitle(ev.title);
    setEDesc(ev.description || "");
    setEAddress(ev.address || "");
    setEPrice(ev.price_cents == null ? "" : (ev.price_cents / 100).toString());
    setEStarts(toLocalInput(ev.starts_at));
    setEEnds(toLocalInput(ev.ends_at));
    setECapacity(ev.capacity == null ? "" : String(ev.capacity));
    setEditing(true);
  }, []);

  useEffect(() => {
    if (row && user?.id === row.user_id && params.get("edit") === "1" && !editing) {
      startEdit(row);
    }
  }, [row, user, params, editing, startEdit]);

  const toggleGoing = async () => {
    if (!user || !row) {
      toast.error("Sign in to RSVP");
      return;
    }
    if (isGoing) {
      setIsGoing(false);
      const { error } = await (supabase as any)
        .from("event_rsvps")
        .delete()
        .eq("event_id", row.id)
        .eq("user_id", user.id);
      if (error) {
        setIsGoing(true);
        toast.error("Could not update RSVP");
      }
    } else {
      setIsGoing(true);
      const { error } = await (supabase as any)
        .from("event_rsvps")
        .insert({ event_id: row.id, user_id: user.id, status: "going" });
      if (error) {
        setIsGoing(false);
        toast.error("Could not update RSVP");
      } else {
        toast.success("You're going — only the host sees this");
      }
    }
  };

  const saveEdit = async () => {
    if (!row) return;
    if (!eTitle.trim()) {
      toast.error("Add an event title");
      return;
    }
    setSaving(true);
    try {
      const dollars = Number.parseFloat(ePrice);
      const cap = Number.parseInt(eCapacity, 10);
      const startIso = eStarts ? new Date(eStarts).toISOString() : null;
      const endIso = eEnds ? new Date(eEnds).toISOString() : null;
      const { error } = await (supabase as any)
        .from("event_listings")
        .update({
          title: eTitle.trim(),
          description: eDesc.trim() || null,
          address: eAddress.trim() || null,
          map_url: eAddress.trim()
            ? `https://maps.google.com/?q=${encodeURIComponent(eAddress.trim())}`
            : null,
          price_cents: Number.isFinite(dollars) ? Math.round(dollars * 100) : null,
          starts_at: startIso,
          ends_at: endIso,
          expires_at: endIso || startIso,
          capacity: Number.isFinite(cap) ? cap : null,
        })
        .eq("id", row.id);
      if (error) throw error;
      toast.success("Event updated");
      setEditing(false);
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Could not update event");
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async () => {
    if (!row) return;
    if (!window.confirm("Delete this event? This can't be undone.")) return;
    const { error } = await (supabase as any).from("event_listings").delete().eq("id", row.id);
    if (error) {
      toast.error("Could not delete event");
      return;
    }
    toast.success("Event deleted");
    nav("/events");
  };

  if (!row) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading event…
      </div>
    );
  }

  const isHost = user?.id === row.user_id;
  const price =
    row.price_cents == null
      ? null
      : row.price_cents === 0
        ? "Free"
        : `$${(row.price_cents / 100).toFixed(row.price_cents % 100 === 0 ? 0 : 2)}`;
  const inputClass =
    "h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35";

  return (
    <div className="min-h-screen bg-background pb-32 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => nav("/events")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="truncate text-base font-black">{row.title}</h1>
      </header>
      {row.media_url ? (
        row.media_type === "video" ? (
          <video src={row.media_url} controls playsInline className="max-h-[70vh] w-full bg-black" />
        ) : (
          <img src={row.media_url} alt="" className="max-h-[70vh] w-full bg-black object-contain" />
        )
      ) : null}
      <div className="space-y-3 px-4 py-4">
        {row.description ? <p className="text-sm leading-relaxed">{row.description}</p> : null}
        {formatWhen(row.starts_at) ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            Starts {formatWhen(row.starts_at)}
            {formatWhen(row.ends_at) ? ` · ends ${formatWhen(row.ends_at)}` : ""}
          </p>
        ) : null}
        {price ? <p className="text-sm font-bold text-primary">Ticket / entry: {price}</p> : null}
        {row.capacity ? (
          <p className="text-xs text-muted-foreground">{row.capacity} spots</p>
        ) : null}

        {isHost ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-muted/40 p-3">
              <p className="flex items-center gap-2 text-sm font-black">
                <Users className="h-4 w-4 text-primary" />
                {goingCount} {goingCount === 1 ? "person is" : "people are"} going
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Host-only view — attendees never see this count or who responded.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSharing(true)}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-primary-foreground active:scale-[0.99]"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
              <button
                type="button"
                onClick={() => (editing ? setEditing(false) : startEdit(row))}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-sm font-bold active:scale-[0.99]"
              >
                <Pencil className="h-4 w-4" />
                {editing ? "Cancel" : "Edit"}
              </button>
              <button
                type="button"
                onClick={() => void deleteEvent()}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-sm font-bold text-destructive active:scale-[0.99]"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>

            {editing ? (
              <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
                <input
                  value={eTitle}
                  onChange={(e) => setETitle(e.target.value)}
                  placeholder="Event title"
                  className={inputClass}
                />
                <textarea
                  value={eDesc}
                  onChange={(e) => setEDesc(e.target.value)}
                  placeholder="Event details"
                  rows={3}
                  className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/35"
                />
                <input
                  value={eAddress}
                  onChange={(e) => setEAddress(e.target.value)}
                  placeholder="Address (opens in Maps)"
                  className={inputClass}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={ePrice}
                    onChange={(e) => setEPrice(e.target.value)}
                    placeholder="Price ($, 0 = free)"
                    inputMode="decimal"
                    className={inputClass}
                  />
                  <input
                    value={eCapacity}
                    onChange={(e) => setECapacity(e.target.value)}
                    placeholder="Spots (optional)"
                    inputMode="numeric"
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Starts
                    </span>
                    <input
                      type="datetime-local"
                      value={eStarts}
                      onChange={(e) => setEStarts(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Ends / expires
                    </span>
                    <input
                      type="datetime-local"
                      value={eEnds}
                      onChange={(e) => setEEnds(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveEdit()}
                  className="h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void toggleGoing()}
            className={`h-11 w-full rounded-xl text-sm font-bold active:scale-[0.99] ${
              isGoing ? "border border-border bg-muted text-foreground" : "bg-primary text-primary-foreground"
            }`}
          >
            {isGoing ? "You're going ✓ (tap to undo)" : "Going"}
          </button>
        )}

        {row.address ? (
          <a
            href={row.map_url || `https://maps.google.com/?q=${encodeURIComponent(row.address)}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-bold"
          >
            <MapPin className="h-4 w-4" />
            Open map · {row.address}
          </a>
        ) : null}
      </div>

      {sharing ? <ShareEventSheet event={row} onClose={() => setSharing(false)} /> : null}
    </div>
  );
}
