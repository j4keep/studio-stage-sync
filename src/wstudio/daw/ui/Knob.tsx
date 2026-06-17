import { useEffect, useRef } from "react";

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

  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const commitValue = (next: number) => {
    next = Math.round(next / step) * step;
    next = Math.max(min, Math.min(max, next));
    valueRef.current = next;
    onChangeRef.current(next);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startValue = valueRef.current;
    const pointerId = e.pointerId;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      ev.preventDefault();
      const dx = ev.clientX - startX;
      const dy = startY - ev.clientY;
      commitValue(startValue + ((dx + dy) / 120) * range);
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      try { elRef.current?.releasePointerCapture(pointerId); } catch {}
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const onDoubleClick = (e: React.MouseEvent) => { e.stopPropagation(); commitValue((max + min) / 2); };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    commitValue(valueRef.current + (e.deltaY > 0 ? -1 : 1) * (range / 100));
  };

  return (
    <div className="flex flex-col items-center select-none">
      <div
        ref={elRef}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
        onClick={(e) => e.stopPropagation()}
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
