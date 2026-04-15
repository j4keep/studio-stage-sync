import { useState, useEffect, useCallback, useRef } from "react";

const C = {
  shell: "#2b2d32",
  panelBorder: "#3a3c41",
  inset: "#141517",
  dim: "#656770",
  green: "#4ade60",
  text: "#e8e8ea",
  label: "#9a9ca2",
  blue: "#3b9dff",
  white: "#ffffff",
  red: "#ef4444",
};

/* ── VU Meter Bar ── */
function MeterBar({ level, peak }: { level: number; peak: number }) {
  return (
    <div className="relative overflow-hidden rounded-sm" style={{ height: 140, width: 12, background: "#111214", border: "1px solid #2a2c30" }}>
      <div
        className="absolute bottom-0 left-0 w-full rounded-sm transition-[height] duration-75"
        style={{
          height: `${Math.min(100, level * 100)}%`,
          background: "linear-gradient(to top, #22c55e 0%, #22c55e 55%, #eab308 75%, #ef4444 100%)",
        }}
      />
      <div
        className="absolute left-0 w-full transition-[bottom] duration-200"
        style={{ height: 2, bottom: `${Math.min(100, peak * 100)}%`, background: "rgba(255,255,255,0.8)" }}
      />
      {[0, 25, 50, 75, 100].map((p) => (
        <div key={p} className="absolute left-0 w-full" style={{ height: 1, bottom: `${p}%`, background: "rgba(100,100,100,0.3)" }} />
      ))}
    </div>
  );
}

/* ── Knob ── */
function Knob({ value, onChange, label, size = 40 }: { value: number; onChange: (v: number) => void; label: string; size?: number }) {
  const knobRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [value]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta = (startY.current - e.clientY) / 120;
    onChange(Math.max(0, Math.min(1, startVal.current + delta)));
  }, [onChange]);

  const handlePointerUp = useCallback(() => { dragging.current = false; }, []);

  const rotation = -135 + value * 270;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>{label}</span>
      <div
        ref={knobRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative cursor-pointer rounded-full"
        style={{
          width: size, height: size,
          background: `conic-gradient(from 225deg, ${C.blue} 0deg, ${C.blue} ${value * 270}deg, #333 ${value * 270}deg, #333 270deg, transparent 270deg)`,
          borderRadius: "50%",
        }}
      >
        <div className="absolute inset-[3px] rounded-full flex items-center justify-center" style={{ background: "linear-gradient(180deg, #3a3c41 0%, #1c1d21 100%)" }}>
          <div className="absolute" style={{
            width: 2, height: size / 2 - 6, background: C.white,
            transformOrigin: "bottom center",
            transform: `rotate(${rotation}deg)`,
            bottom: "50%", left: "calc(50% - 1px)",
            borderRadius: 1,
          }} />
        </div>
      </div>
    </div>
  );
}

/* ── Volume Slider ── */
function VolumeSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-1 w-full">
      <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>OUTPUT</span>
      <div className="relative w-full" style={{ height: 28 }}>
        <input
          type="range"
          min={0} max={100} value={Math.round(value * 100)}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="w-full appearance-none cursor-pointer"
          style={{
            height: 4, borderRadius: 2, outline: "none",
            background: `linear-gradient(to right, ${C.blue} 0%, ${C.blue} ${value * 100}%, #333 ${value * 100}%, #333 100%)`,
            accentColor: C.blue,
          }}
        />
      </div>
      <span className="font-mono text-[10px]" style={{ color: C.label }}>{Math.round(value * 100)}%</span>
    </div>
  );
}

interface PluginPanelProps {
  sessionTitle?: string;
  connected?: boolean;
  remoteMicLevel?: number;
  sendLevel?: number;
}

export default function PluginPanel({
  sessionTitle = "Session",
  connected = false,
  remoteMicLevel = 0,
  sendLevel = 0,
}: PluginPanelProps) {
  const [isLive, setIsLive] = useState(connected);
  const [micOn, setMicOn] = useState(true);
  const [gain, setGain] = useState(0.7);
  const [volume, setVolume] = useState(0.8);
  const [inputMode, setInputMode] = useState<"mono" | "stereo">("stereo");

  const [levelL, setLevelL] = useState(0);
  const [peakL, setPeakL] = useState(0);
  const [levelR, setLevelR] = useState(0);
  const [peakR, setPeakR] = useState(0);

  useEffect(() => { setIsLive(connected); }, [connected]);

  // Drive meters
  useEffect(() => {
    const iv = setInterval(() => {
      if (!isLive || !micOn) {
        setLevelL(0); setPeakL((p) => Math.max(0, p - 0.02));
        setLevelR(0); setPeakR((p) => Math.max(0, p - 0.02));
        return;
      }
      const base = sendLevel > 0.01 ? sendLevel : 0.35 + Math.random() * 0.4;
      const l = base * gain * volume;
      const r = inputMode === "stereo" ? (base * 0.92 + Math.random() * 0.06) * gain * volume : 0;
      setLevelL(l);
      setPeakL((p) => Math.max(p * 0.97, l));
      setLevelR(r);
      setPeakR((p) => Math.max(p * 0.97, r));
    }, 80);
    return () => clearInterval(iv);
  }, [isLive, micOn, gain, volume, sendLevel, inputMode]);

  const dbLabel = isLive && micOn
    ? `${(20 * Math.log10(Math.max(0.001, levelL * volume))).toFixed(0)} dB`
    : "−∞ dB";

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-[4px]"
      style={{
        background: "linear-gradient(180deg, #1e1e24 0%, #18181c 40%, #131316 100%)",
        border: `1px solid ${C.panelBorder}`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 0 rgba(255,255,255,0.02)",
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid rgba(58,60,65,0.4)" }}>
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <path d="M4 8L10 24L16 12L22 24L28 8" stroke="hsl(270,60%,65%)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="14" y1="4" x2="20" y2="28" stroke="hsl(210,90%,60%)" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <span className="text-[13px] font-bold tracking-tight" style={{ color: C.white }}>
            W.STUDIO <span className="font-medium" style={{ color: C.label }}>SEND</span>
          </span>
        </div>
      </div>

      {/* ── Session + Status ── */}
      <div className="px-3 py-2" style={{ borderBottom: "1px solid rgba(30,31,35,0.6)" }}>
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold truncate" style={{ color: C.white }}>{sessionTitle}</span>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: connected ? C.green : C.dim, boxShadow: connected ? "0 0 6px rgba(52,211,153,0.5)" : "none" }} />
            <span className="text-[10px] font-semibold" style={{ color: connected ? C.green : C.dim }}>
              {connected ? "CONNECTED" : "OFFLINE"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Input Mode Dropdown ── */}
      <div className="px-3 py-2" style={{ borderBottom: "1px solid rgba(30,31,35,0.6)" }}>
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>INPUT MODE</span>
          <select
            value={inputMode}
            onChange={(e) => setInputMode(e.target.value as "mono" | "stereo")}
            className="rounded px-2 py-0.5 text-[11px] font-semibold cursor-pointer outline-none"
            style={{
              background: C.inset,
              color: C.text,
              border: `1px solid ${C.panelBorder}`,
            }}
          >
            <option value="mono">Mono</option>
            <option value="stereo">Stereo</option>
          </select>
        </div>
      </div>

      {/* ── Main Area: Mic + LIVE + Meters ── */}
      <div className="flex flex-1 items-center justify-between px-3 py-4">
        {/* Left: Mic + Gain */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => setMicOn(!micOn)}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-all"
            style={{
              background: micOn
                ? "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.2), #22c55e)"
                : "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.1), #333)",
              border: `1.5px solid ${micOn ? "rgba(34,197,94,0.6)" : "rgba(100,100,100,0.5)"}`,
              boxShadow: micOn ? "0 0 12px rgba(34,197,94,0.3)" : "none",
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={micOn ? C.white : C.dim} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </button>
          <span className="text-[8px] font-bold uppercase" style={{ color: micOn ? C.green : C.dim }}>{micOn ? "ON" : "OFF"}</span>
          <Knob value={gain} onChange={setGain} label="GAIN" size={36} />
        </div>

        {/* Center: LIVE button */}
        <div className="flex flex-col items-center">
          <button onClick={() => setIsLive(!isLive)} className="relative flex items-center justify-center">
            <div
              className={`absolute inset-0 rounded-full transition-all duration-500 ${
                isLive
                  ? "bg-[radial-gradient(circle,_hsl(200,80%,50%)_0%,_transparent_70%)] opacity-40 scale-110"
                  : "bg-[radial-gradient(circle,_hsl(0,0%,30%)_0%,_transparent_70%)] opacity-20 scale-100"
              }`}
              style={{ width: 90, height: 90, margin: "auto", left: 0, right: 0, top: 0, bottom: 0 }}
            />
            <div
              className={`relative z-10 flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 transition-all duration-300 ${
                isLive
                  ? "border-cyan-400/60 bg-gradient-to-b from-cyan-500 via-cyan-600 to-cyan-800 shadow-[0_0_30px_rgba(6,182,212,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)]"
                  : "border-zinc-600 bg-gradient-to-b from-zinc-600 via-zinc-700 to-zinc-800 shadow-[inset_0_2px_4px_rgba(255,255,255,0.05)]"
              }`}
            >
              <span className={`text-sm font-bold tracking-[0.15em] ${isLive ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" : "text-zinc-400"}`}>
                LIVE
              </span>
            </div>
          </button>
        </div>

        {/* Right: Meters */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>
            {inputMode === "stereo" ? "L     R" : "LEVEL"}
          </span>
          <div className="flex gap-[4px]">
            <MeterBar level={levelL} peak={peakL} />
            {inputMode === "stereo" && <MeterBar level={levelR} peak={peakR} />}
          </div>
          <span className="font-mono text-[10px] font-bold" style={{ color: C.text }}>{dbLabel}</span>
        </div>
      </div>

      {/* ── Volume Slider ── */}
      <div className="px-4 pb-2">
        <VolumeSlider value={volume} onChange={setVolume} />
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-center px-3 py-2" style={{ borderTop: "1px solid rgba(58,60,65,0.4)" }}>
        <div className="flex items-center gap-1">
          <span className="rounded-full" style={{ height: 5, width: 5, background: isLive ? C.green : C.dim }} />
          <span className="font-mono text-[9px]" style={{ color: C.dim }}>
            {isLive ? "48 kHz · Streaming" : "Idle"}
          </span>
        </div>
      </div>
    </div>
  );
}
