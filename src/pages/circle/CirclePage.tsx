import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Lock, Plus, Radio, Settings, Upload, Users, Video } from "lucide-react";
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
import CircleCreatePostSheet from "@/components/circle/CircleCreatePostSheet";
import CircleUploadVideoSheet from "@/components/circle/CircleUploadVideoSheet";
import CircleContentFeed from "@/components/circle/CircleContentFeed";
import LiveCameraView from "@/components/feed/create/LiveCameraView";

type Tab = "home" | "posts" | "videos" | "members" | "about";

/** Warm ember / ink creator space — distinct from global YAJ theme tokens. */
const SHELL = {
  bg: "#120E0B",
  ink: "#F6EDE3",
  muted: "#C4A484",
  soft: "#8A7460",
  line: "#3A2A1A",
  accent: "#E8A05A",
  surface: "#1A1410",
} as const;

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
  const [showUploadVideo, setShowUploadVideo] = useState(false);
  const [contentRefresh, setContentRefresh] = useState(0);

  const load = () => {
    if (!id) return;
    void getCircle(id)
      .then(setCircle)
      .catch(() => setCircle(null));
    if (user?.id && id) void getMyMembership(id, user.id).then(setMembership).catch(() => setMembership(null));
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
    return (
      <div className="flex min-h-[100dvh] items-center justify-center text-[#C4A484]" style={{ background: SHELL.bg }}>
        Loading…
      </div>
    );
  }
  if (!circle) {
    return (
      <div
        className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-6 text-center"
        style={{ background: SHELL.bg, color: SHELL.ink }}
      >
        <p className="font-bold">This Circle isn't available.</p>
        <button
          type="button"
          onClick={() => navigate("/circle")}
          className="rounded-full px-4 py-2 text-sm font-black text-[#1A1410]"
          style={{ background: SHELL.accent }}
        >
          Back to My Circle
        </button>
      </div>
    );
  }

  const isOwner = user?.id === circle.owner_id;
  const isApprovedMember = isOwner || membership?.status === "approved";
  const isAdmin = isOwner || (membership?.status === "approved" && (membership.role === "owner" || membership.role === "admin"));
  const meta = CIRCLE_TYPE_META[circle.type];
  const canCreate = Boolean(user?.id && (isOwner || (isApprovedMember && circle.member_posting_allowed)));

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
    setShowLivePrep(true);
  };

  const bumpContent = () => setContentRefresh((n) => n + 1);

  const tabs: { id: Tab; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "posts", label: "Posts" },
    { id: "videos", label: "Videos" },
    ...(isAdmin ? [{ id: "members" as Tab, label: "Members" }] : []),
    { id: "about", label: "About" },
  ];

  return (
    <div
      className="min-h-[100dvh] pb-24"
      style={{
        background: `radial-gradient(ellipse at 20% 0%, #2A1C12 0%, ${SHELL.bg} 48%), ${SHELL.bg}`,
        color: SHELL.ink,
        fontFamily: '"DM Sans", "Helvetica Neue", sans-serif',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Syne:wght@600;700;800&display=swap');
      `}</style>

      <div className="relative h-44 w-full overflow-hidden" style={{ background: SHELL.surface }}>
        {circle.cover_url ? (
          <img src={circle.cover_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#3A2414] to-[#1A1410] text-5xl">
            {meta.emoji}
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#120E0B] via-transparent to-black/25" />
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute left-3 top-[max(env(safe-area-inset-top),0.75rem)] rounded-full bg-black/45 p-2 text-white backdrop-blur-sm"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        {isOwner && (
          <button
            type="button"
            onClick={() => navigate(`/circle/c/${circle.id}/settings`)}
            aria-label="Circle settings"
            className="absolute right-3 top-[max(env(safe-area-inset-top),0.75rem)] rounded-full bg-black/45 p-2 text-white backdrop-blur-sm"
          >
            <Settings className="h-4.5 w-4.5" />
          </button>
        )}
      </div>

      <div className="px-4">
        <div
          className="-mt-9 h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-2xl border-4 shadow-xl"
          style={{ borderColor: SHELL.bg, background: SHELL.surface }}
        >
          {circle.avatar_url ? (
            <img src={circle.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl">{meta.emoji}</div>
          )}
        </div>
        <div className="mt-2.5 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: SHELL.accent }}>
            My Circle
          </p>
          <h1 className="truncate text-[1.35rem] font-extrabold tracking-tight" style={{ fontFamily: '"Syne", sans-serif' }}>
            {circle.name}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold" style={{ color: SHELL.muted }}>
            <span className="flex items-center gap-0.5">
              <Users className="h-3 w-3" /> {circle.member_count}
            </span>
            {circle.is_private && (
              <span className="flex items-center gap-0.5">
                <Lock className="h-3 w-3" /> Private
              </span>
            )}
            <span>{meta.label}</span>
          </p>
        </div>

        {circle.description && (
          <p className="mt-3 text-[13px] leading-relaxed" style={{ color: SHELL.muted }}>
            {circle.description}
          </p>
        )}

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

      <div className="mt-5 flex gap-1 px-4" style={{ borderBottom: `1px solid ${SHELL.line}` }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="relative px-3 py-2.5 text-[12.5px] font-bold transition"
            style={{
              color: tab === t.id ? SHELL.ink : SHELL.soft,
              borderBottom: tab === t.id ? `2px solid ${SHELL.accent}` : "2px solid transparent",
            }}
          >
            {t.label}
            {t.id === "members" && pendingCount > 0 && (
              <span className="absolute -right-1 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "home" && (
        <>
          <CircleTopFansWheel
            circle={circle}
            isOwner={isOwner}
            onCreateAvatar={() => navigate(`/circle/c/${circle.id}/settings`)}
            tone="ember"
          />
          {isApprovedMember || !circle.is_private ? (
            <section>
              <div className="flex items-end justify-between px-4 pt-2">
                <div>
                  <h2 className="text-sm font-bold" style={{ fontFamily: '"Syne", sans-serif' }}>
                    Latest in the Circle
                  </h2>
                  <p className="text-[11px]" style={{ color: SHELL.soft }}>
                    New posts & videos land here · Circle only
                  </p>
                </div>
              </div>
              <CircleContentFeed
                circleId={circle.id}
                userId={user?.id}
                canInteract={isApprovedMember}
                refreshKey={contentRefresh}
                emptyLabel="No posts or videos yet. Create one from Posts or Videos."
              />
            </section>
          ) : (
            <div className="flex flex-col items-center gap-3 px-8 py-12 text-center">
              <Lock className="h-8 w-8" style={{ color: SHELL.soft }} />
              <p className="max-w-xs text-[13px]" style={{ color: SHELL.muted }}>
                Join this Circle to see posts and exclusive videos under Home.
              </p>
            </div>
          )}
        </>
      )}

      {!isApprovedMember && circle.is_private ? (
        tab !== "home" && (
          <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
            <Lock className="h-9 w-9" style={{ color: SHELL.soft }} />
            <h2 className="text-base font-bold">This is a private Circle</h2>
            <p className="max-w-xs text-[13px]" style={{ color: SHELL.muted }}>
              {circle.welcome_message || "Request to join to see posts, videos, and everything else in here."}
            </p>
          </div>
        )
      ) : (
        <>
          {tab === "posts" && (
            <div>
              {canCreate && (
                <div className="px-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreatePost(true)}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-[#1A1410]"
                    style={{ background: SHELL.accent }}
                  >
                    <Plus className="h-4 w-4" />
                    Create post
                  </button>
                  <p className="mt-2 text-center text-[11px]" style={{ color: SHELL.soft }}>
                    Photos · events · community · exclusives
                  </p>
                </div>
              )}
              <CircleContentFeed
                circleId={circle.id}
                userId={user?.id}
                canInteract={isApprovedMember}
                kind="post"
                refreshKey={contentRefresh}
                emptyLabel="No posts yet. Share a photo, event, or community update."
              />
            </div>
          )}

          {tab === "videos" && (
            <div>
              {canCreate && (
                <div className="px-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowUploadVideo(true)}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border text-sm font-bold"
                    style={{ borderColor: SHELL.accent, color: SHELL.accent, background: "rgba(232,160,90,0.08)" }}
                  >
                    <Upload className="h-4 w-4" />
                    Upload video from library
                  </button>
                  <p className="mt-2 flex items-center justify-center gap-1 text-center text-[11px]" style={{ color: SHELL.soft }}>
                    <Video className="h-3 w-3" /> Stays in My Circle · no share to main feed
                  </p>
                </div>
              )}
              <CircleContentFeed
                circleId={circle.id}
                userId={user?.id}
                canInteract={isApprovedMember}
                kind="video"
                refreshKey={contentRefresh}
                emptyLabel="No videos yet. Upload a clip from your photo library."
              />
            </div>
          )}

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

      {user?.id && (
        <>
          <CircleCreatePostSheet
            open={showCreatePost}
            onClose={() => setShowCreatePost(false)}
            circleId={circle.id}
            userId={user.id}
            onCreated={() => {
              bumpContent();
              setTab("home");
            }}
          />
          <CircleUploadVideoSheet
            open={showUploadVideo}
            onClose={() => setShowUploadVideo(false)}
            circleId={circle.id}
            userId={user.id}
            onCreated={() => {
              bumpContent();
              setTab("home");
            }}
          />
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
    <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "rgba(58,42,26,0.8)" }}>
      <span style={{ color: "#8A7460" }}>{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
