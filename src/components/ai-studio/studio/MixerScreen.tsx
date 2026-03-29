import { useState, useRef, useEffect } from "react";
import { Mic, Music, Volume2 } from "lucide-react";
import type { TakeLocal } from "./DAWScreen";

interface MixerScreenProps {
  beatName: string | null;
  takes: TakeLocal[];
  beatVolume: number;
  setBeatVolume: (v: number) => void;
  beatPan: number;
  setBeatPan: (v: number) => void;
  masterVolume: number;
  setMasterVolume: (v: number) => void;
  onToggleMute: (id: string) => void;
  onToggleSolo: (id: string) => void;
  onUpdateTakeVolume: (id: string, v: number) => void;
  onUpdateTakePan: (id: string, v: number) => void;
  isPlaying: boolean;
  eqSettings?: { low: number; mid: number; high: number };
  onEqChange?: (band: string, value: number) => void;
}

const CHANNEL_COLORS = ["#f97316", "#f59e0b", "#ef4444", "#a855f7", "#3b82f6", "#22c55e", "#ec4899"];
const TABS = ["Beat", "Vocals", "Reverb", "Delay"] as const;

/* ── Pan Knob (styled like reference) ── */
function PanKnob({ value, onChange, color, label }: { value: number; onChange: (v: number) => void; color: string; label?: string }) {
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const dy = startY.current - e.clientY;
      onChange(Math.round(Math.max(-100, Math.min(100, startVal.current + dy))));
    };
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [dragging, onChange]);

  const angle = (value / 100) * 135;
  const isActive = value !== 0;

  return (
    <div className="flex flex-col items-center gap-0.5">
      {label && <span className="text-[7px] font-mono text-[#888]">{label}</span>}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center cursor-ns-resize touch-none"
        style={{
          background: isActive
            ? `radial-gradient(circle, ${color}cc 20%, ${color}66 60%, #222 100%)`
            : "radial-gradient(circle, #444 20%, #333 60%, #222 100%)",
          border: `2px solid ${isActive ? color : "#555"}`,
          boxShadow: isActive ? `0 0 8px ${color}40` : "none",
        }}
        onPointerDown={(e) => { setDragging(true); startY.current = e.clientY; startVal.current = value; }}
      >
        <div className="w-[2px] h-3 rounded-full"
          style={{ background: isActive ? "#fff" : "#888", transform: `rotate(${angle}deg)`, transformOrigin: "bottom center" }} />
      </div>
    </div>
  );
}

/* ── Vertical Fader (realistic styled) ── */
function Fader({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const handlePointer = (clientY: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = 1 - (clientY - rect.top) / rect.height;
    onChange(Math.round(Math.max(0, Math.min(100, pct * 100))));
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => handlePointer(e.clientY);
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [dragging]);

  return (
    <div
      ref={trackRef}
      className="relative w-[16px] cursor-pointer touch-none rounded"
      style={{ height: 180, background: "#0a0a1a", border: "1px solid #333" }}
      onPointerDown={(e) => { setDragging(true); handlePointer(e.clientY); }}
    >
      {/* Fill/glow behind fader */}
      <div className="absolute bottom-0 left-0 right-0 rounded"
        style={{ height: `${value}%`, background: `linear-gradient(to top, ${color}88, ${color}22)` }} />
      {/* Fader thumb */}
      <div className="absolute left-[-5px] right-[-5px] h-5 rounded-[3px]"
        style={{
          bottom: `${value}%`,
          transform: "translateY(50%)",
          background: `linear-gradient(180deg, ${color}ee, ${color}aa)`,
          border: `1px solid ${color}`,
          boxShadow: `0 2px 8px ${color}60, inset 0 1px 0 rgba(255,255,255,0.2)`,
        }}>
        {/* Grip lines */}
        <div className="flex flex-col gap-[1.5px] items-center justify-center h-full">
          <div className="w-3.5 h-[0.5px]" style={{ background: "rgba(255,255,255,0.4)" }} />
          <div className="w-3.5 h-[0.5px]" style={{ background: "rgba(255,255,255,0.25)" }} />
          <div className="w-3.5 h-[0.5px]" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>
      </div>
      {/* dB scale labels */}
      {[0, -3, -6, -12, -20, -30, -40, -50].map((db) => {
        const pct = ((db + 50) / 50) * 100;
        if (pct < 0 || pct > 100) return null;
        return (
          <div key={db} className="absolute -left-5 text-[5px] font-mono text-[#555]"
            style={{ bottom: `${pct}%`, transform: "translateY(50%)" }}>
            {db}
          </div>
        );
      })}
    </div>
  );
}

/* ── Level Meter (dual bar) ── */
function LevelMeter({ active, intensity, color }: { active: boolean; intensity: number; color: string }) {
  const [level, setLevel] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (!active) { setLevel(0); return; }
    const run = () => {
      setLevel(prev => prev + (Math.max(0.05, Math.min(1, intensity + (Math.random() - 0.5) * 0.3)) - prev) * 0.25);
      raf.current = requestAnimationFrame(run);
    };
    raf.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf.current);
  }, [active, intensity]);

  return (
    <div className="flex gap-[1px]">
      {[0, 1].map(ch => (
        <div key={ch} className="flex flex-col-reverse gap-[0.5px] w-[5px]" style={{ height: 180 }}>
          {Array.from({ length: 36 }, (_, i) => {
            const offset = ch === 1 ? 0.05 : 0;
            const lit = i < Math.round((level + offset) * 36);
            const c = lit ? (i < 22 ? "#22c55e" : i < 30 ? "#eab308" : "#ef4444") : "#0a0a1a";
            return <div key={i} style={{ flex: 1, borderRadius: 0.5, background: c, opacity: lit ? 1 : 0.08 }} />;
          })}
        </div>
      ))}
    </div>
  );
}

/* ── Channel Strip ── */
function ChannelStrip({
  label, color, volume, onVolume, pan, onPan,
  muted, solo, onMute, onSolo, active, isMaster, armed
}: {
  label: string; color: string;
  volume: number; onVolume: (v: number) => void;
  pan: number; onPan: (v: number) => void;
  muted: boolean; solo: boolean;
  onMute?: () => void; onSolo?: () => void;
  active: boolean; isMaster?: boolean; armed?: boolean;
}) {
  const db = volume > 0 ? ((volume / 100 - 1) * 50).toFixed(1) : "-∞";

  return (
    <div className="flex flex-col items-center w-[76px] shrink-0 py-2 gap-1.5 border-r border-[#222] last:border-r-0">
      {/* Channel color tag */}
      <div className="w-12 h-4 rounded text-[7px] font-black flex items-center justify-center text-white"
        style={{ background: color }}>
        {label.slice(0, 4).toUpperCase()}
      </div>

      {/* Pan knob */}
      <PanKnob value={pan} onChange={onPan} color={color} label="PAN" />

      {/* Channel numbers */}
      <div className="flex gap-2">
        <span className="text-[7px] font-mono text-[#888]">L</span>
        <span className="text-[7px] font-mono text-[#888]">R</span>
      </div>

      {/* Fader + meters */}
      <div className="flex gap-[2px] items-end">
        <LevelMeter active={active && !muted} intensity={volume / 100} color={color} />
        <Fader value={volume} onChange={onVolume} color={color} />
        <LevelMeter active={active && !muted} intensity={volume / 120} color={color} />
      </div>

      {/* dB readout */}
      <div className="w-14 h-4 rounded border border-[#333] flex items-center justify-center"
        style={{ background: "#0a0a1a" }}>
        <span className="text-[8px] font-mono text-[#ccc]">
          {db === "-50.0" ? "0.0" : db}
        </span>
      </div>

      {/* dB label */}
      <div className="w-14 h-4 rounded border border-[#333] flex items-center justify-center"
        style={{ background: "#1a1a2e" }}>
        <span className="text-[7px] font-mono text-[#888]">
          {volume > 0 ? `${(-(100 - volume) * 0.5).toFixed(1)}dB` : "-∞"}
        </span>
      </div>

      {/* Pan readout */}
      <PanKnob value={pan} onChange={onPan} color={muted ? "#666" : color} />

      {/* Solo / Mute buttons */}
      {!isMaster && (
        <div className="flex gap-1">
          <button
            onClick={onSolo}
            className="px-2 py-1 rounded text-[8px] font-black transition-colors"
            style={{
              background: solo ? "#3b82f6" : "#2a2a3e",
              color: solo ? "#fff" : "#888",
              border: `1px solid ${solo ? "#3b82f6" : "#333"}`,
            }}
          >Solo</button>
          <button
            onClick={onMute}
            className="px-2 py-1 rounded text-[8px] font-black transition-colors"
            style={{
              background: muted ? "#ef4444" : "#2a2a3e",
              color: muted ? "#fff" : "#888",
              border: `1px solid ${muted ? "#ef4444" : "#333"}`,
            }}
          >Mute</button>
        </div>
      )}

      {isMaster && (
        <span className="text-[9px] font-bold text-[#63b3ed] mt-1">Master</span>
      )}
    </div>
  );
}

/* ── EQ Section ── */
function EQSection() {
  const [low, setLow] = useState(0);
  const [mid, setMid] = useState(0);
  const [high, setHigh] = useState(0);

  return (
    <div className="px-3 py-3 space-y-3">
      <h3 className="text-xs font-bold text-white">EQ</h3>
      <div className="flex gap-4">
        {[
          { label: "Low", value: low, onChange: setLow, color: "#ef4444" },
          { label: "Mid", value: mid, onChange: setMid, color: "#eab308" },
          { label: "High", value: high, onChange: setHigh, color: "#22c55e" },
        ].map(band => (
          <div key={band.label} className="flex flex-col items-center gap-1 flex-1">
            <PanKnob value={band.value} onChange={band.onChange} color={band.color} />
            <span className="text-[8px] font-bold text-[#888]">{band.label}</span>
            <span className="text-[7px] font-mono text-[#666]">{band.value > 0 ? "+" : ""}{(band.value / 10).toFixed(1)}dB</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Effects Section ── */
function EffectsSection() {
  const [reverbMix, setReverbMix] = useState(20);
  const [delayMix, setDelayMix] = useState(0);
  const [compression, setCompression] = useState(30);

  return (
    <div className="px-3 py-3 space-y-3">
      <h3 className="text-xs font-bold text-white">ADD EFX</h3>
      <div className="flex gap-4">
        {[
          { label: "Reverb", value: reverbMix, onChange: setReverbMix, color: "#63b3ed" },
          { label: "Delay", value: delayMix, onChange: setDelayMix, color: "#a855f7" },
          { label: "Comp", value: compression, onChange: setCompression, color: "#f59e0b" },
        ].map(fx => (
          <div key={fx.label} className="flex flex-col items-center gap-1 flex-1">
            <PanKnob value={fx.value} onChange={fx.onChange} color={fx.color} />
            <span className="text-[8px] font-bold text-[#888]">{fx.label}</span>
            <span className="text-[7px] font-mono text-[#666]">{fx.value}%</span>
          </div>
        ))}
      </div>
      {/* Speaker / Send row */}
      <div className="flex gap-2 pt-1">
        <button className="flex-1 py-1.5 rounded text-[8px] font-bold border border-[#444] text-[#888]"
          style={{ background: "#1a1a2e" }}>Speaker</button>
        <button className="flex-1 py-1.5 rounded text-[8px] font-bold border border-dashed border-[#444] text-[#666]"
          style={{ background: "#111" }}>+ Add Send</button>
      </div>
    </div>
  );
}

export default function MixerScreen(props: MixerScreenProps) {
  const {
    beatName, takes, beatVolume, setBeatVolume, beatPan, setBeatPan,
    masterVolume, setMasterVolume, onToggleMute, onToggleSolo,
    onUpdateTakeVolume, onUpdateTakePan, isPlaying,
  } = props;

  const [activeTab, setActiveTab] = useState<typeof TABS[number]>("Beat");

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex gap-2 px-3 py-3 border-b border-[#333]" style={{ background: "#1a1a2e" }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === tab
                ? "bg-[#2a3a5a] text-[#63b3ed] border border-[#3a5a8a]"
                : "text-[#666] border border-[#333]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Mixer channels (horizontal scroll) */}
      <div className="flex-1 overflow-x-auto overflow-y-auto" style={{ background: "#111122" }}>
        <div className="flex px-1 py-2 min-w-max">
          {/* Beat channel */}
          <ChannelStrip
            label={beatName || "Beat"}
            color={CHANNEL_COLORS[0]}
            volume={beatVolume}
            onVolume={setBeatVolume}
            pan={beatPan}
            onPan={setBeatPan}
            muted={false}
            solo={false}
            active={isPlaying}
          />

          {/* Vocal channels */}
          {takes.map((take, idx) => (
            <ChannelStrip
              key={take.id}
              label={take.name}
              color={CHANNEL_COLORS[(idx + 1) % CHANNEL_COLORS.length]}
              volume={take.volume}
              onVolume={(v) => onUpdateTakeVolume(take.id, v)}
              pan={take.pan}
              onPan={(v) => onUpdateTakePan(take.id, v)}
              muted={take.muted}
              solo={take.solo}
              onMute={() => onToggleMute(take.id)}
              onSolo={() => onToggleSolo(take.id)}
              active={isPlaying && !take.muted}
            />
          ))}

          {/* Master */}
          <ChannelStrip
            label="Master"
            color="#3b82f6"
            volume={masterVolume}
            onVolume={setMasterVolume}
            pan={0}
            onPan={() => {}}
            muted={false}
            solo={false}
            active={isPlaying}
            isMaster
          />
        </div>

        {/* EQ + Effects sections below faders */}
        {(activeTab === "Beat" || activeTab === "Vocals") && (
          <div className="border-t border-[#333]">
            <EQSection />
            <div className="border-t border-[#333]">
              <EffectsSection />
            </div>
          </div>
        )}

        {activeTab === "Reverb" && (
          <div className="border-t border-[#333] px-3 py-4 space-y-3">
            <h3 className="text-xs font-bold text-white">Reverb Settings</h3>
            <div className="flex gap-4">
              {[
                { label: "Size", color: "#63b3ed" },
                { label: "Decay", color: "#4fd1c5" },
                { label: "Mix", color: "#a855f7" },
                { label: "Pre-Delay", color: "#f59e0b" },
              ].map(p => (
                <div key={p.label} className="flex flex-col items-center gap-1 flex-1">
                  <PanKnob value={0} onChange={() => {}} color={p.color} />
                  <span className="text-[8px] font-bold text-[#888]">{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "Delay" && (
          <div className="border-t border-[#333] px-3 py-4 space-y-3">
            <h3 className="text-xs font-bold text-white">Delay Settings</h3>
            <div className="flex gap-4">
              {[
                { label: "Time", color: "#63b3ed" },
                { label: "Feedback", color: "#ef4444" },
                { label: "Mix", color: "#a855f7" },
                { label: "Sync", color: "#22c55e" },
              ].map(p => (
                <div key={p.label} className="flex flex-col items-center gap-1 flex-1">
                  <PanKnob value={0} onChange={() => {}} color={p.color} />
                  <span className="text-[8px] font-bold text-[#888]">{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
