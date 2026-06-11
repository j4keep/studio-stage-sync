import { useRef } from "react";

interface Props {
  /** Linear gain. 1.0 = 0 dB, 2.0 ≈ +6 dB. */
  value: number;
  onChange: (v: number) => void;
  height?: number;
  color?: string;
}

const MIN_DB = -60;
const MAX_DB = 6;
const MARKS = [6, 3, 0, -3, -6, -10, -15, -20, -30, -40, -50, -60];

export function gainToDb(gain: number) {
  return gain <= 0.0001 ? -Infinity : 20 * Math.log10(gain);
}

export function formatGainDb(gain: number) {
  const db = gainToDb(gain);
  if (!Number.isFinite(db) || db <= MIN_DB) return "-∞";
  return `${db >= 0 ? "+" : ""}${db.toFixed(1)}`;
}

function dbToPos(db: number) {
  return (Math.max(MIN_DB, Math.min(MAX_DB, db)) - MIN_DB) / (MAX_DB - MIN_DB);
}

function gainToPos(gain: number) {
  if (gain <= 0.0001) return 0;
  return dbToPos(gainToDb(gain));
}

function posToGain(pos: number) {
  if (pos <= 0.005) return 0;
  const db = MIN_DB + Math.max(0, Math.min(1, pos)) * (MAX_DB - MIN_DB);
  return Math.pow(10, db / 20);
}

/** Logic-style mixer fader: 0 dB unity plus +6 dB headroom and small ruler ticks. */
export function Fader({ value, onChange, height = 160, color = "#22d3ee" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = gainToPos(value);

  const handle = (clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const y = clientY - rect.top;
    const nextPos = 1 - Math.max(0, Math.min(1, y / rect.height));
    onChange(posToGain(nextPos));
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
      className="relative w-14 mx-auto cursor-ns-resize select-none"
      style={{ height }}
    >
      {/* Numbered dB ruler like Logic's channel strip. */}
      <div className="absolute inset-y-0 left-0 w-6 pointer-events-none font-mono text-[8px] text-neutral-400">
        {MARKS.map((db) => {
          const top = `${(1 - dbToPos(db)) * 100}%`;
          const isMajor = db === 6 || db === 0 || db === -6 || db === -20 || db === -40 || db === -60;
          return (
            <div key={db} className="absolute left-0 right-0 flex items-center justify-end gap-0.5" style={{ top, transform: "translateY(-50%)" }}>
              <span className={isMajor ? "text-neutral-300" : "text-neutral-500"}>{Math.abs(db)}</span>
              <span className={isMajor ? "w-2 h-px bg-neutral-300" : "w-1 h-px bg-neutral-500"} />
            </div>
          );
        })}
        <div className="absolute left-0 right-0 bottom-0 text-right text-neutral-500">∞</div>
      </div>

      {/* Recessed chassis */}
      <div
        className="absolute inset-y-0 left-[34px] w-7 -translate-x-1/2 rounded-[2px] border border-black/80"
        style={{
          background: "linear-gradient(90deg, #171717 0%, #2d2d2d 46%, #101010 100%)",
          boxShadow: "inset 3px 0 5px rgba(0,0,0,0.78), inset -2px 0 3px rgba(255,255,255,0.05)",
        }}
      />

      {/* Dense small tick marks along the throw. */}
      <div className="absolute inset-y-2 left-[23px] flex flex-col justify-between pointer-events-none">
        {Array.from({ length: 25 }).map((_, i) => (
          <div key={i} className="h-px bg-white/28" style={{ width: i % 4 === 0 ? 9 : 5 }} />
        ))}
      </div>
      <div className="absolute inset-y-2 right-0 flex flex-col items-end justify-between pointer-events-none">
        {Array.from({ length: 25 }).map((_, i) => (
          <div key={i} className="h-px bg-white/28" style={{ width: i % 4 === 0 ? 7 : 4 }} />
        ))}
      </div>

      {/* Deep slot */}
      <div
        className="absolute left-[34px] -translate-x-1/2 rounded-[2px]"
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
        className="absolute left-[34px] -translate-x-1/2 rounded-[2px] pointer-events-none"
        style={{
          bottom: PAD,
          height: `calc((100% - ${PAD * 2}px) * ${pos})`,
          width: 2,
          background: color,
          opacity: 0.55,
          boxShadow: `0 0 4px ${color}`,
        }}
      />

      {/* Raised fader cap */}
      <div
        className="absolute left-[34px] -translate-x-1/2 rounded-[2px] pointer-events-none"
        style={{
          width: CAP_W,
          height: CAP_H,
          bottom: `calc(${PAD}px + (100% - ${PAD * 2}px) * ${pos} - ${CAP_H / 2}px)`,
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
