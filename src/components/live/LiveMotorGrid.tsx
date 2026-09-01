import { useEffect, useRef, useState } from "react";
import { MicOff, Minimize2, UserRound } from "lucide-react";
import type { RoomParticipant } from "@/pages/podcast/usePodcastLiveRoom";

type Props = {
  participants: RoomParticipant[];
  /** Host local preview mirror */
  hostCssFilter?: string;
  canvasIsLive?: boolean;
  focusedId: string | null;
  onFocusChange: (id: string | null) => void;
};

/**
 * Bigo-style motor grid — tile count = people on stage (not a fixed preset).
 * 1 → full · 2 → split · 3+ → equal boxes · tap a tile for fullscreen.
 */
export default function LiveMotorGrid({
  participants,
  hostCssFilter,
  canvasIsLive,
  focusedId,
  onFocusChange,
}: Props) {
  const count = participants.length;
  const focused = focusedId ? participants.find((p) => p.id === focusedId) : null;

  if (focused) {
    return (
      <div className="relative h-full w-full bg-black">
        <MotorTile
          participant={focused}
          index={0}
          hostCssFilter={hostCssFilter}
          canvasIsLive={canvasIsLive}
          focused
          onTap={() => onFocusChange(null)}
        />
        <button
          type="button"
          onClick={() => onFocusChange(null)}
          className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[12px] font-bold text-white backdrop-blur-sm"
        >
          <Minimize2 className="h-3.5 w-3.5" /> Back to grid
        </button>
      </div>
    );
  }

  return (
    <div className={`grid h-full w-full gap-0.5 bg-black ${motorGridClass(count)}`}>
      {participants.map((p, i) => (
        <MotorTile
          key={p.id}
          participant={p}
          index={i}
          hostCssFilter={hostCssFilter}
          canvasIsLive={canvasIsLive}
          onTap={() => onFocusChange(p.id)}
        />
      ))}
    </div>
  );
}

function motorGridClass(count: number): string {
  if (count <= 1) return "grid-cols-1 grid-rows-1";
  if (count === 2) return "grid-cols-2 grid-rows-1";
  if (count === 3) return "grid-cols-2 grid-rows-2 [&>*:first-child]:row-span-2";
  if (count === 4) return "grid-cols-2 grid-rows-2";
  if (count <= 6) return "grid-cols-3 grid-rows-2";
  return "grid-cols-3 grid-rows-3";
}

function MotorTile({
  participant,
  index,
  hostCssFilter,
  canvasIsLive,
  focused,
  onTap,
}: {
  participant: RoomParticipant;
  index: number;
  hostCssFilter?: string;
  canvasIsLive?: boolean;
  focused?: boolean;
  onTap: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const speaking = participant.micOn && participant.level > 0.08;
  const mirrored = participant.isLocal && participant.isHost;
  const cssFilter =
    participant.isLocal && participant.isHost && !canvasIsLive ? hostCssFilter : undefined;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const tracks = [participant.videoTrack, participant.audioTrack].filter(
      Boolean,
    ) as MediaStreamTrack[];
    el.srcObject = tracks.length ? new MediaStream(tracks) : null;
    if (tracks.length) {
      el.play()
        .then(() => setNeedsTap(false))
        .catch(() => setNeedsTap(true));
    }
  }, [participant.videoTrack, participant.audioTrack]);

  const slotLabel = participant.isHost ? "Host" : String(index);

  return (
    <button
      type="button"
      onClick={onTap}
      className={`relative min-h-0 min-w-0 overflow-hidden bg-neutral-900 text-left ${
        focused ? "h-full w-full" : ""
      } ${speaking ? "ring-2 ring-inset ring-emerald-400" : ""}`}
    >
      {participant.videoTrack && participant.camOn ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          className={`h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""}`}
          style={cssFilter && cssFilter !== "none" ? { filter: cssFilter } : undefined}
        />
      ) : (
        <>
          {/* Keep remote audio alive when cam is off */}
          {!participant.isLocal && participant.audioTrack && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="pointer-events-none absolute h-px w-px opacity-0"
            />
          )}
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-neutral-800 to-neutral-950 text-white/70">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
              <UserRound className="h-7 w-7" />
            </span>
            <span className="max-w-[90%] truncate px-2 text-[12px] font-bold text-white/90">
              {participant.name}
            </span>
          </div>
        </>
      )}

      {needsTap && !participant.isLocal && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 text-white">
          <span className="text-2xl">🔊</span>
          <span className="text-[11px] font-bold">Tap for sound</span>
        </span>
      )}

      {/* Slot chrome */}
      <span className="absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
        {slotLabel}
      </span>
      {!participant.micOn && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1 text-white">
          <MicOff className="h-3 w-3" />
        </span>
      )}
      <span className="absolute bottom-5 left-1.5 right-8 truncate text-[11px] font-bold text-white drop-shadow">
        {participant.name}
      </span>

      {participant.micOn && (
        <span className="absolute bottom-1.5 left-1.5 right-1.5 h-1 overflow-hidden rounded-full bg-black/40">
          <span
            className="block h-full bg-gradient-to-r from-emerald-400 to-primary transition-[width] duration-75"
            style={{ width: `${Math.min(100, Math.round(participant.level * 140))}%` }}
          />
        </span>
      )}
    </button>
  );
}
