interface Props {
  recording: boolean;
  progress: number;
  disabled?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
}

const SIZE = 76;
const STROKE = 4;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const INNER_INSET = 13;

export default function RecordButton({
  recording,
  progress,
  disabled,
  onPointerDown,
  onPointerUp,
}: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  const offset = C * (1 - clamped);

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
      className="relative touch-none select-none disabled:opacity-40 transition-transform active:scale-[0.97]"
      style={{ width: SIZE, height: SIZE, WebkitTouchCallout: "none" }}
      aria-label={recording ? "Recording" : "Hold to record up to 60 seconds"}
    >
      <svg
        className="absolute inset-0 -rotate-90"
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={recording ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.95)"}
          strokeWidth={STROKE}
        />
        {recording && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="#ff0069"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-75"
          />
        )}
      </svg>

      {recording ? (
        <div
          className="absolute rounded-full bg-white/30 backdrop-blur-[1px] flex items-center justify-center transition-all"
          style={{ inset: INNER_INSET - 2 }}
        >
          <div className="w-[1.35rem] h-[1.35rem] rounded-[5px] bg-white shadow-sm" />
        </div>
      ) : (
        <div
          className="absolute rounded-full bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.15)]"
          style={{ inset: INNER_INSET }}
        />
      )}
    </button>
  );
}
