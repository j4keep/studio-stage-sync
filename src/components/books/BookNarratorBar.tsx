import { Pause, Play, Square, ChevronLeft, ChevronRight } from "lucide-react";
import YajBuddyIcon from "@/components/YajBuddyIcon";
import {
  BOOK_NARRATION_SPEEDS,
  type BookNarrationSpeedId,
} from "@/lib/books/book-narration";
import type { BookNarrationStatus } from "@/hooks/useBookNarration";

type Props = {
  mode: "adult" | "kids";
  visible: boolean;
  status: BookNarrationStatus;
  speed: BookNarrationSpeedId;
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
 * Compact book-like narration chrome — stays secondary to the page text.
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
  const active =
    status === "playing" || status === "preparing" || status === "reading" || status === "paused";
  const speedMeta = BOOK_NARRATION_SPEEDS.find((s) => s.id === speed);

  if (!visible && !active) return null;

  const shell = kids
    ? "border-orange-200/70 bg-white/92 text-stone-800 shadow-md shadow-orange-200/30"
    : "border-stone-300/40 bg-[#F7F1E8]/92 text-stone-800 shadow-md shadow-stone-900/8";

  const iconBtn = kids
    ? "rounded-full bg-orange-50/90 text-orange-700 disabled:opacity-30"
    : "rounded-full bg-stone-900/[0.04] text-stone-600 disabled:opacity-30";

  const primaryBtn = kids
    ? "rounded-full bg-orange-500 text-white"
    : "rounded-full bg-stone-900 text-[#F7F1E8]";

  const centerLabel =
    status === "preparing" ? "Preparing…" : status === "reading" ? "Reading" : null;

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-opacity duration-200 ${
        visible || active ? "opacity-100" : "opacity-0"
      }`}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div
        className={`pointer-events-auto w-full max-w-sm rounded-xl border px-1.5 py-1 backdrop-blur-md ${shell}`}
        role="group"
        aria-label="Read to me"
      >
        <div className="flex items-center gap-1">
          {!active ? (
            <button
              type="button"
              onClick={onTogglePlay}
              className={`flex h-8 flex-1 items-center justify-center gap-1.5 px-2.5 text-[12px] font-semibold tracking-tight ${primaryBtn}`}
            >
              <YajBuddyIcon className="h-4 w-4" active={kids} />
              Read to me
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onPrev}
                disabled={!canPrev}
                className={`flex h-8 w-8 items-center justify-center ${iconBtn}`}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={onTogglePlay}
                className={`flex h-8 flex-1 items-center justify-center gap-1.5 px-2 text-[12px] font-semibold ${primaryBtn}`}
                aria-label={
                  status === "paused"
                    ? "Resume reading"
                    : status === "preparing"
                      ? "Preparing voice"
                      : status === "reading"
                        ? "Reading"
                        : "Pause reading"
                }
              >
                <YajBuddyIcon className="h-4 w-4" active={status === "playing" || status === "reading"} />
                {centerLabel ? (
                  centerLabel
                ) : status === "paused" ? (
                  <Play className="h-3 w-3 fill-current" />
                ) : (
                  <Pause className="h-3 w-3 fill-current" />
                )}
              </button>

              <button
                type="button"
                onClick={onNext}
                disabled={!canNext}
                className={`flex h-8 w-8 items-center justify-center ${iconBtn}`}
                aria-label="Next page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={onStop}
                className={`flex h-8 w-8 items-center justify-center ${iconBtn}`}
                aria-label="Stop reading"
              >
                <Square className="h-2.5 w-2.5 fill-current" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onCycleSpeed}
            className={`flex h-8 min-w-[2.6rem] items-center justify-center px-1.5 text-[10px] font-semibold tabular-nums ${iconBtn}`}
            aria-label={`Reading speed: ${speedMeta?.label ?? "1×"}. Tap to change.`}
            title="Reading speed"
          >
            {speedMeta?.label ?? "1×"}
          </button>
        </div>

        {(status === "idle" || status === "error" || !active) && (
          <p className={`px-1 pb-0.5 pt-0.5 text-center text-[9px] ${kids ? "font-bold text-orange-700/75" : "text-stone-500"}`}>
            YAJ · {voiceLabel}
          </p>
        )}

        {errorMessage ? (
          <p className="px-1 pb-0.5 text-center text-[10px] font-medium text-red-600">{errorMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
