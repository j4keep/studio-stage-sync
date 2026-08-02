import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Mic, MicOff, Radio, Video, VideoOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBattleLiveRoom } from "@/hooks/useBattleLiveRoom";
import { formatCountdown } from "@/lib/battle-ui";
import {
  buildLiveBattleBackground,
  getBattleReplayMediaUrl,
  getBattleScheduledStartAt,
  getLiveBattleEndsAt,
  getLiveBattlePhase,
  isMissingLiveBattleColumnError,
} from "@/lib/battle-live";
import { startBattleLiveRecorder, type BattleLiveRecorder } from "@/lib/battle-live-record";
import { uploadToR2, getR2DownloadUrl } from "@/lib/r2-storage";
import { supabase } from "@/integrations/supabase/client";
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
  className?: string;
};

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
  className = "",
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  const leftVideoRef = useRef<HTMLVideoElement | null>(null);
  const rightVideoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<BattleLiveRecorder | null>(null);
  const recordingStartedRef = useRef(false);
  const uploadingReplayRef = useRef(false);
  const redirectedRef = useRef(false);
  const prevPhaseRef = useRef<string | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);

  const phase = getLiveBattlePhase(battle, now);
  const isParticipant =
    !!user && (user.id === battle.challenger_id || user.id === battle.opponent_id);

  // Competitors publish on battle page during countdown (prep), then on feed once live.
  // Spectators never get mic/cam controls.
  const canPublish =
    isParticipant &&
    ((surface === "battle" && (phase === "countdown" || phase === "live")) ||
      (surface === "feed" && phase === "live"));
  const roomEnabled =
    !!user &&
    phase !== "ended" &&
    phase !== "waiting" &&
    (surface === "battle"
      ? isParticipant && (phase === "countdown" || phase === "live")
      : phase === "live");

  // Mic/cam toggles only on the competitor battle page — never on the public post/feed.
  const showPublisherControls =
    surface === "battle" && isParticipant && (phase === "countdown" || phase === "live");
  const showLiveVideo =
    phase === "live" || (surface === "battle" && isParticipant && phase === "countdown");

  const { conn, error, micOn, camOn, streams, remoteCount, toggleMic, toggleCam } =
    useBattleLiveRoom({
      battleId: battle.id,
      challengerId: battle.challenger_id,
      opponentId: battle.opponent_id,
      enabled: roomEnabled,
      canPublish,
    });

  const scheduledStartAt = getBattleScheduledStartAt(battle);
  const replayUrl = getBattleReplayMediaUrl(battle);
  const startMs = scheduledStartAt ? new Date(scheduledStartAt).getTime() : null;
  const endMs = getLiveBattleEndsAt(battle).getTime();
  const msToStart = startMs != null ? Math.max(0, startMs - now) : 0;
  const msToEnd = Math.max(0, endMs - now);
  const [soundOn, setSoundOn] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);

  // Try unlocking debate audio as soon as the post goes live (iOS may still require a tap).
  useEffect(() => {
    if (phase !== "live") return;
    if (surface === "battle") {
      setSoundOn(true);
      return;
    }
    forceIosAudioSessionToPlayback();
    unlockFeedAudioSession();
    setSoundOn(true);
  }, [phase, surface]);

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

  // Challenger records the composite replay while live (on whichever surface is connected as publisher)
  useEffect(() => {
    if (phase !== "live" || user?.id !== battle.challenger_id) return;
    if (surface !== "battle" && surface !== "feed") return;
    // Prefer recording from feed once live (both may be connected; challenger usually lands on feed).
    if (surface === "battle") return;
    if (recordingStartedRef.current || conn !== "connected") return;
    if (!streams.leftVideo && !streams.rightVideo) return;

    const rec = startBattleLiveRecorder({
      leftVideoEl: leftVideoRef.current,
      rightVideoEl: rightVideoRef.current,
      leftAudio: streams.leftAudio,
      rightAudio: streams.rightAudio,
    });
    if (!rec) return;
    recorderRef.current = rec;
    recordingStartedRef.current = true;
  }, [
    phase,
    conn,
    user?.id,
    battle.challenger_id,
    surface,
    streams.leftVideo,
    streams.rightVideo,
    streams.leftAudio,
    streams.rightAudio,
  ]);

  // Also allow challenger to record if they stay on battle page (no redirect yet / desktop)
  useEffect(() => {
    if (phase !== "live" || user?.id !== battle.challenger_id || surface !== "battle") return;
    if (recordingStartedRef.current || conn !== "connected") return;
    if (!streams.leftVideo && !streams.rightVideo) return;
    const rec = startBattleLiveRecorder({
      leftVideoEl: leftVideoRef.current,
      rightVideoEl: rightVideoRef.current,
      leftAudio: streams.leftAudio,
      rightAudio: streams.rightAudio,
    });
    if (!rec) return;
    recorderRef.current = rec;
    recordingStartedRef.current = true;
  }, [phase, conn, user?.id, battle.challenger_id, surface, streams]);

  // Stop recorder + upload when debate ends
  useEffect(() => {
    if (phase !== "ended") return;
    if (!recordingStartedRef.current || uploadingReplayRef.current) return;
    if (user?.id !== battle.challenger_id) return;
    if (replayUrl) return;

    const rec = recorderRef.current;
    if (!rec) return;
    uploadingReplayRef.current = true;
    recorderRef.current = null;

    void (async () => {
      try {
        const blob = await rec.stop();
        if (!blob || !user) return;
        const file = new File([blob], `live-battle-${battle.id}.webm`, {
          type: blob.type || "video/webm",
        });
        const result = await uploadToR2(file, {
          folder: `battles/replays/${user.id}`,
          fileName: `${Date.now()}.webm`,
          mimeType: file.type,
        });
        if (!result.success || !result.data) return;
        const url = getR2DownloadUrl(result.data.key);

        let { error: updateError } = await (supabase as any)
          .from("battles")
          .update({ replay_media_url: url })
          .eq("id", battle.id)
          .eq("challenger_id", user.id);

        if (updateError && isMissingLiveBattleColumnError(updateError)) {
          ({ error: updateError } = await (supabase as any)
            .from("battles")
            .update({
              battle_background: buildLiveBattleBackground(
                {
                  scheduled_start_at: getBattleScheduledStartAt(battle),
                  replay_media_url: url,
                },
                battle.battle_background,
              ),
            })
            .eq("id", battle.id)
            .eq("challenger_id", user.id));
        }

        if (!updateError) toast.success("Live debate replay saved");
      } catch {
        /* best-effort */
      }
    })();
  }, [phase, user, battle, replayUrl]);

  const leftCover = battle.challenger_cover_url;
  const rightCover = battle.opponent_cover_url;

  if (phase === "ended" && replayUrl) {
    return (
      <div className={`relative overflow-hidden rounded-[1.35rem] bg-black ${className}`}>
        <video
          src={replayUrl}
          controls
          playsInline
          className={`w-full object-cover ${compact ? "aspect-[4/5] max-h-[min(52dvh,420px)]" : "aspect-video"}`}
        />
        <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
          Replay
        </div>
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
    return (
      <div
        className={`relative min-w-0 flex-1 overflow-hidden rounded-[1.2rem] bg-neutral-900 ring-1 ${
          side === "left" ? "ring-cyan-300/90" : "ring-pink-400/90"
        } ${compact ? "aspect-[3/4] max-h-[min(52dvh,420px)]" : "aspect-[3/4]"}`}
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

  return (
    <div className={`space-y-2 ${className}`}>
      {(phase === "countdown" || phase === "waiting") && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">
            {phase === "waiting" ? "Waiting for opponent" : "Debate starts in"}
          </p>
          {phase === "countdown" && (
            <p className="mt-1 font-display text-3xl font-black tabular-nums text-white">
              {msToStart > 0 ? Math.ceil(msToStart / 1000) : 0}s
            </p>
          )}
          {surface === "battle" && isParticipant && phase === "countdown" && (
            <p className="mt-1 text-[11px] text-white/70">
              Check your framing — when this hits zero you go live on the post.
            </p>
          )}
          {surface === "feed" && phase === "countdown" && (
            <p className="mt-1 text-[11px] text-white/70">Cover art up — cameras open when the debate starts.</p>
          )}
        </div>
      )}

      {phase === "live" && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-rose-300">
            <Radio className="h-3.5 w-3.5 animate-pulse" /> Live debate
          </span>
          <span className="text-[11px] font-bold tabular-nums text-white/80">
            Ends in {formatCountdown(msToEnd)}
          </span>
        </div>
      )}

      {phase === "ended" && !replayUrl && (
        <div className="rounded-2xl border border-border bg-muted/40 px-3 py-3 text-center text-xs text-muted-foreground">
          Debate ended
          {isParticipant && user?.id === battle.challenger_id
            ? " — saving replay…"
            : ". Replay will appear here shortly."}
        </div>
      )}

      <div className={`flex gap-2 ${compact ? "" : "min-h-[240px]"}`}>
        {tile(
          "left",
          leftName,
          leftCover,
          streams.leftVideo,
          leftVideoRef,
          user?.id === battle.challenger_id,
        )}
        {tile(
          "right",
          rightName,
          rightCover,
          streams.rightVideo,
          rightVideoRef,
          user?.id === battle.opponent_id,
        )}
      </div>

      {/* Remote debate audio — never play your own mic back */}
      {phase === "live" && (
        <DebateAudioSink
          left={user?.id === battle.challenger_id ? null : streams.leftAudio}
          right={user?.id === battle.opponent_id ? null : streams.rightAudio}
          enabled={soundOn || surface === "battle"}
          onBlocked={() => setSoundBlocked(true)}
          onPlaying={() => {
            setSoundBlocked(false);
            setSoundOn(true);
          }}
        />
      )}

      {phase === "live" && surface === "feed" && (soundBlocked || !soundOn) && (
        <button
          type="button"
          onClick={() => {
            forceIosAudioSessionToPlayback();
            void unlockFeedAudioSession();
            setSoundOn(true);
            setSoundBlocked(false);
          }}
          className="mx-auto flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-black shadow-lg"
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
  onBlocked,
  onPlaying,
}: {
  left: MediaStream | null;
  right: MediaStream | null;
  enabled: boolean;
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
    if (!enabled) return;
    forceIosAudioSessionToPlayback();
    unlockFeedAudioSession();

    let blocked = false;
    let playing = false;

    const playOne = async (el: HTMLAudioElement | null, stream: MediaStream | null) => {
      if (!el) return;
      if (!stream || stream.getAudioTracks().length === 0) {
        el.srcObject = null;
        el.pause();
        return;
      }
      if (el.srcObject !== stream) el.srcObject = stream;
      el.muted = false;
      el.volume = 1;
      try {
        await el.play();
        playing = true;
        onPlayingRef.current();
      } catch {
        blocked = true;
      }
    };

    void (async () => {
      await playOne(leftRef.current, left);
      await playOne(rightRef.current, right);
      if (blocked && !playing) onBlockedRef.current();
    })();
  }, [left, right, enabled]);

  return (
    <>
      <audio ref={leftRef} autoPlay playsInline className="hidden" />
      <audio ref={rightRef} autoPlay playsInline className="hidden" />
    </>
  );
}
