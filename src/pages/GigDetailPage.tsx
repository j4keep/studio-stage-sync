import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { timeAgo, URGENCY_OPTIONS } from "@/lib/jobs";
import GigProfileCard, { type GigProfileInfo } from "@/components/jobs/GigProfileCard";

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
  hide_yaj_profile?: boolean;
};

export default function GigDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [gig, setGig] = useState<Gig | null>(null);
  const [poster, setPoster] = useState<GigProfileInfo | null>(null);
  const [me, setMe] = useState<GigProfileInfo | null>(null);
  const [hideMyYajPage, setHideMyYajPage] = useState(false);
  const [messaging, setMessaging] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const { data } = await (supabase as any).from("gig_listings").select("*").eq("id", id).maybeSingle();
      const row = data as Gig | null;
      setGig(row);
      if (!row?.poster_id) return;

      const { data: posterProfile } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .eq("user_id", row.poster_id)
        .maybeSingle();
      setPoster(
        posterProfile || {
          user_id: row.poster_id,
          display_name: "Poster",
          avatar_url: null,
        },
      );
    })();
  }, [id]);

  useEffect(() => {
    if (!user) {
      setMe(null);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, hide_yaj_page_on_gigs")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setMe({
          user_id: data.user_id,
          display_name: data.display_name,
          avatar_url: data.avatar_url,
        });
        setHideMyYajPage(Boolean((data as any).hide_yaj_page_on_gigs));
      } else {
        setMe({
          user_id: user.id,
          display_name: user.email?.split("@")[0] || "You",
          avatar_url: null,
        });
      }
    })();
  }, [user]);

  const saveMyHidePreference = async (hide: boolean) => {
    setHideMyYajPage(hide);
    if (!user) return;
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ hide_yaj_page_on_gigs: hide })
      .eq("user_id", user.id);
    if (error) toast.error(error.message);
  };

  const messagePoster = async () => {
    if (!user) {
      toast.error("Sign in to message the poster");
      return;
    }
    if (!gig || !poster) return;
    if (user.id === gig.poster_id) {
      toast.error("This is your gig");
      return;
    }
    setMessaging(true);
    try {
      await (supabase as any)
        .from("profiles")
        .update({ hide_yaj_page_on_gigs: hideMyYajPage })
        .eq("user_id", user.id);

      nav("/messages", {
        state: {
          startWithUserId: gig.poster_id,
          startWithProfile: poster,
          hideOtherYajPage: Boolean(gig.hide_yaj_profile),
          hideMyYajPage,
          gigId: gig.id,
          gigTitle: gig.title,
        },
      });
    } finally {
      setMessaging(false);
    }
  };

  if (!gig) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const urgency = URGENCY_OPTIONS.find((u) => u.id === gig.urgency)?.label ?? gig.urgency;
  const budget = gig.budget_min || gig.budget_max
    ? `$${gig.budget_min ?? ""}${gig.budget_min && gig.budget_max ? "–" : ""}${gig.budget_max ?? ""}`
    : "Open budget";
  const isOwnGig = Boolean(user && user.id === gig.poster_id);
  const posterHidesPage = Boolean(gig.hide_yaj_profile);

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

        <div className="grid gap-3 sm:grid-cols-2">
          <GigProfileCard
            label={isOwnGig ? "Your profile on this gig" : "Posted by"}
            profile={poster}
            hideYajPage={posterHidesPage}
            onOpenProfile={
              poster && !posterHidesPage && !isOwnGig
                ? () => nav(`/artist/${poster.user_id}`)
                : undefined
            }
          />
          {user && !isOwnGig && (
            <GigProfileCard
              label="Your profile (visible to poster)"
              profile={me}
              hideYajPage={hideMyYajPage}
              onToggleHide={saveMyHidePreference}
              toggleLabel="Hide my YAJ page — poster only sees your picture and name"
              onOpenProfile={
                me && !hideMyYajPage ? () => nav(`/artist/${me.user_id}`) : undefined
              }
            />
          )}
        </div>

        <p className="text-sm whitespace-pre-wrap leading-relaxed">{gig.description}</p>

        {(gig.preferred_date || gig.preferred_time) && (
          <div className="rounded-2xl bg-muted p-3 text-sm">
            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">When</p>
            {gig.preferred_date && <p>{new Date(gig.preferred_date).toLocaleDateString()}</p>}
            {gig.preferred_time && <p className="text-muted-foreground">{gig.preferred_time}</p>}
          </div>
        )}

        {!isOwnGig && (
          <button
            onClick={() => void messagePoster()}
            disabled={messaging}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
          >
            {messaging ? "Opening…" : "Message Poster"}
          </button>
        )}
      </div>
    </div>
  );
}
