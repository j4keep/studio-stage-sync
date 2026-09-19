import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Lock,
  Plus,
  Radio,
  Settings,
  Share2,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Circle,
  CircleMember,
  getMyMembership,
  getCircle,
  updateCircle,
  countPendingMembers,
  CIRCLE_TYPE_META,
} from "@/lib/circles";
import { CircleLiveSession, getActiveLiveSession } from "@/lib/circle-live";
import { supabase } from "@/integrations/supabase/client";
import CircleJoinButton from "@/components/circle/CircleJoinButton";
import CircleTopFansWheel from "@/components/circle/CircleTopFansWheel";
import CircleMemberManagement from "@/components/circle/CircleMemberManagement";
import CircleCoverCreator from "@/components/circle/CircleCoverCreator";
import CircleCreatePostSheet from "@/components/circle/CircleCreatePostSheet";
import CircleContentFeed from "@/components/circle/CircleContentFeed";
import CircleExclusiveArea from "@/components/circle/CircleExclusiveArea";
import CircleDonationTab from "@/components/circle/CircleDonationTab";
import LiveCameraView from "@/components/feed/create/LiveCameraView";

type Tab = "home" | "exclusive" | "members" | "about" | "donate";

export default function CirclePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [circle, setCircle] = useState<Circle | null | undefined>(undefined);
  const [membership, setMembership] = useState<CircleMember | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [pendingCount, setPendingCount] = useState(0);
  const [liveSession, setLiveSession] = useState<CircleLiveSession | null>(null);
  const [showLivePrep, setShowLivePrep] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [contentRefresh, setContentRefresh] = useState(0);

  const load = () => {
    if (!id) return;
    void getCircle(id).then(setCircle).catch(() => setCircle(null));
    if (user?.id) void getMyMembership(id, user.id).then(setMembership).catch(() => setMembership(null));
  };

  useEffect(load, [id, user?.id]);

  useEffect(() => {
    if (!circle || !user?.id) {
      setPendingCount(0);
      return;
    }
    const admin =
      user.id === circle.owner_id ||
      (membership?.status === "approved" && (membership.role === "owner" || membership.role === "admin"));
    if (!admin) {
      setPendingCount(0);
      return;
    }
    void countPendingMembers(circle.id).then(setPendingCount).catch(() => setPendingCount(0));
  }, [circle, membership, user?.id]);

  useEffect(() => {
    if (!circle) return;
    void getActiveLiveSession(circle.id, { exclusive: false }).then(setLiveSession).catch(() => setLiveSession(null));
    const channel = supabase
      .channel(`circle-live-${circle.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_live_sessions", filter: `circle_id=eq.${circle.id}` },
        () => void getActiveLiveSession(circle.id, { exclusive: false }).then(setLiveSession).catch(() => setLiveSession(null)),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [circle?.id]);

  if (circle === undefined) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-border border-t-foreground" />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">Opening Circle</span>
        </div>
      </div>
    );
  }

  if (!circle) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Users className="h-7 w-7" />
        </div>
        <p className="text-xl font-black tracking-tight">This Circle isn't available.</p>
        <button type="button" onClick={() => navigate("/circle")} className="rounded-full bg-foreground px-5 py-3 text-sm font-black text-background">
          Back to My Circle
        </button>
      </div>
    );
  }

  const isOwner = user?.id === circle.owner_id;
  const isApprovedMember = isOwner || membership?.status === "approved";
  const isAdmin =
    isOwner ||
    (membership?.status === "approved" && (membership.role === "owner" || membership.role === "admin"));
  const meta = CIRCLE_TYPE_META[circle.type];
  const canCreate = Boolean(user?.id && (isOwner || (isApprovedMember && circle.member_posting_allowed)));

  if (isOwner && circle.is_personal && !circle.cover_url && user?.id) {
    return (
      <CircleCoverCreator
        userId={user.id}
        circleName={circle.name}
        fullScreen
        onSaved={(url) => void updateCircle(circle.id, { coverUrl: url }).then(load)}
      />
    );
  }

  const handleGoLive = () => {
    if (!user?.id) {
      toast({ title: "Sign in required", description: "Log in to go live from your Circle.", variant: "destructive" });
      return;
    }
    setShowLivePrep(true);
  };

  const shareCircle = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: circle.name, text: `Join ${circle.name} on YAJ`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Circle link copied" });
      }
    } catch {
      // Native share sheets can be dismissed.
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "exclusive", label: "Exclusive" },
    ...(isAdmin ? [{ id: "members" as Tab, label: "Members" }] : []),
    { id: "about", label: "About" },
    { id: "donate", label: "Support" },
  ];

  return (
    <div className="min-h-[100dvh] bg-background pb-28 text-foreground transition-colors">
      <section className="relative h-[34dvh] min-h-[260px] max-h-[420px] overflow-hidden bg-muted">
        {circle.cover_url ? (
          <img src={circle.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-fuchsia-700 to-orange-500" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/25" />

        <div className="relative z-10 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-xl"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void shareCircle()}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-xl"
              aria-label="Share Circle"
            >
              <Share2 className="h-4.5 w-4.5" />
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={() => navigate(`/circle/c/${circle.id}/settings`)}
                aria-label="Circle settings"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-xl"
              >
                <Settings className="h-4.5 w-4.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="px-4 pt-5">
        <h1 className="max-w-[92%] text-[34px] font-black leading-[0.98] tracking-[-0.045em] sm:text-[42px]">
          {circle.name}
        </h1>
        <div className="mt-3 flex items-center gap-4 text-[12px] font-bold text-muted-foreground">
          <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {circle.member_count} members</span>
          {circle.city ? <span>{circle.city}</span> : null}
        </div>

        {circle.description ? (
          <p className="mt-4 max-w-xl text-[14px] font-medium leading-relaxed text-muted-foreground">{circle.description}</p>
        ) : (
          <p className="mt-4 text-[14px] font-medium leading-relaxed text-muted-foreground">Your people, posts, lives and experiences in one place.</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {user?.id && <CircleJoinButton circle={circle} userId={user.id} membership={membership} isOwner={isOwner} onChanged={load} />}

          {tab === "home" && canCreate && (
            <button
              type="button"
              onClick={() => setShowCreatePost(true)}
              className="flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-[13px] font-black text-background active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" /> Post
            </button>
          )}

          {tab === "home" && isOwner && !liveSession && (
            <button
              type="button"
              onClick={handleGoLive}
              className="flex h-11 items-center gap-2 rounded-full bg-red-600 px-5 text-[13px] font-black text-white active:scale-[0.98]"
            >
              <Radio className="h-4 w-4" /> Go Live
            </button>
          )}

          {tab === "home" && liveSession && isApprovedMember && (
            <button
              type="button"
              onClick={() => navigate(`/circle/c/${circle.id}/live`)}
              className="flex h-11 items-center gap-2 rounded-full bg-red-600 px-5 text-[13px] font-black text-white active:scale-[0.98]"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              {liveSession.host_user_id === user?.id ? "You're Live" : "Watch Live"}
            </button>
          )}
        </div>
      </section>

      <section className="mt-6 px-4">
        <div className="overflow-hidden rounded-[28px] border border-border bg-gradient-to-br from-violet-600/20 via-fuchsia-500/10 to-orange-400/10 p-5 shadow-xl dark:from-violet-600/35 dark:via-fuchsia-500/20 dark:to-orange-400/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Circle Events
              </div>
              <h2 className="mt-2 text-[27px] font-black leading-none tracking-[-0.04em]">Show up together.</h2>
              <p className="mt-2 max-w-xs text-[12px] font-medium leading-relaxed text-muted-foreground">
                Discover podcasts, private gatherings, workshops, live experiences and more.
              </p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background">
              <CalendarDays className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => navigate("/events")}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-foreground text-[12px] font-black text-background active:scale-[0.98]"
            >
              Browse events <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate(isOwner ? "/pro/events" : "/events")}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-card/70 text-[12px] font-black text-foreground active:scale-[0.98]"
            >
              <Ticket className="h-4 w-4" /> {isOwner ? "Host event" : "RSVP & tickets"}
            </button>
          </div>
        </div>
      </section>

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-border px-4 scrollbar-none">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative shrink-0 border-b-2 px-4 py-3 text-[12px] font-black transition ${
              tab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"
            }`}
          >
            {t.label}
            {t.id === "members" && pendingCount > 0 && (
              <span className="absolute -right-0.5 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {tab === "home" && (
        <>
          <CircleTopFansWheel circle={circle} isOwner={isOwner} onCreateAvatar={() => navigate(`/circle/c/${circle.id}/settings`)} />
          {isApprovedMember || !circle.is_private ? (
            <section className="mt-2">
              <div className="px-4 pb-2 pt-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">From this Circle</p>
                <h2 className="mt-1 text-[27px] font-black tracking-[-0.04em]">Latest</h2>
              </div>
              <CircleContentFeed
                circleId={circle.id}
                userId={user?.id}
                canInteract={isApprovedMember}
                refreshKey={contentRefresh}
                emptyLabel="No posts yet."
              />
            </section>
          ) : (
            <div className="mx-4 mt-6 flex flex-col items-center gap-3 rounded-[28px] border border-border bg-card px-8 py-12 text-center">
              <Lock className="h-8 w-8 text-muted-foreground" />
              <h2 className="text-lg font-black">Private Circle</h2>
              <p className="max-w-xs text-[13px] font-medium text-muted-foreground">
                {circle.welcome_message || "Request to join to see posts and everything inside this Circle."}
              </p>
            </div>
          )}
        </>
      )}

      {tab === "exclusive" && (
        <CircleExclusiveArea
          circle={circle}
          membership={membership}
          userId={user?.id}
          isOwner={isOwner}
          canCreate={canCreate}
          onCircleChanged={load}
        />
      )}

      {tab === "donate" && <CircleDonationTab circle={circle} userId={user?.id} canDonate={isApprovedMember} />}

      {!isApprovedMember && circle.is_private ? (
        tab !== "home" && tab !== "exclusive" && tab !== "donate" && (
          <div className="mx-4 mt-6 flex flex-col items-center gap-3 rounded-[28px] border border-border bg-card px-8 py-14 text-center">
            <Lock className="h-9 w-9 text-muted-foreground" />
            <h2 className="text-lg font-black">This is a private Circle</h2>
            <p className="max-w-xs text-[13px] text-muted-foreground">
              {circle.welcome_message || "Request to join to see everything inside this Circle."}
            </p>
          </div>
        )
      ) : (
        <>
          {tab === "members" && isAdmin && <CircleMemberManagement circle={circle} onChanged={load} />}
          {tab === "about" && (
            <div className="mx-4 mt-5 space-y-1 overflow-hidden rounded-[24px] border border-border bg-card px-4 py-2 text-[13px]">
              <Row label="Type" value={meta.label} />
              {circle.city && <Row label="City" value={circle.city} />}
              {circle.category && <Row label="Category" value={circle.category} />}
              <Row label="Members" value={String(circle.member_count)} />
              <Row label="Visibility" value={circle.is_discoverable ? "Discoverable" : "Hidden"} />
              <Row label="Joining" value={circle.requires_approval ? "Requires approval" : "Open"} />
            </div>
          )}
        </>
      )}

      {user?.id && (
        <CircleCreatePostSheet
          open={showCreatePost}
          onClose={() => setShowCreatePost(false)}
          circleId={circle.id}
          userId={user.id}
          onCreated={() => {
            setContentRefresh((n) => n + 1);
            setTab("home");
          }}
        />
      )}

      {showLivePrep &&
        createPortal(
          <div className="fixed inset-0 z-[10000] bg-black">
            <LiveCameraView
              createMode="live"
              onModeChange={(mode) => {
                if (mode === "post") {
                  setShowLivePrep(false);
                  setShowCreatePost(true);
                }
              }}
              onClose={() => setShowLivePrep(false)}
              circleId={circle.id}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3 last:border-b-0">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="font-black text-foreground">{value}</span>
    </div>
  );
}
