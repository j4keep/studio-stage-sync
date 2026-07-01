interface Props {
  recording: boolean;
  progress: number;
  disabled?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
}

const SIZE = 64;
const STROKE = 3.5;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

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
    <div className="relative flex flex-col items-center">
      <button
        type="button"
        disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        className={`relative touch-none select-none disabled:opacity-40 transition-transform active:scale-95 ${
          recording ? "" : "animate-[pulse_2.5s_ease-in-out_infinite]"
        }`}
        style={{ width: SIZE, height: SIZE, WebkitTouchCallout: "none" }}
        aria-label={recording ? "Recording" : "Hold to record up to 60 seconds"}
      >
        {!recording && (
          <span
            className="absolute inset-[-6px] rounded-full opacity-70 blur-md pointer-events-none"
            style={{
              background:
                "conic-gradient(from 180deg, #d946ef, #8b5cf6, #22d3ee, #d946ef)",
            }}
            aria-hidden
          />
        )}

        <svg
          className="absolute inset-0 -rotate-90 drop-shadow-[0_0_8px_rgba(255,255,255,0.25)]"
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
        >
          <defs>
            <linearGradient id="jhiRecordRing" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d946ef" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={recording ? "#ef4444" : "url(#jhiRecordRing)"}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={recording ? offset : C * 0.08}
            className="transition-[stroke-dashoffset] duration-75"
          />
        </svg>

        <div
          className={`absolute inset-[9px] rounded-full flex items-center justify-center transition-all ${
            recording
              ? "bg-red-500/30 border-2 border-white/90 scale-95"
              : "bg-white/95 border-2 border-white shadow-[inset_0_0_12px_rgba(168,85,247,0.35)]"
          }`}
        >
          {recording ? (
            <div className="w-4 h-4 rounded-[3px] bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-fuchsia-400 via-violet-400 to-cyan-400 opacity-90" />
          )}
        </div>
      </button>
    </div>
  );
}
