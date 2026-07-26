import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  Clock,
  MessageCircle,
  CheckCircle2,
  Pencil,
  Flag,
  Ban,
  Star,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { timeAgo, URGENCY_OPTIONS } from "@/lib/jobs";
import { canRateGig, formatGigBudget, gigHelperId, gigStatusLabel } from "@/lib/gigs";
import { blockUser } from "@/lib/blocks";
import GigProfileCard, { type GigProfileInfo } from "@/components/jobs/GigProfileCard";
import PostGigSheet from "@/components/jobs/PostGigSheet";
import RateGigSheet from "@/components/jobs/RateGigSheet";
import ReportGigSheet from "@/components/jobs/ReportGigSheet";
import BlockConfirmDialog from "@/components/BlockConfirmDialog";

type Gig = {
  id: string;
  poster_id: string;
  assigned_to?: string | null;
  worker_id?: string | null;
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
  status: string;
  hide_yaj_profile?: boolean;
  poster_completed_at?: string | null;
  worker_completed_at?: string | null;
};

export default function GigDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [gig, setGig] = useState<Gig | null>(null);
  const [poster, setPoster] = useState<GigProfileInfo | null>(null);
  const [worker, setWorker] = useState<GigProfileInfo | null>(null);
  const [me, setMe] = useState<GigProfileInfo | null>(null);
  const [hideMyYajPage, setHideMyYajPage] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [ratingsByUser, setRatingsByUser] = useState<Record<string, { avg: number; count: number }>>({});

  const load = async () => {
    if (!id) return;
    const { data } = await (supabase as any).from("gig_listings").select("*").eq("id", id).maybeSingle();
    const row = data as Gig | null;
    setGig(row);
    if (!row) return;

    const helperId = gigHelperId(row);
    const ids = [row.poster_id, helperId].filter(Boolean) as string[];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", ids);
    const map = new Map((profiles || []).map((p) => [p.user_id, p]));
    setPoster(map.get(row.poster_id) || { user_id: row.poster_id, display_name: "Poster", avatar_url: null });
    setWorker(
      helperId
        ? map.get(helperId) || { user_id: helperId, display_name: "Helper", avatar_url: null }
        : null,
    );

    if (ids.length) {
      const { data: ratingRows } = await supabase.from("user_ratings").select("ratee_id, score").in("ratee_id", ids);
      const acc: Record<string, { sum: number; count: number }> = {};
      for (const r of ratingRows || []) {
        const cur = acc[r.ratee_id] || { sum: 0, count: 0 };
        cur.sum += r.score;
        cur.count += 1;
        acc[r.ratee_id] = cur;
      }
      const next: Record<string, { avg: number; count: number }> = {};
      for (const [uid, v] of Object.entries(acc)) {
        next[uid] = { avg: v.sum / v.count, count: v.count };
      }
      setRatingsByUser(next);
    }

    if (user) {
      const { data: rating } = await supabase
        .from("user_ratings")
        .select("score")
        .eq("context_type", "gig")
        .eq("context_id", row.id)
        .eq("rater_id", user.id)
        .maybeSingle();
      setMyRating(rating?.score ?? null);
    }
  };

  useEffect(() => {
    void load();
  }, [id, user]);

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
        setMe({ user_id: data.user_id, display_name: data.display_name, avatar_url: data.avatar_url });
        setHideMyYajPage(Boolean((data as any).hide_yaj_page_on_gigs));
      }
    })();
  }, [user]);

  const saveMyHidePreference = async (hide: boolean) => {
    setHideMyYajPage(hide);
    if (!user) return;
    await (supabase as any).from("profiles").update({ hide_yaj_page_on_gigs: hide }).eq("user_id", user.id);
  };

  const helperId = gig ? gigHelperId(gig) : null;
  const isPoster = Boolean(user && gig && user.id === gig.poster_id);
  const isWorker = Boolean(user && helperId && user.id === helperId);
  const isParty = isPoster || isWorker;
  const otherParty = isPoster ? worker : isWorker ? poster : poster;
  const otherName = otherParty?.display_name || "User";

  const messagePoster = async () => {
    if (!user) return toast.error("Sign in to message the poster");
    if (!gig || !poster) return;
    if (user.id === gig.poster_id) return toast.error("This is your gig");
    setMessaging(true);
    try {
      await (supabase as any).from("profiles").update({ hide_yaj_page_on_gigs: hideMyYajPage }).eq("user_id", user.id);
      // First messenger becomes the assigned helper so both can manage the gig
      if (!gigHelperId(gig)) {
        await (supabase as any)
          .from("gig_listings")
          .update({ assigned_to: user.id, status: "assigned" })
          .eq("id", gig.id)
          .is("assigned_to", null);
      }
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

  const markComplete = async () => {
    if (!user || !gig) return;
    const patch: Record<string, unknown> = {};
    if (isPoster) patch.poster_completed_at = new Date().toISOString();
    if (isWorker) patch.worker_completed_at = new Date().toISOString();
    if (!Object.keys(patch).length) return toast.error("Only gig parties can complete");

    const { error } = await (supabase as any).from("gig_listings").update(patch).eq("id", gig.id);
    if (error) return toast.error(error.message);

    const otherDone = isPoster ? gig.worker_completed_at : gig.poster_completed_at;
    if (otherDone) toast.success("Gig completed — you can rate each other now");
    else toast.success("Marked complete — reminding the other person to press Complete");
    await load();
  };

  const confirmBlock = async () => {
    if (!user || !otherParty) return;
    setBlockBusy(true);
    try {
      await blockUser(user.id, otherParty.user_id);
      toast.success(`${otherName} blocked on all YAJ pages`);
      setBlockOpen(false);
      nav("/jobs");
    } catch (e: any) {
      toast.error(e?.message || "Could not block");
    } finally {
      setBlockBusy(false);
    }
  };

  if (!gig) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const urgency = URGENCY_OPTIONS.find((u) => u.id === gig.urgency)?.label ?? gig.urgency;
  const budget = formatGigBudget(gig.budget_min, gig.budget_max);
  const posterHidesPage = Boolean(gig.hide_yaj_profile);
  const iCompleted = isPoster ? Boolean(gig.poster_completed_at) : isWorker ? Boolean(gig.worker_completed_at) : false;
  const theyCompleted = isPoster ? Boolean(gig.worker_completed_at) : isWorker ? Boolean(gig.poster_completed_at) : false;
  const ratingUnlocked = canRateGig(gig);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur">
        <button type="button" onClick={() => nav(-1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{gigStatusLabel(gig.status)}</span>
        <div className="flex-1" />
        {isPoster && gig.status !== "completed" && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="flex h-9 items-center gap-1 rounded-full bg-muted px-3 text-xs font-bold"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        )}
      </header>

      <div className="space-y-4 p-4 pb-28">
        <h1 className="text-xl font-black tracking-tight">{gig.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {gig.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {gig.location}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {timeAgo(gig.created_at)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary">{budget}</span>
          <span className="rounded-full bg-muted px-2 py-1 font-semibold">{urgency}</span>
          <span className="rounded-full bg-muted px-2 py-1 font-semibold">{gig.category}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <GigProfileCard
            label={isPoster ? "Your profile on this gig" : "Posted by"}
            profile={poster}
            hideYajPage={posterHidesPage}
            ratingAvg={poster ? ratingsByUser[poster.user_id]?.avg : null}
            ratingCount={poster ? ratingsByUser[poster.user_id]?.count : null}
            onOpenProfile={poster && !posterHidesPage && !isPoster ? () => nav(`/artist/${poster.user_id}`) : undefined}
          />
          {worker && (
            <GigProfileCard
              label={isWorker ? "Your profile (helper)" : "Helper"}
              profile={worker}
              hideYajPage={false}
              ratingAvg={ratingsByUser[worker.user_id]?.avg}
              ratingCount={ratingsByUser[worker.user_id]?.count}
              onOpenProfile={!isWorker ? () => nav(`/artist/${worker.user_id}`) : undefined}
            />
          )}
          {user && !isPoster && !isWorker && (
            <GigProfileCard
              label="Your profile (visible to poster)"
              profile={me}
              hideYajPage={hideMyYajPage}
              ratingAvg={me ? ratingsByUser[me.user_id]?.avg : null}
              ratingCount={me ? ratingsByUser[me.user_id]?.count : null}
              onToggleHide={saveMyHidePreference}
              toggleLabel="Hide my YAJ page — poster only sees your picture and name"
            />
          )}
        </div>

        <p className="whitespace-pre-wrap text-sm leading-relaxed">{gig.description}</p>

        {(gig.preferred_date || gig.preferred_time) && (
          <div className="rounded-2xl bg-muted p-3 text-sm">
            <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">When</p>
            {gig.preferred_date && <p>{new Date(gig.preferred_date).toLocaleDateString()}</p>}
            {gig.preferred_time && <p className="text-muted-foreground">{gig.preferred_time}</p>}
          </div>
        )}

        {isParty && theyCompleted && !iCompleted && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <p className="font-bold text-amber-700 dark:text-amber-300">The other person marked this gig complete</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Press Complete below so you can both leave ratings.
            </p>
          </div>
        )}

        {ratingUnlocked && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            <p className="font-bold text-emerald-700 dark:text-emerald-300">Gig completed</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {myRating ? `You rated them ${myRating}/5.` : "Both sides finished — rate each other."}
            </p>
          </div>
        )}

        <div className="space-y-2">
          {!isPoster && !isWorker && (
            <button
              type="button"
              onClick={() => void messagePoster()}
              disabled={messaging}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              <MessageCircle className="h-4 w-4" />
              {messaging ? "Opening…" : "Message & join gig"}
            </button>
          )}

          {isParty && otherParty && (
            <button
              type="button"
              onClick={() =>
                nav("/messages", {
                  state: {
                    startWithUserId: otherParty.user_id,
                    startWithProfile: otherParty,
                    gigId: gig.id,
                    gigTitle: gig.title,
                  },
                })
              }
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm font-bold"
            >
              <MessageCircle className="h-4 w-4" /> Message
            </button>
          )}

          {isParty && !iCompleted && gig.status !== "closed" && gig.status !== "cancelled" && (
            <button
              type="button"
              onClick={() => void markComplete()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-bold text-white"
            >
              <CheckCircle2 className="h-4 w-4" /> Complete gig
            </button>
          )}

          {ratingUnlocked && isParty && otherParty && !myRating && (
            <button
              type="button"
              onClick={() => setRateOpen(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-sm font-bold text-amber-700 dark:text-amber-300"
            >
              <Star className="h-4 w-4" /> Rate {otherName}
            </button>
          )}

          {isParty && otherParty && (
            <>
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-muted text-xs font-bold"
              >
                <Flag className="h-3.5 w-3.5" /> Report an issue to YAJ
              </button>
              <button
                type="button"
                onClick={() => setBlockOpen(true)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 text-xs font-bold text-destructive"
              >
                <Ban className="h-3.5 w-3.5" /> Block {otherName}
              </button>
            </>
          )}
        </div>
      </div>

      <PostGigSheet open={editOpen} onClose={() => setEditOpen(false)} onCreated={() => void load()} gigToEdit={gig} />
      {user && otherParty && (
        <>
          <RateGigSheet
            open={rateOpen}
            onClose={() => setRateOpen(false)}
            gigId={gig.id}
            raterId={user.id}
            rateeId={otherParty.user_id}
            rateeName={otherName}
            onRated={() => void load()}
          />
          <ReportGigSheet
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            gigId={gig.id}
            reporterId={user.id}
            reportedId={otherParty.user_id}
          />
          <BlockConfirmDialog
            open={blockOpen}
            name={otherName}
            loading={blockBusy}
            onClose={() => setBlockOpen(false)}
            onConfirm={() => void confirmBlock()}
          />
        </>
      )}
    </div>
  );
}
