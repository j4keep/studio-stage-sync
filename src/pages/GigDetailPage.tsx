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
  UserCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { timeAgo, URGENCY_OPTIONS } from "@/lib/jobs";
import { canRateGig, formatGigBudget, gigHelperId, gigStatusLabel } from "@/lib/gigs";
import { fetchRatingsByUserIds, type DisplayRating } from "@/lib/ratings";
import { approveGigHelper, listGigInterests, type GigInterest } from "@/lib/gig-interests";
import { blockUser } from "@/lib/blocks";
import GigProfileCard, { type GigProfileInfo } from "@/components/jobs/GigProfileCard";
import GigInterestSheet from "@/components/jobs/GigInterestSheet";
import PostGigSheet from "@/components/jobs/PostGigSheet";
import RateGigSheet from "@/components/jobs/RateGigSheet";
import ReportGigSheet from "@/components/jobs/ReportGigSheet";
import BlockConfirmDialog from "@/components/BlockConfirmDialog";
import UserRatingStars from "@/components/UserRatingStars";

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
  const [myBio, setMyBio] = useState("");
  const [interestOpen, setInterestOpen] = useState(false);
  const [interests, setInterests] = useState<GigInterest[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [ratingsByUser, setRatingsByUser] = useState<Record<string, DisplayRating>>({});

  const load = async () => {
    if (!id) return;
    const { data } = await (supabase as any).from("gig_listings").select("*").eq("id", id).maybeSingle();
    const row = data as Gig | null;
    setGig(row);
    if (!row) return;

    const helperId = gigHelperId(row);
    const ids = [row.poster_id, helperId, user?.id].filter(Boolean) as string[];
    let profiles: any[] | null = null;
    {
      const res = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, gig_experience_bio")
        .in("user_id", ids);
      if (res.error) {
        const fallback = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", ids);
        profiles = fallback.data;
      } else {
        profiles = res.data;
      }
    }
    const map = new Map((profiles || []).map((p: any) => [p.user_id, p]));
    const posterRow = map.get(row.poster_id);
    setPoster({
      user_id: row.poster_id,
      display_name: posterRow?.display_name || "Poster",
      avatar_url: posterRow?.avatar_url || null,
      gig_experience_bio: posterRow?.gig_experience_bio || null,
    });
    setWorker(
      helperId
        ? {
            user_id: helperId,
            display_name: map.get(helperId)?.display_name || "Helper",
            avatar_url: map.get(helperId)?.avatar_url || null,
            gig_experience_bio: map.get(helperId)?.gig_experience_bio || null,
          }
        : null,
    );

    if (ids.length) setRatingsByUser(await fetchRatingsByUserIds(ids));

    if (user?.id === row.poster_id && row.status === "open") {
      try {
        const list = await listGigInterests(row.id);
        setInterests(list.filter((i) => i.status === "interested" || i.status === "approved"));
        const moreIds = list.map((i) => i.user_id);
        if (moreIds.length) {
          const moreRatings = await fetchRatingsByUserIds(moreIds);
          setRatingsByUser((prev) => ({ ...prev, ...moreRatings }));
        }
      } catch {
        setInterests([]);
      }
    } else {
      setInterests([]);
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
      let data: any = null;
      const full = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, hide_yaj_page_on_gigs, gig_experience_bio")
        .eq("user_id", user.id)
        .maybeSingle();
      if (full.error) {
        const basic = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url, hide_yaj_page_on_gigs")
          .eq("user_id", user.id)
          .maybeSingle();
        data = basic.data;
      } else {
        data = full.data;
      }
      if (data) {
        setMe({
          user_id: data.user_id,
          display_name: data.display_name,
          avatar_url: data.avatar_url,
          gig_experience_bio: data.gig_experience_bio || null,
        });
        setHideMyYajPage(Boolean(data.hide_yaj_page_on_gigs));
        setMyBio(data.gig_experience_bio || "");
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
  const hasHelper = Boolean(helperId);
  const isOpen = gig?.status === "open";
  const canComplete =
    isParty &&
    hasHelper &&
    !["open", "completed", "closed", "cancelled"].includes(gig?.status || "");
  const otherParty = isPoster ? worker : isWorker ? poster : poster;
  const otherName = otherParty?.display_name || "User";

  const openMessageWith = (person: GigProfileInfo, hideOther?: boolean) => {
    if (!gig) return;
    nav("/messages", {
      state: {
        startWithUserId: person.user_id,
        startWithProfile: person,
        hideOtherYajPage: hideOther,
        hideMyYajPage,
        gigId: gig.id,
        gigTitle: gig.title,
      },
    });
  };

  const onInterestReady = (bio: string) => {
    setMyBio(bio);
    setMe((prev) => (prev ? { ...prev, gig_experience_bio: bio } : prev));
    if (poster) openMessageWith(poster, Boolean(gig?.hide_yaj_profile));
  };

  const handleApprove = async (interest: GigInterest) => {
    if (!user || !gig) return;
    setApprovingId(interest.user_id);
    try {
      await approveGigHelper({ gigId: gig.id, posterId: user.id, helperId: interest.user_id });
      toast.success(`${interest.display_name || "Helper"} approved — gig left Opportunities`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not approve");
    } finally {
      setApprovingId(null);
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
            rating={poster ? ratingsByUser[poster.user_id] : null}
            onOpenProfile={poster && !posterHidesPage && !isPoster ? () => nav(`/artist/${poster.user_id}`) : undefined}
          />
          {worker && (
            <GigProfileCard
              label={isWorker ? "Your profile (helper)" : "Approved helper"}
              profile={worker}
              hideYajPage={false}
              rating={ratingsByUser[worker.user_id]}
              onOpenProfile={!isWorker ? () => nav(`/artist/${worker.user_id}`) : undefined}
            />
          )}
          {user && !isPoster && !isWorker && (
            <GigProfileCard
              label="Your profile (visible to poster)"
              profile={me}
              hideYajPage={hideMyYajPage}
              rating={me ? ratingsByUser[me.user_id] : null}
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

        {isPoster && isOpen && (
          <div className="space-y-2">
            <h2 className="text-sm font-bold">Interested people</h2>
            <p className="text-xs text-muted-foreground">
              Message them, then Approve the right fit. The gig stays on Opportunities until you approve someone.
            </p>
            {interests.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                No one has messaged yet
              </p>
            ) : (
              interests.map((interest) => (
                <div key={interest.id} className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted">
                      {interest.avatar_url ? (
                        <img src={interest.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                          {(interest.display_name || "?")[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{interest.display_name || "User"}</p>
                      <UserRatingStars rating={ratingsByUser[interest.user_id]} variant="compact" className="mt-0.5" />
                      {interest.experience_bio ? (
                        <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{interest.experience_bio}</p>
                      ) : (
                        <p className="mt-1 text-[11px] text-muted-foreground">No experience bio yet</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        openMessageWith({
                          user_id: interest.user_id,
                          display_name: interest.display_name || "User",
                          avatar_url: interest.avatar_url || null,
                          gig_experience_bio: interest.experience_bio,
                        })
                      }
                      className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-muted text-xs font-bold"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Message
                    </button>
                    <button
                      type="button"
                      disabled={approvingId === interest.user_id}
                      onClick={() => void handleApprove(interest)}
                      className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-xs font-bold text-primary-foreground disabled:opacity-50"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      {approvingId === interest.user_id ? "…" : "Approve"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {isParty && theyCompleted && !iCompleted && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <p className="font-bold text-amber-700 dark:text-amber-300">The other person marked this gig complete</p>
            <p className="mt-1 text-xs text-muted-foreground">Press Complete below so you can both leave ratings.</p>
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
          {user && !isPoster && !isWorker && isOpen && (
            <button
              type="button"
              onClick={() => setInterestOpen(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground"
            >
              <MessageCircle className="h-4 w-4" /> Message host
            </button>
          )}

          {isParty && otherParty && (
            <button
              type="button"
              onClick={() => openMessageWith(otherParty)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm font-bold"
            >
              <MessageCircle className="h-4 w-4" /> Message
            </button>
          )}

          {canComplete && !iCompleted && (
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

      {user && (
        <GigInterestSheet
          open={interestOpen}
          onClose={() => setInterestOpen(false)}
          gigId={gig.id}
          userId={user.id}
          gigTitle={gig.title}
          initialBio={myBio}
          onReadyToMessage={onInterestReady}
        />
      )}

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
