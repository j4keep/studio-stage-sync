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
  const norm = (value - min) / range;
  const angle = -135 + norm * 270;

  // Use refs so window-level listeners always see latest values
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const dragRef = useRef<{ x: number; y: number; v: number } | null>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      const dx = e.clientX - d.x;
      const dy = d.y - e.clientY;
      const delta = ((dx + dy) / 140) * range;
      let next = d.v + delta;
      next = Math.round(next / step) * step;
      next = Math.max(min, Math.min(max, next));
      onChangeRef.current(next);
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [min, max, range, step]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { x: e.clientX, y: e.clientY, v: valueRef.current };
  };
  const onDoubleClick = (e: React.MouseEvent) => { e.stopPropagation(); onChange((max + min) / 2); };

  return (
    <div className="flex flex-col items-center select-none">
      <div
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        style={{ width: size, height: size }}
        className="relative cursor-ew-resize rounded-full bg-neutral-900 border border-neutral-700 shadow-inner touch-none"
      >
        <div
          className="absolute inset-1 rounded-full border border-neutral-800"
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
