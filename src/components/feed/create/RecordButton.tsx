import { Camera, Type } from "lucide-react";

interface Props {
  recording: boolean;
  progress: number;
  disabled?: boolean;
  label?: string;
  mode?: "hold" | "tap-photo" | "tap-text";
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onTap?: () => void;
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
  mode = "hold",
  onPointerDown,
  onPointerUp,
  onTap,
}: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  const offset = C * (1 - clamped);
  const isTap = mode !== "hold";

  return (
    <div className="relative flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onPointerDown={isTap ? undefined : onPointerDown}
        onPointerUp={isTap ? undefined : onPointerUp}
        onPointerCancel={isTap ? undefined : onPointerUp}
        onClick={isTap ? onTap : undefined}
        onContextMenu={(e) => e.preventDefault()}
        className="relative touch-none select-none disabled:opacity-40 active:scale-[0.97] transition-transform"
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
          {mode === "hold" && (
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
          )}
        </svg>
        <div
          className={`absolute inset-[10px] rounded-full border-[4px] flex items-center justify-center transition-all ${
            mode === "tap-text"
              ? "border-violet-300 bg-violet-500/20"
              : mode === "tap-photo"
                ? "border-cyan-300 bg-cyan-500/15"
                : recording
                  ? "border-white bg-red-500/25 scale-95"
                  : "border-white bg-white/10"
          }`}
        >
          {recording ? (
            <div className="w-6 h-6 rounded-md bg-red-500" />
          ) : mode === "tap-photo" ? (
            <Camera className="w-8 h-8 text-white" strokeWidth={2} />
          ) : mode === "tap-text" ? (
            <Type className="w-8 h-8 text-white" strokeWidth={2.25} />
          ) : (
            <div className="w-[3.4rem] h-[3.4rem] rounded-full bg-white" />
          )}
        </div>
      </button>
      {!recording && label && (
        <span className="text-[10px] font-semibold text-white/50 max-w-[7rem] text-center leading-tight">
          {label}
        </span>
      )}
    </div>
  );
}
