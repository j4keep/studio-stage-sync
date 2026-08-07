import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, MapPin, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

export default function EventDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [row, setRow] = useState<EventRow | null>(null);
  const [isGoing, setIsGoing] = useState(false);
  const [goingCount, setGoingCount] = useState(0);

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
          <div className="rounded-2xl border border-border bg-muted/40 p-3">
            <p className="flex items-center gap-2 text-sm font-black">
              <Users className="h-4 w-4 text-primary" />
              {goingCount} {goingCount === 1 ? "person is" : "people are"} going
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Host-only view — attendees never see this count or who responded.
            </p>
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
    </div>
  );
}
