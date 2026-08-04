import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
};

export default function EventDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [row, setRow] = useState<EventRow | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const { data } = await (supabase as any)
        .from("event_listings")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      setRow((data as EventRow) || null);
    })();
  }, [id]);

  if (!row) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading event…
      </div>
    );
  }

  const price =
    row.price_cents == null
      ? null
      : `$${(row.price_cents / 100).toFixed(row.price_cents % 100 === 0 ? 0 : 2)}`;

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
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
          <img src={row.media_url} alt="" className="max-h-[70vh] w-full object-contain bg-black" />
        )
      ) : null}
      <div className="space-y-3 px-4 py-4">
        {row.description ? <p className="text-sm leading-relaxed">{row.description}</p> : null}
        {price ? <p className="text-sm font-bold text-primary">Ticket / entry: {price}</p> : null}
        {row.starts_at ? (
          <p className="text-xs text-muted-foreground">
            {new Date(row.starts_at).toLocaleString()}
          </p>
        ) : null}
        {row.address ? (
          <a
            href={row.map_url || `https://maps.google.com/?q=${encodeURIComponent(row.address)}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground"
          >
            <MapPin className="h-4 w-4" />
            Open map · {row.address}
          </a>
        ) : null}
      </div>
    </div>
  );
}
