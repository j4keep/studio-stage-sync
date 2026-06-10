import { useRef } from "react";

interface Props {
  value: number; // 0..1
  onChange: (v: number) => void;
  height?: number;
  color?: string;
}

/**
 * Professional console-style fader. Wide silver cap with a recessed grip line,
 * deep slot, tick marks, and metallic shading — patterned after real mixer fader caps.
 */
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

  const CAP_H = 26;
  const PAD = 10;

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
      className="relative w-12 mx-auto cursor-ns-resize select-none"
      style={{ height }}
    >
      {/* Recessed chassis */}
      <div
        className="absolute inset-0 rounded-[3px] border border-black/80"
        style={{
          background: "linear-gradient(180deg, #1c1c1c 0%, #2a2a2a 50%, #1c1c1c 100%)",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.85), inset 0 -1px 2px rgba(255,255,255,0.04)",
        }}
      />

      {/* Tick marks (left + right of the slot) */}
      <div className="absolute inset-y-2 left-1 flex flex-col justify-between pointer-events-none">
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className="h-px bg-white/30" style={{ width: i % 5 === 0 ? 5 : 3 }} />
        ))}
      </div>
      <div className="absolute inset-y-2 right-1 flex flex-col items-end justify-between pointer-events-none">
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className="h-px bg-white/30" style={{ width: i % 5 === 0 ? 5 : 3 }} />
        ))}
      </div>

      {/* Deep slot */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-[2px]"
        style={{
          top: PAD,
          bottom: PAD,
          width: 4,
          background: "linear-gradient(90deg, #000 0%, #111 50%, #000 100%)",
          boxShadow: "inset 0 0 3px rgba(0,0,0,0.95)",
        }}
      />

      {/* Colored fill above the slot — subtle accent showing level */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-[2px] pointer-events-none"
        style={{
          bottom: PAD,
          height: `calc((100% - ${PAD * 2}px) * ${value})`,
          width: 2,
          background: color,
          opacity: 0.55,
          boxShadow: `0 0 4px ${color}`,
        }}
      />

      {/* Cap */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-[3px] pointer-events-none"
        style={{
          width: 40,
          height: CAP_H,
          bottom: `calc(${PAD}px + (100% - ${PAD * 2}px) * ${value} - ${CAP_H / 2}px)`,
          background:
            "linear-gradient(180deg, #6e6e6e 0%, #4a4a4a 18%, #2a2a2a 50%, #1a1a1a 55%, #3a3a3a 85%, #5a5a5a 100%)",
          border: "1px solid #0a0a0a",
          boxShadow:
            "0 2px 6px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.6)",
        }}
      >
        {/* Top highlight ridge */}
        <div className="absolute inset-x-1 top-[2px] h-px bg-white/40" />
        {/* Recessed grip line — the white indicator across the middle */}
        <div
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px]"
          style={{
            background: "linear-gradient(180deg, #f5f5f5 0%, #cfcfcf 50%, #8a8a8a 100%)",
            boxShadow: "0 1px 0 rgba(0,0,0,0.6), 0 -1px 0 rgba(0,0,0,0.4)",
          }}
        />
        {/* Side ridges */}
        <div className="absolute left-[3px] top-1 bottom-1 w-px bg-black/50" />
        <div className="absolute right-[3px] top-1 bottom-1 w-px bg-black/50" />
        {/* Bottom highlight */}
        <div className="absolute inset-x-1 bottom-[2px] h-px bg-white/15" />
      </div>
    </div>
  );
}
