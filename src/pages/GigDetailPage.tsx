import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo, URGENCY_OPTIONS } from "@/lib/jobs";

type Gig = {
  id: string;
  poster_id: string;
  title: string;
  description: string;
  category: string;
  location: string | null;
  budget_min: number | null;
  budget_max: number | null;
  urgency: string;
  preferred_date: string | null;
  preferred_time: string | null;
  created_at: string;
};

export default function GigDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [gig, setGig] = useState<Gig | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase.from("gig_listings").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      setGig(data as Gig | null);
    });
  }, [id]);

  if (!gig) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const urgency = URGENCY_OPTIONS.find((u) => u.id === gig.urgency)?.label ?? gig.urgency;
  const budget = gig.budget_min || gig.budget_max
    ? `$${gig.budget_min ?? ""}${gig.budget_min && gig.budget_max ? "–" : ""}${gig.budget_max ?? ""}`
    : "Open budget";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border flex items-center px-3 py-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
      </header>

      <div className="p-4 space-y-4 pb-24">
        <h1 className="text-xl font-black tracking-tight">{gig.title}</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          {gig.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {gig.location}</span>}
          <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo(gig.created_at)}</span>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="px-2 py-1 rounded-full bg-primary/10 text-primary font-semibold">{budget}</span>
          <span className="px-2 py-1 rounded-full bg-muted font-semibold">{urgency}</span>
          <span className="px-2 py-1 rounded-full bg-muted font-semibold">{gig.category}</span>
        </div>

        <p className="text-sm whitespace-pre-wrap leading-relaxed">{gig.description}</p>

        {(gig.preferred_date || gig.preferred_time) && (
          <div className="rounded-2xl bg-muted p-3 text-sm">
            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">When</p>
            {gig.preferred_date && <p>{new Date(gig.preferred_date).toLocaleDateString()}</p>}
            {gig.preferred_time && <p className="text-muted-foreground">{gig.preferred_time}</p>}
          </div>
        )}

        <button
          onClick={() => nav("/messages")}
          className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm"
        >
          Message Poster
        </button>
      </div>
    </div>
  );
}
