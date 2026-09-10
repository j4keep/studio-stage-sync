import { Pause, Play, Square, ChevronLeft, ChevronRight } from "lucide-react";
import YajBuddyIcon from "@/components/YajBuddyIcon";
import { COACH_VOICE_SPEEDS, type CoachVoiceSpeedId } from "@/lib/wellness-move-coach";
import type { BookNarrationStatus } from "@/hooks/useBookNarration";

type Props = {
  mode: "adult" | "kids";
  visible: boolean;
  status: BookNarrationStatus;
  speed: CoachVoiceSpeedId;
  voiceLabel: string;
  errorMessage: string | null;
  canPrev: boolean;
  canNext: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCycleSpeed: () => void;
};

/**
 * Compact book-like narration chrome — not a giant Chat Buddy button.
 * Uses the user's chosen YAJ Buddy voice (shown as the voice label).
 */
export default function BookNarratorBar({
  mode,
  visible,
  status,
  speed,
  voiceLabel,
  errorMessage,
  canPrev,
  canNext,
  onTogglePlay,
  onStop,
  onPrev,
  onNext,
  onCycleSpeed,
}: Props) {
  const kids = mode === "kids";
  const active = status === "playing" || status === "loading" || status === "paused";
  const speedLabel = COACH_VOICE_SPEEDS.find((s) => s.id === speed)?.label ?? "Normal";

  if (!visible && !active) return null;

  const shell = kids
    ? "border-orange-200/80 bg-white/95 text-stone-800 shadow-lg shadow-orange-200/40"
    : "border-stone-300/50 bg-[#F7F1E8]/95 text-stone-800 shadow-lg shadow-stone-900/10";

  const iconBtn = kids
    ? "rounded-full bg-orange-50 text-orange-700 disabled:opacity-30"
    : "rounded-full bg-stone-900/5 text-stone-700 disabled:opacity-30";

  const primaryBtn = kids
    ? "rounded-full bg-orange-500 text-white"
    : "rounded-full bg-stone-900 text-[#F7F1E8]";

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] transition-opacity duration-200 ${
        visible || active ? "opacity-100" : "opacity-0"
      }`}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div
        className={`pointer-events-auto w-full max-w-md rounded-2xl border px-2.5 py-2 backdrop-blur-md ${shell}`}
        role="group"
        aria-label="Read to me"
      >
        <div className="flex items-center gap-1.5">
          {!active ? (
            <button
              type="button"
              onClick={onTogglePlay}
              className={`flex h-10 flex-1 items-center justify-center gap-2 px-3 text-[13px] font-semibold tracking-tight ${primaryBtn}`}
            >
              <YajBuddyIcon className="h-5 w-5" active={kids} />
              Read to me
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onPrev}
                disabled={!canPrev}
                className={`flex h-9 w-9 items-center justify-center ${iconBtn}`}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onTogglePlay}
                className={`flex h-10 flex-1 items-center justify-center gap-2 px-3 text-[13px] font-semibold ${primaryBtn}`}
                aria-label={status === "paused" ? "Resume reading" : status === "loading" ? "Preparing voice" : "Pause reading"}
              >
                <YajBuddyIcon className="h-5 w-5" active={status === "playing"} />
                {status === "loading" ? (
                  "Preparing…"
                ) : status === "paused" ? (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-3.5 w-3.5 fill-current" />
                    Pause
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onNext}
                disabled={!canNext}
                className={`flex h-9 w-9 items-center justify-center ${iconBtn}`}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onStop}
                className={`flex h-9 w-9 items-center justify-center ${iconBtn}`}
                aria-label="Stop reading"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onCycleSpeed}
            className={`flex h-9 min-w-[3.25rem] items-center justify-center px-2 text-[11px] font-semibold tabular-nums ${iconBtn}`}
            aria-label={`Reading speed: ${speedLabel}. Tap to change.`}
            title="Reading speed"
          >
            {speed === "slow" ? "0.9×" : speed === "fast" ? "1.1×" : "1×"}
          </button>
        </div>

        <p className={`mt-1.5 px-1 text-center text-[10px] ${kids ? "font-bold text-orange-700/80" : "text-stone-500"}`}>
          YAJ · {voiceLabel}
          {status === "playing" ? " · reading this page" : null}
        </p>

        {errorMessage ? (
          <p className="mt-1 px-1 text-center text-[11px] font-medium text-red-600">{errorMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
