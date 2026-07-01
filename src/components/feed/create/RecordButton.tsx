interface Props {
  recording: boolean;
  progress: number;
  disabled?: boolean;
  label?: string;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

const SIZE = 84;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export default function RecordButton({
  recording,
  progress,
  disabled,
  label = "Hold to record",
  onPointerDown,
  onPointerUp,
}: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  const offset = C * (1 - clamped);

  return (
    <div className="relative flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        className="relative touch-none select-none disabled:opacity-40"
        style={{ width: SIZE, height: SIZE, WebkitTouchCallout: "none" }}
        aria-label={recording ? "Recording" : label}
      >
        <svg
          className="absolute inset-0 -rotate-90"
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={recording ? "#ef4444" : "#ffffff"}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={recording ? offset : C}
            className="transition-[stroke-dashoffset] duration-75"
          />
        </svg>
        <div
          className={`absolute inset-[10px] rounded-full border-[4px] border-white flex items-center justify-center transition-all ${
            recording ? "bg-red-500/25 scale-95" : "bg-white/10"
          }`}
        >
          {recording ? (
            <div className="w-6 h-6 rounded-md bg-red-500" />
          ) : (
            <div className="w-[3.4rem] h-[3.4rem] rounded-full bg-white" />
          )}
        </div>
      </button>
      {!recording && (
        <span className="text-[10px] font-semibold text-white/50">{label}</span>
      )}
    </div>
  );
}
