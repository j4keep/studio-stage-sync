import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Lock, Radio, Settings, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Circle, CircleMember, getMyMembership, getCircle, updateCircle, countPendingMembers } from "@/lib/circles";
import { CIRCLE_TYPE_META } from "@/lib/circles";
import { CircleLiveSession, getActiveLiveSession } from "@/lib/circle-live";
import { supabase } from "@/integrations/supabase/client";
import CircleJoinButton from "@/components/circle/CircleJoinButton";
import CircleTopFansWheel from "@/components/circle/CircleTopFansWheel";
import CircleMemberManagement from "@/components/circle/CircleMemberManagement";
import CircleCoverCreator from "@/components/circle/CircleCoverCreator";
import LiveCameraView from "@/components/feed/create/LiveCameraView";

type Tab = "home" | "posts" | "videos" | "members" | "about";

export default function CirclePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [circle, setCircle] = useState<Circle | null | undefined>(undefined);
  const [membership, setMembership] = useState<CircleMember | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [pendingCount, setPendingCount] = useState(0);
  const [liveSession, setLiveSession] = useState<CircleLiveSession | null>(null);
  /** Owner prep overlay — same get-ready camera as Post → Live, scoped to this Circle. */
  const [showLivePrep, setShowLivePrep] = useState(false);

  const load = () => {
    if (!id) return;
    void getCircle(id)
      .then(setCircle)
      .catch(() => setCircle(null));
    if (user?.id && id) void getMyMembership(id, user.id).then(setMembership).catch(() => setMembership(null));
  };

  useEffect(load, [id, user?.id]);

  // Kept as its own effect (not part of the `isAdmin` computed below) so the "you have
  // pending requests" badge is visible on any tab — not just after opening Members —
  // per the user's explicit ask not to have to hunt for it.
  useEffect(() => {
    if (!circle || !user?.id) {
      setPendingCount(0);
      return;
    }
    const admin = user.id === circle.owner_id || (membership?.status === "approved" && (membership.role === "owner" || membership.role === "admin"));
    if (!admin) {
      setPendingCount(0);
      return;
    }
    void countPendingMembers(circle.id).then(setPendingCount).catch(() => setPendingCount(0));
  }, [circle, membership, user?.id]);

  // Realtime so members see "went live" / "ended" without refreshing — RLS already
  // limits this to circles you're actually approved in (or own).
  useEffect(() => {
    if (!circle) return;
    void getActiveLiveSession(circle.id).then(setLiveSession).catch(() => setLiveSession(null));
    const channel = supabase
      .channel(`circle-live-${circle.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_live_sessions", filter: `circle_id=eq.${circle.id}` },
        () => void getActiveLiveSession(circle.id).then(setLiveSession).catch(() => setLiveSession(null)),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [circle?.id]);

  if (circle === undefined) {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-background text-muted-foreground">Loading…</div>;
  }
  if (!circle) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="font-bold">This Circle isn't available.</p>
        <button type="button" onClick={() => navigate("/circle")} className="rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
          Back to My Circle
        </button>
      </div>
    );
  }

  const isOwner = user?.id === circle.owner_id;
  const isApprovedMember = isOwner || membership?.status === "approved";
  const isAdmin = isOwner || (membership?.status === "approved" && (membership.role === "owner" || membership.role === "admin"));
  const meta = CIRCLE_TYPE_META[circle.type];

  if (isOwner && circle.is_personal && !circle.cover_url && user?.id) {
    return (
      <CircleCoverCreator
        userId={user.id}
        circleName={circle.name}
        fullScreen
        onSaved={(url) => {
          void updateCircle(circle.id, { coverUrl: url }).then(load);
        }}
      />
    );
  }

  const handleGoLive = () => {
    if (!user?.id) {
      toast({ title: "Sign in required", description: "Log in to go live from your Circle.", variant: "destructive" });
      return;
    }
    // Open get-ready camera (Flip / Enhance / Effects / Face) — do NOT start the
    // session until the user confirms Go Live inside LiveCameraView with this circleId.
    setShowLivePrep(true);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "posts", label: "Posts" },
    { id: "videos", label: "Videos" },
    ...(isAdmin ? [{ id: "members" as Tab, label: "Members" }] : []),
    { id: "about", label: "About" },
  ];

  return (
    <div className="min-h-[100dvh] bg-background pb-24 text-foreground">
      <div className="relative h-40 w-full bg-muted">
        {circle.cover_url ? (
          <img src={circle.cover_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl">{meta.emoji}</div>
        )}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute left-3 top-[max(env(safe-area-inset-top),0.75rem)] rounded-full bg-black/50 p-2 text-white backdrop-blur-sm"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        {isOwner && (
          <button
            type="button"
            onClick={() => navigate(`/circle/c/${circle.id}/settings`)}
            aria-label="Circle settings"
            className="absolute right-3 top-[max(env(safe-area-inset-top),0.75rem)] rounded-full bg-black/50 p-2 text-white backdrop-blur-sm"
          >
            <Settings className="h-4.5 w-4.5" />
          </button>
        )}
      </div>

      <div className="px-4">
        {/* Only the small avatar overlaps the cover photo — the name and stats always
            render in clear space below it, so they're never covered by the image. */}
        <div className="-mt-8 h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-4 border-background bg-card shadow">
          {circle.avatar_url ? <img src={circle.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl">{meta.emoji}</div>}
        </div>
        <div className="mt-2 min-w-0">
          <h1 className="truncate text-lg font-black">{circle.name}</h1>
          <p className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
            <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> {circle.member_count}</span>
            {circle.is_private && <span className="flex items-center gap-0.5"><Lock className="h-3 w-3" /> Private</span>}
            <span>{meta.label}</span>
          </p>
        </div>

        {circle.description && <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{circle.description}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {user?.id && <CircleJoinButton circle={circle} userId={user.id} membership={membership} isOwner={isOwner} onChanged={load} />}

          {isOwner && !liveSession && (
            <button
              type="button"
              onClick={handleGoLive}
              className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-[12.5px] font-black text-white active:scale-95"
            >
              <Radio className="h-3.5 w-3.5" />
              Go Live
            </button>
          )}

          {liveSession && isApprovedMember && (
            <button
              type="button"
              onClick={() => navigate(`/circle/c/${circle.id}/live`)}
              className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-[12.5px] font-black text-white active:scale-95"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              {liveSession.host_user_id === user?.id ? "You're Live" : "Watch Live"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-1 border-b border-border px-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative px-3 py-2.5 text-[12.5px] font-bold border-b-2 transition ${
              tab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"
            }`}
          >
            {t.label}
            {t.id === "members" && pendingCount > 0 && (
              <span className="absolute -right-1 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-black text-destructive-foreground">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "home" && (
        <CircleTopFansWheel
          circle={circle}
          isOwner={isOwner}
          onCreateAvatar={() => navigate(`/circle/c/${circle.id}/settings`)}
        />
      )}

      {!isApprovedMember && circle.is_private ? (
        tab !== "home" && (
          <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
            <Lock className="h-9 w-9 text-muted-foreground" />
            <h2 className="text-base font-bold">This is a private Circle</h2>
            <p className="max-w-xs text-[13px] text-muted-foreground">
              {circle.welcome_message || "Request to join to see posts, videos, and everything else in here."}
            </p>
          </div>
        )
      ) : (
        <>
          {tab === "posts" && <ComingSoon label="Circle posts" />}
          {tab === "videos" && <ComingSoon label="Circle videos" />}
          {tab === "members" && isAdmin && <CircleMemberManagement circle={circle} onChanged={load} />}
          {tab === "about" && (
            <div className="space-y-3 px-4 py-5 text-[13px]">
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

      {showLivePrep && (
        <div className="fixed inset-0 z-[90] bg-black">
          <LiveCameraView
            createMode="live"
            onModeChange={() => {
              /* Circle prep stays on Live — no switch to public Post create */
            }}
            onClose={() => setShowLivePrep(false)}
            circleId={circle.id}
            hideModeTabs
          />
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="px-8 py-16 text-center text-[13px] text-muted-foreground">
      {label} are coming in the next update.
    </div>
  );
}
