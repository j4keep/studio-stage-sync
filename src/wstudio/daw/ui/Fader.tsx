import { useRef } from "react";

interface Props {
  value: number; // 0..1
  onChange: (v: number) => void;
  height?: number;
  color?: string;
}

export function Fader({ value, onChange, height = 160, color = "#22d3ee" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const handle = (clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const y = clientY - rect.top;
    const t = 1 - Math.max(0, Math.min(1, y / rect.height));
    onChange(t);
  };

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        handle(e.clientY);
      }}
      onPointerMove={(e) => {
        if (!(e.buttons & 1)) return;
        handle(e.clientY);
      }}
      className="relative w-7 bg-neutral-950 border border-neutral-800 rounded-sm mx-auto cursor-ns-resize"
      style={{ height }}
    >
      {/* track */}
      <div className="absolute left-1/2 top-2 bottom-2 -translate-x-1/2 w-px bg-neutral-700" />
      {/* fill */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-1 rounded"
        style={{
          bottom: 8,
          height: `calc((100% - 16px) * ${value})`,
          background: color,
          opacity: 0.7,
        }}
      />
      {/* cap */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-5 h-3 rounded-sm border border-neutral-600 shadow"
        style={{
          bottom: `calc(8px + (100% - 16px) * ${value} - 6px)`,
          background: "linear-gradient(180deg, #444, #1a1a1a)",
        }}
      />
    </div>
  );
}
