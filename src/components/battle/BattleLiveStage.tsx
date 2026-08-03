import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { LocalTrack, RemoteTrack } from "livekit-client";
import { Eye, EyeOff, Loader2, Mic, MicOff, MonitorUp, Radio, Video, VideoOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBattleLiveRoom } from "@/hooks/useBattleLiveRoom";
import { formatCountdown } from "@/lib/battle-ui";
import {
  getBattleReplayMediaUrl,
  getBattleScheduledStartAt,
  getLiveBattleEndsAt,
  getLiveBattlePhase,
} from "@/lib/battle-live";
import { toast } from "sonner";
import {
  forceIosAudioSessionToPlayback,
  unlockFeedAudioSession,
} from "@/lib/feed-video-playback";
import {
  ensureLiveBattleRecording,
  flushLiveBattleRecording,
  getLiveRecordSessionSnapshot,
  isLiveBattleRecording,
  subscribeLiveRecordSession,
} from "@/lib/battle-live-record-session";
import { resolveMediaDuration } from "@/lib/media-duration";
import LiveBattleReplayPlayer from "@/components/battle/LiveBattleReplayPlayer";
import BattleWinnerCheckBadge from "@/components/battle/BattleWinnerCheckBadge";
import BattleScreenSharePrivacy from "@/components/battle/BattleScreenSharePrivacy";
import { canBrowserScreenShare } from "@/lib/screen-share-support";

type BattleLike = {
  id: string;
  media_type?: string | null;
  status?: string | null;
  scheduled_start_at?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  challenger_id?: string | null;
  opponent_id?: string | null;
  challenger_cover_url?: string | null;
  opponent_cover_url?: string | null;
  opponent_media_url?: string | null;
  replay_media_url?: string | null;
  battle_background?: string | null;
};

type Props = {
  battle: BattleLike;
  leftName: string;
  rightName: string;
  /**
   * battle = competitor prep page (cameras during countdown + controls)
   * feed = public post (covers until live; no mic/cam controls)
   */
  surface?: "battle" | "feed";
  /** Compact layout for feed slide */
  compact?: boolean;
  /** Feed double-tap expand — same sides as video/photo battles. */
  expandedSide?: "left" | "right" | null;
  onExpandSide?: (side: "left" | "right") => void;
  /** Lets the feed chrome drive seek/progress for the replay. */
  replayVideoRef?: React.RefObject<HTMLVideoElement | null>;
  /** Election-style check after voting closes — sticks on replay too. */
  winnerSide?: "left" | "right" | null;
  className?: string;
};

/**
 * Exact same collapsed/expanded classes as BattleFeedSlide photo/audio/video cards.
 * Live must stay dual side-by-side half-width 3:4 tiles — a single full-width 3:4
 * card is nearly 2× taller and runs into the heart icon column.
 */
export const BATTLE_FEED_TILE =
  "min-w-0 flex-1 aspect-[3/4] max-h-[min(52dvh,420px)]";
export const BATTLE_FEED_TILE_EXPANDED = "h-full w-full max-h-full max-w-lg";
const TILE_SIZE = BATTLE_FEED_TILE;
const TILE_EXPANDED = BATTLE_FEED_TILE_EXPANDED;
const TILE_SHELL =
  "relative overflow-hidden rounded-[1.35rem] bg-neutral-900 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.65)] ring-1 transition-all duration-300";

function ReplayVideo({
  src,
  className = "",
  videoRef,
  half,
  onActivate,
}: {
  src: string;
  className?: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  /** Crop composite replay into a photo-sized card half. */
  half?: "left" | "right";
  onActivate?: () => void;
}) {
  const localRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);

  const setRefs = useCallback(
    (el: HTMLVideoElement | null) => {
      localRef.current = el;
      if (videoRef) (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    },
    [videoRef],
  );

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    forceIosAudioSessionToPlayback();
    el.muted = muted;
    el.defaultMuted = muted;
    el.loop = true;
    el.playsInline = true;
    void el.play().catch(() => undefined);
    // Only probe when not mid-play — seeking during playback glitches phones.
    if (el.paused || el.currentTime < 0.05) {
      void resolveMediaDuration(el);
    }
  }, [src, muted]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const el = localRef.current;
      if (!el) return;
      forceIosAudioSessionToPlayback();
      if (el.paused) void el.play().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onVis);
    };
  }, [src]);

  const halfClass =
    half === "left"
      ? "absolute inset-0 h-full w-[200%] max-w-none object-cover"
      : half === "right"
        ? "absolute inset-0 h-full w-[200%] max-w-none -translate-x-1/2 object-cover"
        : "absolute inset-0 h-full w-full object-cover";

  return (
    <video
      ref={setRefs}
      src={src}
      autoPlay
      loop
      muted={muted}
      playsInline
      controls={false}
      onClick={(e) => {
        e.stopPropagation();
        // Tap = sound; parent handles double-tap expand.
        forceIosAudioSessionToPlayback();
        unlockFeedAudioSession();
        setMuted((m) => !m);
        onActivate?.();
      }}
      className={`cursor-pointer ${halfClass} ${className}`}
    />
  );
}

/** Right-card follower that stays in sync with the master replay (seek bar drives master). */
function ReplayHalfFollower({
  src,
  masterRef,
}: {
  src: string;
  masterRef?: React.RefObject<HTMLVideoElement | null>;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const slave = ref.current;
    if (!slave) return;
    slave.muted = true;
    slave.loop = true;
    slave.playsInline = true;
    void slave.play().catch(() => undefined);

    const sync = () => {
      const master = masterRef?.current;
      if (!master || !slave) return;
      if (Math.abs(slave.currentTime - master.currentTime) > 0.3) {
        try {
          slave.currentTime = master.currentTime;
        } catch {
          /* ignore */
        }
      }
      if (master.paused && !slave.paused) slave.pause();
      if (!master.paused && slave.paused) void slave.play().catch(() => undefined);
    };

    const master = masterRef?.current;
    master?.addEventListener("timeupdate", sync);
    master?.addEventListener("seeked", sync);
    master?.addEventListener("play", sync);
    master?.addEventListener("pause", sync);
    const id = window.setInterval(sync, 500);
    return () => {
      master?.removeEventListener("timeupdate", sync);
      master?.removeEventListener("seeked", sync);
      master?.removeEventListener("play", sync);
      master?.removeEventListener("pause", sync);
      window.clearInterval(id);
    };
  }, [src, masterRef]);

  return (
    <video
      ref={ref}
      src={src}
      autoPlay
      loop
      muted
      playsInline
      controls={false}
      className="absolute inset-0 h-full w-[200%] max-w-none -translate-x-1/2 object-cover"
    />
  );
}

function StreamVideo({
  stream,
  muted,
  className,
  videoRef,
  mirror,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  mirror?: boolean;
}) {
  const localRef = useRef<HTMLVideoElement | null>(null);
  const ref = videoRef || localRef;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) void el.play().catch(() => undefined);
  }, [stream, ref]);

  return (
    <video
      ref={ref as React.RefObject<HTMLVideoElement>}
      autoPlay
      playsInline
      muted={muted}
      className={`${className || ""} ${mirror ? "scale-x-[-1]" : ""}`}
    />
  );
}

export default function BattleLiveStage({
  battle,
  leftName,
  rightName,
  surface = "feed",
  compact = false,
  expandedSide = null,
  onExpandSide,
  replayVideoRef,
  winnerSide = null,
  className = "",
}: Props) {
  const lastTapRef = useRef(0);
  const lastTapSideRef = useRef<"left" | "right" | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const leftVideoRef = useRef<HTMLVideoElement | null>(null);
  const rightVideoRef = useRef<HTMLVideoElement | null>(null);
  /** Always-mounted sinks so the recorder keeps frames even after the UI switches to covers. */
  const leftRecRef = useRef<HTMLVideoElement | null>(null);
  const rightRecRef = useRef<HTMLVideoElement | null>(null);
  const redirectedRef = useRef(false);
  const prevPhaseRef = useRef<string | null>(null);
  const flushOnceRef = useRef(false);
  const battleRef = useRef(battle);
  battleRef.current = battle;
  const [recordSnap, setRecordSnap] = useState(() => getLiveRecordSessionSnapshot());
  const isRecording = recordSnap.battleId === battle.id && recordSnap.recording;
  const savingReplay = recordSnap.battleId === battle.id && recordSnap.saving;
  const replayFailed = recordSnap.battleId === battle.id && recordSnap.failed;
  const localReplayUrl = recordSnap.battleId === battle.id ? recordSnap.localUrl : null;

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);

  const phase = getLiveBattlePhase(battle, now);
  const remoteReplayUrl = getBattleReplayMediaUrl(battle);
  const isParticipant =
    !!user && (user.id === battle.challenger_id || user.id === battle.opponent_id);
  const isChallenger = !!user && user.id === battle.challenger_id;

  // Competitors publish on battle page during countdown (prep), then on feed once live.
  // Keep publishing a moment after debate end so the recorder can finish the last frames.
  const canPublish =
    isParticipant &&
    ((surface === "battle" && (phase === "countdown" || phase === "live")) ||
      (phase === "live" && surface === "feed") ||
      (phase === "ended" &&
        isChallenger &&
        (isRecording || savingReplay) &&
        !remoteReplayUrl &&
        !localReplayUrl));
  const roomEnabled =
    !!user &&
    phase !== "waiting" &&
    (phase === "ended"
      ? isChallenger && (isRecording || savingReplay) && !remoteReplayUrl && !localReplayUrl
      : surface === "battle"
        ? isParticipant && (phase === "countdown" || phase === "live")
        : phase === "live");

  // Mic/cam on battle prep page; screen share also available to competitors while live on feed.
  const showPublisherControls =
    isParticipant &&
    (phase === "countdown" || phase === "live") &&
    (surface === "battle" || phase === "live");
  const showLiveVideo =
    phase === "live" || (surface === "battle" && isParticipant && phase === "countdown");

  const {
    conn,
    error,
    micOn,
    camOn,
    screenSharePhase,
    localScreenPreview,
    streams,
    audioTracks,
    remoteCount,
    startAudio,
    toggleMic,
    toggleCam,
    startScreenSharePrivacy,
    showScreenShare,
    pauseScreenShare,
    stopScreenShare,
  } = useBattleLiveRoom({
    battleId: battle.id,
    challengerId: battle.challenger_id,
    opponentId: battle.opponent_id,
    enabled: roomEnabled,
    canPublish,
  });

  const scheduledStartAt = getBattleScheduledStartAt(battle);
  const replayUrl = remoteReplayUrl || localReplayUrl || recordSnap.remoteUrl;
  const startMs = scheduledStartAt ? new Date(scheduledStartAt).getTime() : null;
  const endMs = getLiveBattleEndsAt(battle).getTime();
  const msToStart = startMs != null ? Math.max(0, startMs - now) : 0;
  const msToEnd = Math.max(0, endMs - now);
  // Start unlocked so competitors hear each other as soon as tracks arrive.
  const [soundOn, setSoundOn] = useState(true);
  const [soundBlocked, setSoundBlocked] = useState(false);

  const unlockDebateAudio = useCallback(() => {
    forceIosAudioSessionToPlayback();
    void unlockFeedAudioSession();
    setSoundOn(true);
    setSoundBlocked(false);
    void startAudio();
  }, [startAudio]);

  useEffect(() => subscribeLiveRecordSession(() => setRecordSnap(getLiveRecordSessionSnapshot())), []);

  // Recording sinks — prefer live screen share when the crowd can see it.
  useEffect(() => {
    const bind = (el: HTMLVideoElement | null, stream: MediaStream | null) => {
      if (!el) return;
      if (el.srcObject !== stream) el.srcObject = stream;
      if (stream) void el.play().catch(() => undefined);
    };
    bind(leftRecRef.current, streams.leftScreen || streams.leftCamera || streams.leftVideo);
    bind(rightRecRef.current, streams.rightScreen || streams.rightCamera || streams.rightVideo);
  }, [
    streams.leftScreen,
    streams.rightScreen,
    streams.leftCamera,
    streams.rightCamera,
    streams.leftVideo,
    streams.rightVideo,
  ]);

  // Spectators: refresh feed while waiting for challenger to finish uploading replay.
  useEffect(() => {
    if (phase !== "ended" || remoteReplayUrl) return;
    const id = window.setInterval(() => {
      void qc.invalidateQueries({ queryKey: ["feed-posts"] });
      void qc.invalidateQueries({ queryKey: ["battle", battle.id] });
    }, 4000);
    return () => window.clearInterval(id);
  }, [phase, remoteReplayUrl, battle.id, qc]);

  // Unlock debate audio as soon as the post goes live (iOS may still require a tap).
  useEffect(() => {
    if (phase !== "live") return;
    setSoundOn(true);
    if (surface === "battle") {
      void startAudio();
      return;
    }
    forceIosAudioSessionToPlayback();
    void unlockFeedAudioSession();
    void startAudio();
    // Retry once tracks arrive — first attempt often races the room connect.
    const t = window.setTimeout(() => {
      forceIosAudioSessionToPlayback();
      void startAudio();
    }, 600);
    return () => window.clearTimeout(t);
  }, [phase, surface, startAudio, conn, audioTracks.left, audioTracks.right]);

  // When countdown hits zero on the competitor battle page → open the public post live.
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (surface !== "battle" || !isParticipant) return;
    if (redirectedRef.current) return;
    if (phase === "live" && (prev === "countdown" || prev === null)) {
      redirectedRef.current = true;
      toast.message("You're live — opening the post");
      navigate(`/?battle=${battle.id}`, { replace: true });
    }
  }, [phase, surface, isParticipant, battle.id, navigate]);

  const flushReplay = useCallback(async () => {
    if (!user || user.id !== battleRef.current.challenger_id) return;
    const id = battleRef.current.id;
    const before = getLiveRecordSessionSnapshot();
    if (before.battleId !== id) return;
    if (before.remoteUrl) return;
    if (before.saving) return;
    if (!before.recording && !before.localUrl) return;
    if (flushOnceRef.current && before.localUrl) return;
    flushOnceRef.current = true;
    const url = await flushLiveBattleRecording(id);
    setRecordSnap(getLiveRecordSessionSnapshot());
    if (url) {
      if (!url.startsWith("blob:")) {
        toast.success("Debate replay saved to the post");
      }
      void qc.invalidateQueries({ queryKey: ["battle", id] });
      void qc.invalidateQueries({ queryKey: ["feed-posts"] });
      void qc.invalidateQueries({ queryKey: ["battles"] });
    } else if (getLiveRecordSessionSnapshot().failed) {
      toast.error("Couldn't save debate replay — keep this tab open next time");
      flushOnceRef.current = false;
    }
  }, [user, qc]);

  // Challenger auto-records on ANY surface once live (survives feed ↔ battle navigation).
  useEffect(() => {
    if (phase !== "live" || !isChallenger || !user) return;
    if (conn !== "connected") return;
    if (remoteReplayUrl) return;

    const started = ensureLiveBattleRecording({
      battle: {
        id: battle.id,
        challenger_id: battle.challenger_id,
        battle_background: battle.battle_background,
        scheduled_start_at: battle.scheduled_start_at,
        expires_at: battle.expires_at,
        challenger_cover_url: battle.challenger_cover_url,
        opponent_cover_url: battle.opponent_cover_url,
      },
      userId: user.id,
      getLeftVideo: () => leftRecRef.current || leftVideoRef.current,
      getRightVideo: () => rightRecRef.current || rightVideoRef.current,
      leftAudio: streams.leftAudio,
      rightAudio: streams.rightAudio,
      leftLabel: leftName,
      rightLabel: rightName,
    });
    setRecordSnap(getLiveRecordSessionSnapshot());
    if (!started && !isLiveBattleRecording(battle.id)) {
      toast.message("Recording unavailable on this device — debate still goes live");
    }
  }, [
    phase,
    conn,
    isChallenger,
    user,
    remoteReplayUrl,
    streams.leftAudio,
    streams.rightAudio,
    battle.id,
    battle.challenger_id,
    battle.battle_background,
    battle.scheduled_start_at,
    battle.expires_at,
    battle.challenger_cover_url,
    battle.opponent_cover_url,
    leftName,
    rightName,
  ]);

  // Stop + upload when the debate clock ends (auto-play local blob immediately).
  useEffect(() => {
    if (phase !== "ended") return;
    void flushReplay();
  }, [phase, flushReplay]);

  // Last-resort save if the tab is closing while a recording is in progress.
  useEffect(() => {
    if (!isChallenger) return;
    const onPageHide = () => {
      void flushLiveBattleRecording(battleRef.current.id);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [isChallenger]);

  const handleTileTap = (side: "left" | "right") => {
    // Any tap unlocks remote debate audio (competitors + spectators).
    if (phase === "live") unlockDebateAudio();
    if (!onExpandSide) return;
    const nowTs = Date.now();
    const isDouble =
      lastTapSideRef.current === side && nowTs - lastTapRef.current < 280;
    lastTapRef.current = nowTs;
    lastTapSideRef.current = side;
    if (isDouble) onExpandSide(side);
  };

  const leftCover = battle.challenger_cover_url;
  const rightCover = battle.opponent_cover_url;

  // Replay: dual photo-sized cards; expand = that person's half only (not the full composite).
  if (phase === "ended" && replayUrl) {
    const expanded = !!expandedSide;
    const feedEmbed = surface === "feed";
    const side = expandedSide || "left";
    if (expanded) {
      return (
        <div
          className={
            feedEmbed
              ? `${TILE_SHELL} ${side === "left" ? "ring-cyan-300/90" : "ring-pink-400/90"} ${TILE_EXPANDED} ${className}`
              : `relative flex h-full w-full items-center justify-center ${className}`
          }
          onTouchEnd={(e) => {
            e.stopPropagation();
            handleTileTap(side);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onExpandSide?.(side);
          }}
        >
          {feedEmbed ? (
            <>
              {/* Crop composite to the tapped competitor only — same portrait window as photo expand. */}
              <ReplayVideo src={replayUrl} videoRef={replayVideoRef} half={side} />
              <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/80 via-transparent to-black/20" />
              <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                Replay
              </div>
              <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white/80 backdrop-blur">
                Double-tap to minimize
              </div>
              <div className="absolute inset-x-0 bottom-0 z-10 p-3 pr-[42%]">
                <p className="text-sm font-black text-white drop-shadow">
                  {side === "left" ? leftName : rightName}
                </p>
              </div>
              {winnerSide === side ? <BattleWinnerCheckBadge size="lg" /> : null}
            </>
          ) : (
            <div
              className={`${TILE_SHELL} ${side === "left" ? "ring-cyan-300/90" : "ring-pink-400/90"} ${TILE_EXPANDED}`}
              onTouchEnd={(e) => {
                e.stopPropagation();
                handleTileTap(side);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onExpandSide?.(side);
              }}
            >
              <ReplayVideo src={replayUrl} videoRef={replayVideoRef} half={side} />
              <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/80 via-transparent to-black/20" />
              <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                Replay
              </div>
              <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white/80 backdrop-blur">
                Double-tap to minimize
              </div>
              <div className="absolute inset-x-0 bottom-0 z-10 p-3 pr-[42%]">
                <p className="text-sm font-black text-white drop-shadow">
                  {side === "left" ? leftName : rightName}
                </p>
              </div>
              {winnerSide === side ? <BattleWinnerCheckBadge size="lg" /> : null}
            </div>
          )}
        </div>
      );
    }

    // Collapsed: dual VS cards. Feed uses bottom post seek; battle page/card get a clean bar.
    return (
      <div className={`w-full ${feedEmbed ? "" : className}`}>
        <LiveBattleReplayPlayer
          src={replayUrl}
          leftName={leftName}
          rightName={rightName}
          videoRef={replayVideoRef}
          onExpandSide={onExpandSide}
          hideProgress={feedEmbed}
          winnerSide={winnerSide}
        />
        {savingReplay ? (
          <div className="mt-2 rounded-full bg-black/65 px-3 py-1.5 text-center text-[10px] font-bold text-white/90">
            Saving replay to the post…
          </div>
        ) : null}
      </div>
    );
  }

  const tile = (
    side: "left" | "right",
    name: string,
    cover: string | null | undefined,
    cameraStream: MediaStream | null,
    screenStream: MediaStream | null,
    videoRef: React.RefObject<HTMLVideoElement | null>,
    isLocalSide: boolean,
  ) => {
    const screenLive = showLiveVideo && !!screenStream;
    const showCamera = showLiveVideo && !!cameraStream;
    const isExpanded = expandedSide === side;
    const isHidden = expandedSide != null && expandedSide !== side;
    return (
      <div
        className={`${TILE_SHELL} ${
          side === "left" ? "ring-cyan-300/90" : "ring-pink-400/90"
        } ${
          isHidden
            ? "hidden"
            : isExpanded
              ? TILE_EXPANDED
              : compact || surface === "feed"
                ? TILE_SIZE
                : "min-w-0 flex-1 aspect-[3/4]"
        }`}
        onTouchEnd={(e) => {
          if (!onExpandSide) return;
          e.stopPropagation();
          e.preventDefault();
          handleTileTap(side);
        }}
        onDoubleClick={(e) => {
          if (!onExpandSide) return;
          e.stopPropagation();
          onExpandSide(side);
        }}
      >
        {screenLive ? (
          <>
            <StreamVideo
              stream={screenStream}
              muted={isLocalSide}
              videoRef={videoRef}
              mirror={false}
              className="absolute inset-0 h-full w-full object-contain bg-black"
            />
            {showCamera ? (
              <div className="absolute bottom-10 right-2 z-[5] h-20 w-14 overflow-hidden rounded-xl ring-2 ring-white/70 shadow-lg sm:h-24 sm:w-[4.25rem]">
                <StreamVideo
                  stream={cameraStream}
                  muted
                  mirror={isLocalSide}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
            <div className="pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-cyan-400/95 px-2 py-0.5 text-[10px] font-black uppercase text-black">
              <MonitorUp className="h-3 w-3" /> Screen
            </div>
          </>
        ) : showCamera ? (
          <StreamVideo
            stream={cameraStream}
            muted={isLocalSide}
            videoRef={videoRef}
            mirror={isLocalSide}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : cover ? (
          <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-white/50">
            Waiting…
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25" />
        {isExpanded ? (
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white/80 backdrop-blur">
            Double-tap to minimize
          </div>
        ) : null}
        {surface === "battle" && isParticipant && phase === "countdown" && isLocalSide && (
          <div className="absolute left-2 top-2 z-10 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-black uppercase text-black">
            Preview
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 z-10 p-2.5">
          <p className="text-sm font-black text-white drop-shadow">{name}</p>
        </div>
      </div>
    );
  };

  const leftLiveTile = tile(
    "left",
    leftName,
    leftCover,
    streams.leftCamera || streams.leftVideo,
    streams.leftScreen,
    leftVideoRef,
    user?.id === battle.challenger_id,
  );
  const rightLiveTile = tile(
    "right",
    rightName,
    rightCover,
    streams.rightCamera || streams.rightVideo,
    streams.rightScreen,
    rightVideoRef,
    user?.id === battle.opponent_id,
  );
  const vsBadge = !expandedSide ? (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
      <span className="rounded-full bg-black/70 px-2.5 py-1 text-xs font-black tracking-widest text-white ring-1 ring-white/25">
        VS
      </span>
    </div>
  ) : null;

  const hiddenRecorders = (
    <>
      <video ref={leftRecRef} muted playsInline autoPlay className="pointer-events-none absolute h-px w-px opacity-0" aria-hidden />
      <video ref={rightRecRef} muted playsInline autoPlay className="pointer-events-none absolute h-px w-px opacity-0" aria-hidden />
    </>
  );

  const debateAudio =
    phase === "live" ? (
      <DebateAudioSink
        left={user?.id === battle.challenger_id ? null : audioTracks.left}
        right={user?.id === battle.opponent_id ? null : audioTracks.right}
        enabled={soundOn || surface === "battle"}
        // Spectators: playback session. Publishers keep play-and-record for the mic.
        preferPlaybackSession={!canPublish}
        startAudio={startAudio}
        onBlocked={() => setSoundBlocked(true)}
        onPlaying={() => {
          setSoundBlocked(false);
          setSoundOn(true);
        }}
      />
    ) : null;

  // Absolute overlays only — never add document-flow chrome that grows card height.
  const liveEndCountdown =
    phase === "live" && surface === "feed" && !expandedSide ? (
      <div className="pointer-events-none absolute inset-x-2 top-0 z-30 flex justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/35 bg-rose-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-rose-200 backdrop-blur">
          <Radio className="h-3 w-3 animate-pulse" />
          Ends in {formatCountdown(msToEnd)}
        </span>
      </div>
    ) : null;

  const tapForAudio =
    phase === "live" && surface === "feed" && (soundBlocked || !soundOn) ? (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          unlockDebateAudio();
        }}
        className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-black shadow-lg"
      >
        <Mic className="h-3.5 w-3.5" /> Tap for debate audio
      </button>
    ) : null;

  const recordingStatus =
    surface === "feed" && phase === "live" && isChallenger && isRecording ? (
      <div className="pointer-events-none absolute left-2 top-2 z-30 rounded-full bg-black/65 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-300">
        ● Rec
      </div>
    ) : surface === "feed" && phase === "ended" && !replayUrl && (savingReplay || isRecording) ? (
      <div className="pointer-events-none absolute inset-x-6 bottom-2 z-30 rounded-full bg-black/65 px-3 py-1.5 text-center text-[10px] font-bold text-white/90">
        Saving replay…
      </div>
    ) : null;

  const screenShareSupported = canBrowserScreenShare();

  const onStartShare = async () => {
    if (!screenShareSupported) return;
    if (conn !== "connected") {
      toast.error(
        conn === "connecting"
          ? "Still connecting — try Share screen again in a second"
          : "Live room not ready yet",
      );
      return;
    }
    try {
      await startScreenSharePrivacy();
      toast.message("Private preview — crowd can’t see until you tap Show");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Couldn’t open screen share";
      if (/cancel/i.test(msg)) return;
      toast.error(msg, { duration: 6500 });
    }
  };

  // Phone/iPad browsers can't screen-share — hide the control entirely there.
  const screenShareControls =
    screenShareSupported && showPublisherControls && phase === "live" ? (
      <div
        className={`z-[60] flex items-center justify-center gap-2 ${
          surface === "feed"
            ? "pointer-events-auto absolute inset-x-2 bottom-2"
            : ""
        }`}
      >
        {screenSharePhase === "off" ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              void onStartShare();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={conn !== "connected"}
            className="inline-flex items-center gap-1.5 rounded-full bg-cyan-300 px-3 py-2 text-[11px] font-black text-black shadow-lg disabled:opacity-60"
          >
            <MonitorUp className="h-3.5 w-3.5" />
            {conn === "connecting" ? "Connecting…" : "Share screen"}
          </button>
        ) : screenSharePhase === "live" ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void pauseScreenShare();
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-2 text-[11px] font-black text-black shadow-lg"
            >
              <EyeOff className="h-3.5 w-3.5" /> Pause screen
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void stopScreenShare();
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-2 text-[11px] font-black text-white ring-1 ring-white/25"
            >
              Stop
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              /* privacy overlay already open */
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-[11px] font-black text-white ring-1 ring-white/25 backdrop-blur"
          >
            <Eye className="h-3.5 w-3.5" /> Private preview…
          </button>
        )}
      </div>
    ) : null;

  const privacyOverlay = (
    <BattleScreenSharePrivacy
      open={screenSharePhase === "privacy"}
      preview={localScreenPreview}
      broadcasting={false}
      onShow={() => {
        void showScreenShare()
          .then(() => toast.success("Screen is live to the crowd"))
          .catch(() => toast.error("Couldn’t show screen"));
      }}
      onPause={() => {
        void pauseScreenShare();
        toast.message("Screen paused — crowd can’t see it");
      }}
      onStop={() => {
        void stopScreenShare();
        toast.message("Screen share stopped");
      }}
    />
  );

  // Feed: photo-sized tiles + absolute overlays. Parent owns the flex row.
  // Audio/recorder sinks stay absolute 1px (not display:none / overflow-hidden — browsers mute those).
  if (surface === "feed") {
    return (
      <>
        {hiddenRecorders}
        {debateAudio}
        {leftLiveTile}
        {vsBadge}
        {rightLiveTile}
        {liveEndCountdown}
        {recordingStatus}
        {tapForAudio}
        {screenShareControls}
        {privacyOverlay}
      </>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {(phase === "countdown" || phase === "waiting") && !expandedSide && (
        <div className="mb-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">
            {phase === "waiting" ? "Waiting for opponent" : "Debate starts in"}
          </p>
          {phase === "countdown" && (
            <p className="mt-0.5 font-display text-2xl font-black tabular-nums text-white">
              {msToStart > 0 ? Math.ceil(msToStart / 1000) : 0}s
            </p>
          )}
        </div>
      )}

      {phase === "live" && !expandedSide && (
        <div className="mb-2 flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-rose-300">
            <Radio className="h-3.5 w-3.5 animate-pulse" /> Live debate
          </span>
          <span className="text-[11px] font-bold tabular-nums text-white/80">
            Ends in {formatCountdown(msToEnd)}
          </span>
        </div>
      )}

      {phase === "ended" && !replayUrl && !expandedSide && (
        <div className="mb-2 rounded-2xl border border-border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
          {savingReplay || isRecording
            ? "Debate ended — saving replay…"
            : replayFailed
              ? "Debate ended — replay unavailable on this device."
              : "Debate ended — replay will appear here shortly."}
        </div>
      )}

      {hiddenRecorders}

      <div
        className={`relative flex w-full items-center justify-center gap-1.5 ${
          expandedSide ? "h-full" : ""
        }`}
      >
        {leftLiveTile}
        {vsBadge}
        {rightLiveTile}
      </div>

      {debateAudio}

      {showPublisherControls && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => void toggleMic()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20"
            aria-label={micOn ? "Mute" : "Unmute"}
          >
            {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => void toggleCam()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20"
            aria-label={camOn ? "Camera off" : "Camera on"}
          >
            {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </button>
          {phase === "live" && screenShareSupported ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void onStartShare();
              }}
              disabled={conn !== "connected"}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-cyan-300 px-3 text-xs font-black text-black disabled:opacity-60"
              aria-label="Share screen"
            >
              <MonitorUp className="h-4 w-4" />
              {conn === "connecting"
                ? "Connecting…"
                : screenSharePhase === "off"
                  ? "Share screen"
                  : "Screen…"}
            </button>
          ) : null}
          {conn === "connecting" && (
            <span className="inline-flex items-center gap-1 text-[11px] text-white/70">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting…
            </span>
          )}
          {conn === "connected" && phase === "countdown" && (
            <span className="text-[11px] text-white/60">
              {remoteCount > 0 ? "Opponent previewing" : "Get ready…"}
            </span>
          )}
          {conn === "connected" && phase === "live" && (
            <span className="text-[11px] text-white/60">
              {remoteCount > 0 ? "Opponent connected" : "Waiting for opponent…"}
            </span>
          )}
        </div>
      )}

      {error && showPublisherControls && (
        <p className="text-center text-[11px] text-rose-300">{error}</p>
      )}

      {privacyOverlay}
    </div>
  );
}

function DebateAudioSink({
  left,
  right,
  enabled,
  preferPlaybackSession,
  startAudio,
  onBlocked,
  onPlaying,
}: {
  left: RemoteTrack | LocalTrack | null;
  right: RemoteTrack | LocalTrack | null;
  enabled: boolean;
  preferPlaybackSession: boolean;
  startAudio: () => Promise<void>;
  onBlocked: () => void;
  onPlaying: () => void;
}) {
  const leftRef = useRef<HTMLAudioElement | null>(null);
  const rightRef = useRef<HTMLAudioElement | null>(null);
  const onBlockedRef = useRef(onBlocked);
  const onPlayingRef = useRef(onPlaying);
  onBlockedRef.current = onBlocked;
  onPlayingRef.current = onPlaying;

  useEffect(() => {
    const leftEl = leftRef.current;
    const rightEl = rightRef.current;
    if (!enabled) {
      try {
        if (leftEl) left?.detach(leftEl);
        if (rightEl) right?.detach(rightEl);
      } catch {
        /* ignore */
      }
      return;
    }

    if (preferPlaybackSession) forceIosAudioSessionToPlayback();
    unlockFeedAudioSession();

    let cancelled = false;
    let blocked = false;
    let playing = false;

    const attachOne = async (
      el: HTMLAudioElement | null,
      track: RemoteTrack | LocalTrack | null,
    ) => {
      if (!el) return;
      if (!track || track.isMuted) {
        try {
          track?.detach(el);
        } catch {
          /* ignore */
        }
        el.pause();
        el.srcObject = null;
        return;
      }
      // LiveKit attach() is more reliable than MediaStream + srcObject for remote audio.
      const attached = track.attach(el) as HTMLAudioElement;
      attached.autoplay = true;
      attached.muted = false;
      attached.volume = 1;
      attached.setAttribute("playsinline", "true");
      try {
        await startAudio();
        await attached.play();
        if (!cancelled) {
          playing = true;
          onPlayingRef.current();
        }
      } catch {
        blocked = true;
      }
    };

    void (async () => {
      await attachOne(leftEl, left);
      await attachOne(rightEl, right);
      if (!cancelled && blocked && !playing) onBlockedRef.current();
    })();

    return () => {
      cancelled = true;
      try {
        if (leftEl) left?.detach(leftEl);
        if (rightEl) right?.detach(rightEl);
      } catch {
        /* ignore */
      }
    };
  }, [left, right, enabled, preferPlaybackSession, startAudio]);

  return (
    <>
      {/* Avoid display:none — many browsers refuse to play audio in hidden elements. */}
      <audio
        ref={leftRef}
        autoPlay
        playsInline
        className="pointer-events-none absolute h-px w-px opacity-0"
        aria-hidden
      />
      <audio
        ref={rightRef}
        autoPlay
        playsInline
        className="pointer-events-none absolute h-px w-px opacity-0"
        aria-hidden
      />
    </>
  );
}
