import { useRef } from "react";

interface Props {
  value: number; // 0..1
  onChange: (v: number) => void;
  height?: number;
  color?: string;
}

/** Pro Tools-style mixer fader: narrow raised cap on a long recessed throw. */
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

  const CAP_W = 22;
  const CAP_H = 34;
  const PAD = 12;

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
      className="relative w-9 mx-auto cursor-ns-resize select-none"
      style={{ height }}
    >
      {/* Recessed chassis */}
      <div
        className="absolute inset-y-0 left-1/2 w-7 -translate-x-1/2 rounded-[2px] border border-black/80"
        style={{
          background: "linear-gradient(90deg, #171717 0%, #2d2d2d 46%, #101010 100%)",
          boxShadow: "inset 3px 0 5px rgba(0,0,0,0.78), inset -2px 0 3px rgba(255,255,255,0.05)",
        }}
      />

      {/* Tick marks (left + right of the slot) */}
      <div className="absolute inset-y-2 left-0.5 flex flex-col justify-between pointer-events-none">
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className="h-px bg-white/28" style={{ width: i % 5 === 0 ? 5 : 3 }} />
        ))}
      </div>
      <div className="absolute inset-y-2 right-0.5 flex flex-col items-end justify-between pointer-events-none">
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className="h-px bg-white/28" style={{ width: i % 5 === 0 ? 5 : 3 }} />
        ))}
      </div>

      {/* Deep slot */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-[2px]"
        style={{
          top: PAD,
          bottom: PAD,
          width: 3,
          background: "linear-gradient(90deg, #050505 0%, #3a3a3a 50%, #050505 100%)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.7), inset 0 0 3px rgba(0,0,0,0.95)",
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

      {/* Raised fader cap */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-[2px] pointer-events-none"
        style={{
          width: CAP_W,
          height: CAP_H,
          bottom: `calc(${PAD}px + (100% - ${PAD * 2}px) * ${value} - ${CAP_H / 2}px)`,
          background:
            "linear-gradient(90deg, #a7a7a7 0%, #f3f3f3 18%, #d8d8d8 50%, #ffffff 76%, #9b9b9b 100%)",
          border: "1px solid #6f6f6f",
          clipPath: "polygon(12% 0, 88% 0, 100% 12%, 100% 88%, 88% 100%, 12% 100%, 0 88%, 0 12%)",
          boxShadow:
            "0 2px 5px rgba(0,0,0,0.85), inset 1px 0 0 rgba(255,255,255,0.8), inset -1px 0 0 rgba(0,0,0,0.22)",
        }}
      >
        <div className="absolute inset-x-[4px] top-[3px] h-px bg-white/90" />
        <div className="absolute inset-x-[4px] bottom-[3px] h-px bg-black/20" />
        <div className="absolute left-[4px] top-[5px] bottom-[5px] w-px bg-black/10" />
        <div className="absolute right-[4px] top-[5px] bottom-[5px] w-px bg-white/60" />
        {/* Recessed center line like the reference fader cap */}
        <div
          className="absolute inset-x-[2px] top-1/2 -translate-y-1/2 h-[4px]"
          style={{
            background: "linear-gradient(180deg, #9b9b9b 0%, #ededed 52%, #7d7d7d 100%)",
            boxShadow: "inset 0 1px 1px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.65)",
          }}
        />
      </div>
    </div>
  );
}
