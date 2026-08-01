import { Pause, Play, X } from "lucide-react";
import type { AmbientTrack } from "@/lib/wellness-ambient-catalog";

type Props = {
  track: AmbientTrack;
  emoji?: string;
  playing: boolean;
  remainingSec: number | null;
  onToggle: () => void;
  onExpand: () => void;
  onDismiss: () => void;
};

function formatRemaining(sec: number) {
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/** Spotify-style floating mini player for Relax sounds. */
export default function RelaxNowPlayingBar({
  track,
  emoji = "🎧",
  playing,
  remainingSec,
  onToggle,
  onExpand,
  onDismiss,
}: Props) {
  return (
    <div className="feed-bottom-offset fixed inset-x-3 z-[80]">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#10221e]/95 px-3 py-2.5 shadow-[0_16px_40px_-18px_rgba(0,0,0,0.75)] backdrop-blur-xl">
        <button
          type="button"
          onClick={onExpand}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${track.art} text-lg ring-1 ring-white/15`}
          >
            {emoji}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-white">{track.title}</span>
            <span className="block text-[11px] font-semibold text-teal-100/55">
              {remainingSec != null
                ? `${formatRemaining(remainingSec)} remaining`
                : playing
                  ? "Now playing"
                  : "Paused"}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-300 text-teal-950"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          )}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70"
          aria-label="Stop and close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
