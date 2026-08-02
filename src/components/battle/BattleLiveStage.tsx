import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Radio, Video, VideoOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBattleLiveRoom } from "@/hooks/useBattleLiveRoom";
import { formatCountdown } from "@/lib/battle-ui";
import { getLiveBattlePhase } from "@/lib/battle-live";
import { startBattleLiveRecorder, type BattleLiveRecorder } from "@/lib/battle-live-record";
import { uploadToR2, getR2DownloadUrl } from "@/lib/r2-storage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
};

type Props = {
  battle: BattleLike;
  leftName: string;
  rightName: string;
  /** Compact layout for feed slide */
  compact?: boolean;
  className?: string;
};

function StreamVideo({
  stream,
  muted,
  className,
  videoRef,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
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
      className={className}
    />
  );
}

export default function BattleLiveStage({
  battle,
  leftName,
  rightName,
  compact = false,
  className = "",
}: Props) {
  const { user } = useAuth();
  const [now, setNow] = useState(Date.now());
  const leftVideoRef = useRef<HTMLVideoElement | null>(null);
  const rightVideoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<BattleLiveRecorder | null>(null);
  const recordingStartedRef = useRef(false);
  const uploadingReplayRef = useRef(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const phase = getLiveBattlePhase(battle, now);
  const isParticipant =
    !!user && (user.id === battle.challenger_id || user.id === battle.opponent_id);
  const canPublish = isParticipant && phase === "live";
  const roomEnabled = !!user && phase === "live";

  const { conn, error, micOn, camOn, streams, remoteCount, toggleMic, toggleCam } =
    useBattleLiveRoom({
      battleId: battle.id,
      challengerId: battle.challenger_id,
      opponentId: battle.opponent_id,
      enabled: roomEnabled && phase !== "ended",
      canPublish,
    });

  const startMs = battle.scheduled_start_at
    ? new Date(battle.scheduled_start_at).getTime()
    : null;
  const endMs = battle.expires_at ? new Date(battle.expires_at).getTime() : null;
  const msToStart = startMs != null ? Math.max(0, startMs - now) : 0;
  const msToEnd = endMs != null ? Math.max(0, endMs - now) : 0;

  // Challenger records the composite replay while live
  useEffect(() => {
    if (phase !== "live" || user?.id !== battle.challenger_id) return;
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
    streams.leftVideo,
    streams.rightVideo,
    streams.leftAudio,
    streams.rightAudio,
  ]);

  // Stop recorder + upload when debate ends
  useEffect(() => {
    if (phase !== "ended") return;
    if (!recordingStartedRef.current || uploadingReplayRef.current) return;
    if (user?.id !== battle.challenger_id) return;
    if (battle.replay_media_url) return;

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
        await (supabase as any)
          .from("battles")
          .update({ replay_media_url: url })
          .eq("id", battle.id)
          .eq("challenger_id", user.id);
        toast.success("Live debate replay saved");
      } catch {
        /* best-effort */
      }
    })();
  }, [phase, user, battle.id, battle.challenger_id, battle.replay_media_url]);

  const leftCover = battle.challenger_cover_url;
  const rightCover = battle.opponent_cover_url;
  const replayUrl = battle.replay_media_url;

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
    mutedLocal: boolean,
  ) => (
    <div
      className={`relative min-w-0 flex-1 overflow-hidden rounded-[1.2rem] bg-neutral-900 ring-1 ${
        side === "left" ? "ring-cyan-300/90" : "ring-pink-400/90"
      } ${compact ? "aspect-[3/4] max-h-[min(52dvh,420px)]" : "aspect-[3/4]"}`}
    >
      {phase === "live" && videoStream ? (
        <StreamVideo
          stream={videoStream}
          muted={mutedLocal}
          videoRef={videoRef}
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
      <div className="absolute inset-x-0 bottom-0 z-10 p-2.5">
        <p className="text-sm font-black text-white drop-shadow">{name}</p>
      </div>
    </div>
  );

  return (
    <div className={`space-y-2 ${className}`}>
      {(phase === "countdown" || phase === "waiting") && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">
            {phase === "waiting" ? "Waiting for opponent" : "Debate starts in"}
          </p>
          {phase === "countdown" && (
            <p className="mt-1 font-display text-3xl font-black tabular-nums text-white">
              {formatCountdown(msToStart)}
            </p>
          )}
          {isParticipant && phase === "countdown" && (
            <p className="mt-1 text-[11px] text-white/70">
              Stay on this page — cameras open when the timer hits zero.
            </p>
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
          Debate ended{isParticipant && user?.id === battle.challenger_id ? " — saving replay…" : ". Replay will appear here shortly."}
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

      {/* Spectator / remote audio */}
      {phase === "live" && streams.leftAudio && user?.id !== battle.challenger_id && (
        <StreamAudio stream={streams.leftAudio} />
      )}
      {phase === "live" && streams.rightAudio && user?.id !== battle.opponent_id && (
        <StreamAudio stream={streams.rightAudio} />
      )}

      {phase === "live" && isParticipant && (
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
          {conn === "connected" && (
            <span className="text-[11px] text-white/60">
              {remoteCount > 0 ? "Opponent connected" : "Waiting for opponent…"}
            </span>
          )}
        </div>
      )}

      {phase === "live" && !user && (
        <p className="text-center text-[11px] text-white/60">Sign in to watch the live debate with audio.</p>
      )}

      {error && (
        <p className="text-center text-[11px] text-rose-300">{error}</p>
      )}
    </div>
  );
}

function StreamAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => undefined);
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}
