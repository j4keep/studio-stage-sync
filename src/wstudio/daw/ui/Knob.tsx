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
  const range = max - min;
  const norm = Math.max(0, Math.min(1, (value - min) / range));
  const angle = -135 + norm * 270;

  const dragRef = useRef<{ x: number; y: number; v: number; pid: number } | null>(null);
  const elRef = useRef<HTMLDivElement>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { x: e.clientX, y: e.clientY, v: value, pid: e.pointerId };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pid !== e.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - d.x;
    const dy = d.y - e.clientY; // up = +
    const delta = ((dx + dy) / 140) * range;
    let next = d.v + delta;
    next = Math.round(next / step) * step;
    next = Math.max(min, Math.min(max, next));
    onChange(next);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d && elRef.current) {
      try { elRef.current.releasePointerCapture(d.pid); } catch {}
    }
    dragRef.current = null;
  };

  const onDoubleClick = (e: React.MouseEvent) => { e.stopPropagation(); onChange((max + min) / 2); };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = (e.deltaY > 0 ? -1 : 1) * (range / 100);
    let next = value + delta;
    next = Math.round(next / step) * step;
    next = Math.max(min, Math.min(max, next));
    onChange(next);
  };

  return (
    <div className="flex flex-col items-center select-none">
      <div
        ref={elRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
        style={{ width: size, height: size, touchAction: "none" }}
        className="relative cursor-ew-resize rounded-full bg-neutral-900 border border-neutral-700 shadow-inner"
      >
        <div
          className="absolute inset-1 rounded-full border border-neutral-800 pointer-events-none"
          style={{ background: "radial-gradient(circle at 30% 30%, #2a2a2a, #0a0a0a)" }}
        />
        <div
          className="absolute left-1/2 top-1/2 origin-bottom pointer-events-none"
          style={{
            width: 2,
            height: size * 0.38,
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
