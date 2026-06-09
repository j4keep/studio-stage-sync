import { useRef } from "react";

interface Props {
  value: number;
  min: number;
  max: number;
  step?: number;
  size?: number;
  label?: string;
  unit?: string;
  onChange: (v: number) => void;
  color?: string;
  showValue?: boolean;
}

export function Knob({ value, min, max, step = 0.01, size = 44, label, unit, onChange, color = "#fff", showValue = true }: Props) {
  const startX = useRef(0);
  const startY = useRef(0);
  const startVal = useRef(0);
  const activePointer = useRef<number | null>(null);
  const range = max - min;
  const norm = (value - min) / range;
  const angle = -135 + norm * 270;

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    activePointer.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    startY.current = e.clientY;
    startVal.current = value;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (activePointer.current !== e.pointerId || !(e.buttons & 1)) return;
    e.preventDefault();
    e.stopPropagation();
    const dx = e.clientX - startX.current;
    const dy = startY.current - e.clientY;
    const delta = ((dx + dy) / 140) * range;
    let next = startVal.current + delta;
    next = Math.round(next / step) * step;
    next = Math.max(min, Math.min(max, next));
    onChange(next);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (activePointer.current !== e.pointerId) return;
    activePointer.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };
  const onDoubleClick = (e: React.MouseEvent) => { e.stopPropagation(); onChange((max + min) / 2); };

  return (
    <div className="flex flex-col items-center select-none">
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        style={{ width: size, height: size }}
        className="relative cursor-ew-resize rounded-full bg-neutral-900 border border-neutral-700 shadow-inner touch-none"
      >
        <div
          className="absolute left-1/2 top-1/2 origin-bottom"
          style={{
            width: 2,
            height: size * 0.4,
            background: color,
            transform: `translate(-50%, -100%) rotate(${angle}deg)`,
            transformOrigin: "50% 100%",
          }}
        />
        <div
          className="absolute inset-1 rounded-full border border-neutral-800"
          style={{ background: "radial-gradient(circle at 30% 30%, #2a2a2a, #0a0a0a)" }}
        />
        <div
          className="absolute left-1/2 top-1/2 origin-bottom"
          style={{
            width: 2,
            height: size * 0.35,
            background: color,
            transform: `translate(-50%, -100%) rotate(${angle}deg)`,
            transformOrigin: "50% 100%",
            borderRadius: 1,
          }}
        />
      </div>
      {label && <div className="text-[9px] uppercase tracking-wider text-neutral-400 mt-1">{label}</div>}
      {showValue && (
        <div className="text-[10px] text-neutral-300 tabular-nums">
          {value.toFixed(step >= 1 ? 0 : 2)}{unit}
        </div>
      )}
    </div>
  );
}
