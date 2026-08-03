import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { LocalTrack, RemoteTrack } from "livekit-client";
import { Loader2, Mic, MicOff, Radio, Video, VideoOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBattleLiveRoom } from "@/hooks/useBattleLiveRoom";
import { formatCountdown } from "@/lib/battle-ui";
import {
  getBattleReplayMediaUrl,
  getBattleScheduledStartAt,
  getLiveBattleEndsAt,
  getLiveBattlePhase,
} from "@/lib/battle-live";
import { startBattleLiveRecorder, type BattleLiveRecorder } from "@/lib/battle-live-record";
import { persistLiveBattleReplay } from "@/lib/persist-live-battle-replay";
import { toast } from "sonner";
import {
  forceIosAudioSessionToPlayback,
  unlockFeedAudioSession,
} from "@/lib/feed-video-playback";

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
  className?: string;
};

/** Match BattleFeedSlide photo/audio/video card sizing exactly. */
const TILE_SIZE =
  "min-w-0 flex-1 aspect-[3/4] max-h-[min(52dvh,420px)]";
const TILE_EXPANDED = "h-full w-full max-h-full max-w-lg";

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
  }, [src, muted]);

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
  const recorderRef = useRef<BattleLiveRecorder | null>(null);
  const recordingStartedRef = useRef(false);
  const uploadingReplayRef = useRef(false);
  const redirectedRef = useRef(false);
  const prevPhaseRef = useRef<string | null>(null);
  const battleRef = useRef(battle);
  battleRef.current = battle;
  const localReplayUrlRef = useRef<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

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
      (surface === "feed" &&
        (phase === "live" || (phase === "ended" && isChallenger && isRecording && !remoteReplayUrl))));
  const roomEnabled =
    !!user &&
    phase !== "waiting" &&
    (phase === "ended"
      ? surface === "feed" && isChallenger && isRecording && !remoteReplayUrl
      : surface === "battle"
        ? isParticipant && (phase === "countdown" || phase === "live")
        : phase === "live");

  // Mic/cam toggles only on the competitor battle page — never on the public post/feed.
  const showPublisherControls =
    surface === "battle" && isParticipant && (phase === "countdown" || phase === "live");
  const showLiveVideo =
    phase === "live" || (surface === "battle" && isParticipant && phase === "countdown");

  const {
    conn,
    error,
    micOn,
    camOn,
    streams,
    audioTracks,
    remoteCount,
    startAudio,
    toggleMic,
    toggleCam,
  } = useBattleLiveRoom({
    battleId: battle.id,
    challengerId: battle.challenger_id,
    opponentId: battle.opponent_id,
    enabled: roomEnabled,
    canPublish,
  });

  const scheduledStartAt = getBattleScheduledStartAt(battle);
  const [localReplayUrl, setLocalReplayUrl] = useState<string | null>(null);
  const [savingReplay, setSavingReplay] = useState(false);
  const [replayFailed, setReplayFailed] = useState(false);
  const replayUrl = remoteReplayUrl || localReplayUrl;
  const startMs = scheduledStartAt ? new Date(scheduledStartAt).getTime() : null;
  const endMs = getLiveBattleEndsAt(battle).getTime();
  const msToStart = startMs != null ? Math.max(0, startMs - now) : 0;
  const msToEnd = Math.max(0, endMs - now);
  const [soundOn, setSoundOn] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);

  // Feed recording sinks — stay attached for the whole live call.
  useEffect(() => {
    const bind = (el: HTMLVideoElement | null, stream: MediaStream | null) => {
      if (!el) return;
      if (el.srcObject !== stream) el.srcObject = stream;
      if (stream) void el.play().catch(() => undefined);
    };
    bind(leftRecRef.current, streams.leftVideo);
    bind(rightRecRef.current, streams.rightVideo);
  }, [streams.leftVideo, streams.rightVideo]);

  // Spectators: refresh feed while waiting for challenger to finish uploading replay.
  useEffect(() => {
    if (phase !== "ended" || remoteReplayUrl) return;
    const id = window.setInterval(() => {
      void qc.invalidateQueries({ queryKey: ["feed-posts"] });
      void qc.invalidateQueries({ queryKey: ["battle", battle.id] });
    }, 4000);
    return () => window.clearInterval(id);
  }, [phase, remoteReplayUrl, battle.id, qc]);

  useEffect(() => {
    return () => {
      if (localReplayUrlRef.current) {
        URL.revokeObjectURL(localReplayUrlRef.current);
        localReplayUrlRef.current = null;
      }
    };
  }, []);

  // Try unlocking debate audio as soon as the post goes live (iOS may still require a tap).
  useEffect(() => {
    if (phase !== "live") return;
    if (surface === "battle") {
      setSoundOn(true);
      void startAudio();
      return;
    }
    forceIosAudioSessionToPlayback();
    unlockFeedAudioSession();
    setSoundOn(true);
    void startAudio();
  }, [phase, surface, startAudio]);

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
    if (uploadingReplayRef.current) return;
    if (user?.id !== battleRef.current.challenger_id) return;
    if (getBattleReplayMediaUrl(battleRef.current) && !localReplayUrlRef.current) return;
    const rec = recorderRef.current;
    if (!rec || !recordingStartedRef.current) {
      setReplayFailed(true);
      setSavingReplay(false);
      return;
    }

    uploadingReplayRef.current = true;
    setSavingReplay(true);
    setReplayFailed(false);
    recorderRef.current = null;
    try {
      const blob = await rec.stop();
      recordingStartedRef.current = false;
      setIsRecording(false);
      if (!blob?.size || !user) {
        setReplayFailed(true);
        toast.error("Debate recording was empty — keep the post open next time");
        return;
      }

      // Play immediately from the local blob while upload finishes in the background.
      if (localReplayUrlRef.current) URL.revokeObjectURL(localReplayUrlRef.current);
      const objectUrl = URL.createObjectURL(blob);
      localReplayUrlRef.current = objectUrl;
      setLocalReplayUrl(objectUrl);

      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const url = await persistLiveBattleReplay({
            battle: battleRef.current,
            userId: user.id,
            blob,
          });
          if (url) {
            toast.success("Debate replay saved to the post");
            void qc.invalidateQueries({ queryKey: ["battle", battleRef.current.id] });
            void qc.invalidateQueries({ queryKey: ["feed-posts"] });
            void qc.invalidateQueries({ queryKey: ["battles"] });
            lastErr = null;
            break;
          }
        } catch (err) {
          lastErr = err;
          await new Promise((r) => window.setTimeout(r, 1200 * (attempt + 1)));
        }
      }
      if (lastErr) {
        setReplayFailed(true);
        toast.error("Couldn't upload replay yet — replay is playing on this device");
      }
    } catch {
      recordingStartedRef.current = false;
      setIsRecording(false);
      setReplayFailed(true);
      toast.error("Couldn't save debate replay — keep this tab open next time");
    } finally {
      uploadingReplayRef.current = false;
      setSavingReplay(false);
    }
  }, [user, qc]);

  // Challenger records from the public post surface (where they land when go-live).
  useEffect(() => {
    if (surface !== "feed") return;
    if (phase !== "live" || !isChallenger) return;
    if (recordingStartedRef.current || conn !== "connected") return;
    if (!streams.leftVideo && !streams.rightVideo) return;

    const rec = startBattleLiveRecorder({
      getLeftVideo: () => leftRecRef.current || leftVideoRef.current,
      getRightVideo: () => rightRecRef.current || rightVideoRef.current,
      leftCoverUrl: battle.challenger_cover_url,
      rightCoverUrl: battle.opponent_cover_url,
      leftAudio: streams.leftAudio,
      rightAudio: streams.rightAudio,
    });
    if (!rec) {
      toast.message("Recording unavailable on this device — debate still goes live");
      setReplayFailed(true);
      return;
    }
    recorderRef.current = rec;
    recordingStartedRef.current = true;
    setIsRecording(true);
    setReplayFailed(false);
  }, [
    surface,
    phase,
    conn,
    isChallenger,
    streams.leftVideo,
    streams.rightVideo,
    streams.leftAudio,
    streams.rightAudio,
    battle.challenger_cover_url,
    battle.opponent_cover_url,
  ]);

  // Stop + upload when the debate clock ends
  useEffect(() => {
    if (phase !== "ended") return;
    void flushReplay();
  }, [phase, flushReplay]);

  // Last-resort save if the tab is closing while a recording is in progress.
  useEffect(() => {
    if (!isChallenger) return;
    const onPageHide = () => {
      void flushReplay();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [isChallenger, flushReplay]);

  const handleTileTap = (side: "left" | "right") => {
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

  // Replay: same dual 3:4 cards as photo battles (not one tall full-width card).
  if (phase === "ended" && replayUrl) {
    const expanded = !!expandedSide;
    if (expanded) {
      return (
        <div className={`relative flex h-full w-full items-center justify-center ${className}`}>
          <div
            className={`relative overflow-hidden rounded-[1.35rem] bg-neutral-900 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.65)] ring-1 ring-white/15 transition-all duration-300 ${TILE_EXPANDED}`}
            onTouchEnd={(e) => {
              e.stopPropagation();
              handleTileTap(expandedSide || "left");
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onExpandSide?.(expandedSide || "left");
            }}
          >
            <ReplayVideo src={replayUrl} videoRef={replayVideoRef} />
            <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/80 via-transparent to-black/20" />
            <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
              Replay
            </div>
            <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white/80 backdrop-blur">
              Double-tap to minimize
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`relative flex w-full items-center justify-center gap-1.5 ${className}`}>
        <div
          className={`relative overflow-hidden rounded-[1.35rem] bg-neutral-900 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.65)] ring-1 ring-cyan-300/90 transition-all duration-300 ${TILE_SIZE}`}
          onTouchEnd={(e) => {
            e.stopPropagation();
            handleTileTap("left");
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onExpandSide?.("left");
          }}
        >
          {/* Left half of the composite — exact same card size as photo battles */}
          <ReplayVideo src={replayUrl} videoRef={replayVideoRef} half="left" />
          <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/80 via-transparent to-black/20" />
          <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
            Replay
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 p-2.5">
            <p className="text-sm font-black text-white drop-shadow">{leftName}</p>
          </div>
        </div>

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <span className="rounded-full bg-black/70 px-2.5 py-1 text-xs font-black tracking-widest text-white ring-1 ring-white/25">
            VS
          </span>
        </div>

        <div
          className={`relative overflow-hidden rounded-[1.35rem] bg-neutral-900 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.65)] ring-1 ring-pink-400/90 transition-all duration-300 ${TILE_SIZE}`}
          onTouchEnd={(e) => {
            e.stopPropagation();
            handleTileTap("right");
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onExpandSide?.("right");
          }}
        >
          {/* Right half of the same composite (synced by shared src + time from master) */}
          <ReplayHalfFollower src={replayUrl} masterRef={replayVideoRef} />
          <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/80 via-transparent to-black/20" />
          <div className="absolute inset-x-0 bottom-0 z-10 p-2.5">
            <p className="text-sm font-black text-white drop-shadow">{rightName}</p>
          </div>
        </div>

        {savingReplay ? (
          <div className="pointer-events-none absolute inset-x-6 bottom-2 z-30 rounded-full bg-black/65 px-3 py-1.5 text-center text-[10px] font-bold text-white/90">
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
    videoStream: MediaStream | null,
    videoRef: React.RefObject<HTMLVideoElement | null>,
    isLocalSide: boolean,
  ) => {
    const showVideo = showLiveVideo && !!videoStream;
    const isExpanded = expandedSide === side;
    const isHidden = expandedSide != null && expandedSide !== side;
    return (
      <div
        className={`relative overflow-hidden rounded-[1.35rem] bg-neutral-900 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.65)] ring-1 transition-all duration-300 ${
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
        {showVideo ? (
          <StreamVideo
            stream={videoStream}
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

  // On the feed, status copy already lives in the bottom chrome — don't stack banners
  // above the cards (that made live taller than photo and hit the heart icon).
  const showStatusBanner = surface !== "feed";

  return (
    <div className={`w-full ${className}`}>
      {showStatusBanner && (phase === "countdown" || phase === "waiting") && !expandedSide && (
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

      {showStatusBanner && phase === "live" && !expandedSide && (
        <div className="mb-2 flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-rose-300">
            <Radio className="h-3.5 w-3.5 animate-pulse" /> Live debate
          </span>
          <span className="text-[11px] font-bold tabular-nums text-white/80">
            Ends in {formatCountdown(msToEnd)}
          </span>
        </div>
      )}

      {showStatusBanner && phase === "ended" && !replayUrl && !expandedSide && (
        <div className="mb-2 rounded-2xl border border-border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
          {savingReplay || isRecording
            ? "Debate ended — saving replay…"
            : replayFailed
              ? "Debate ended — replay unavailable on this device."
              : "Debate ended — replay will appear here shortly."}
        </div>
      )}

      {/* Hidden recorder sinks — always read current LiveKit frames */}
      <video ref={leftRecRef} muted playsInline autoPlay className="pointer-events-none absolute h-px w-px opacity-0" aria-hidden />
      <video ref={rightRecRef} muted playsInline autoPlay className="pointer-events-none absolute h-px w-px opacity-0" aria-hidden />

      <div
        className={`relative flex w-full items-center justify-center gap-1.5 ${
          expandedSide ? "h-full" : ""
        }`}
      >
        {tile(
          "left",
          leftName,
          leftCover,
          streams.leftVideo,
          leftVideoRef,
          user?.id === battle.challenger_id,
        )}
        {!expandedSide ? (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
            <span className="rounded-full bg-black/70 px-2.5 py-1 text-xs font-black tracking-widest text-white ring-1 ring-white/25">
              VS
            </span>
          </div>
        ) : null}
        {tile(
          "right",
          rightName,
          rightCover,
          streams.rightVideo,
          rightVideoRef,
          user?.id === battle.opponent_id,
        )}
      </div>

      {/* Remote debate audio — LiveKit track.attach (never play your own mic back) */}
      {phase === "live" && (
        <DebateAudioSink
          left={user?.id === battle.challenger_id ? null : audioTracks.left}
          right={user?.id === battle.opponent_id ? null : audioTracks.right}
          enabled={soundOn || surface === "battle"}
          preferPlaybackSession={!canPublish}
          startAudio={startAudio}
          onBlocked={() => setSoundBlocked(true)}
          onPlaying={() => {
            setSoundBlocked(false);
            setSoundOn(true);
          }}
        />
      )}

      {/* Spectators only — overlay so it doesn't stretch the card stack taller than photo. */}
      {phase === "live" && surface === "feed" && !canPublish && (soundBlocked || !soundOn) && (
        <button
          type="button"
          onClick={() => {
            forceIosAudioSessionToPlayback();
            void unlockFeedAudioSession();
            setSoundOn(true);
            setSoundBlocked(false);
            void startAudio();
          }}
          className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-black shadow-lg"
        >
          <Mic className="h-3.5 w-3.5" /> Tap for debate audio
        </button>
      )}

      {showPublisherControls && (
        <div className="flex items-center justify-center gap-2">
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

      {phase === "live" && surface === "feed" && !user && (
        <p className="text-center text-[11px] text-white/60">Sign in to watch the live debate with audio.</p>
      )}

      {error && showPublisherControls && (
        <p className="text-center text-[11px] text-rose-300">{error}</p>
      )}
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
