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
      className="relative w-10 bg-neutral-950 border border-neutral-800 rounded-sm mx-auto cursor-ns-resize shadow-inner shadow-black/60"
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
        className="absolute left-1/2 -translate-x-1/2 w-8 h-5 rounded-sm border border-neutral-500 shadow-[0_2px_8px_rgba(0,0,0,0.65)]"
        style={{
          bottom: `calc(8px + (100% - 16px) * ${value} - 10px)`,
          background: "linear-gradient(180deg, #5a5a5a 0%, #2d2d2d 45%, #151515 52%, #343434 100%)",
        }}
      >
        <div className="absolute left-1 right-1 top-1/2 h-px bg-white/25" />
        <div className="absolute inset-x-1 top-1 h-px bg-white/20" />
      </div>
    </div>
  );
}
