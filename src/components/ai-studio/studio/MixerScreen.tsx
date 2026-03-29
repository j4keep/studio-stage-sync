import { useState, useRef, useEffect } from "react";
import { Mic, Music, Volume2, Headphones } from "lucide-react";
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

const CHANNEL_COLORS = ["#4fd1c5", "#f59e0b", "#ef4444", "#a855f7", "#3b82f6", "#22c55e", "#ec4899"];

/* ── Pan Knob ── */
function PanKnob({ value, onChange, color, size = 28 }: { value: number; onChange: (v: number) => void; color: string; size?: number }) {
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
    <div
      className="rounded-full flex items-center justify-center cursor-ns-resize touch-none"
      style={{
        width: size, height: size,
        background: `radial-gradient(circle, #444 20%, #2a2a3e 60%, #1a1a2e 100%)`,
        border: `2px solid ${isActive ? color : "#444"}`,
        boxShadow: isActive ? `0 0 6px ${color}40` : "none",
      }}
      onPointerDown={(e) => { setDragging(true); startY.current = e.clientY; startVal.current = value; }}
    >
      <div className="w-[2px] rounded-full"
        style={{ height: size * 0.35, background: isActive ? "#fff" : "#888", transform: `rotate(${angle}deg)`, transformOrigin: "bottom center" }} />
    </div>
  );
}

/* ── Vertical Fader ── */
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
      className="relative cursor-pointer touch-none rounded"
      style={{ width: 14, height: 160, background: "#0a0a1a", border: "1px solid #333" }}
      onPointerDown={(e) => { setDragging(true); handlePointer(e.clientY); }}
    >
      {/* Fill */}
      <div className="absolute bottom-0 left-0 right-0 rounded"
        style={{ height: `${value}%`, background: `linear-gradient(to top, ${color}66, ${color}22)` }} />
      {/* dB marks */}
      {[0, -6, -12, -24, -48].map((db) => {
        const pct = ((db + 48) / 48) * 100;
        if (pct < 0 || pct > 100) return null;
        return (
          <div key={db} className="absolute -left-4 text-[5px] font-mono text-[#555]"
            style={{ bottom: `${pct}%`, transform: "translateY(50%)" }}>
            {db}
          </div>
        );
      })}
      {/* Thumb */}
      <div className="absolute left-[-4px] right-[-4px] h-[18px] rounded-[2px]"
        style={{
          bottom: `${value}%`,
          transform: "translateY(50%)",
          background: `linear-gradient(180deg, #555, #333)`,
          border: `1px solid #666`,
          boxShadow: `0 1px 4px #00000080`,
        }}>
        <div className="flex flex-col gap-[1px] items-center justify-center h-full">
          <div className="w-3 h-[0.5px]" style={{ background: "rgba(255,255,255,0.3)" }} />
          <div className="w-3 h-[0.5px]" style={{ background: "rgba(255,255,255,0.2)" }} />
          <div className="w-3 h-[0.5px]" style={{ background: "rgba(255,255,255,0.1)" }} />
        </div>
      </div>
    </div>
  );
}

/* ── Mono Level Meter (single bar for vocals/guitars) ── */
function MonoLevelMeter({ active, intensity }: { active: boolean; intensity: number }) {
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
    <div className="flex flex-col-reverse gap-[0.5px] w-[6px]" style={{ height: 160 }}>
      {Array.from({ length: 32 }, (_, i) => {
        const lit = i < Math.round(level * 32);
        const c = lit ? (i < 20 ? "#22c55e" : i < 27 ? "#eab308" : "#ef4444") : "#0a0a1a";
        return <div key={i} style={{ flex: 1, borderRadius: 0.5, background: c, opacity: lit ? 1 : 0.08 }} />;
      })}
    </div>
  );
}

/* ── Stereo Level Meter (L+R for beat/master) ── */
function StereoLevelMeter({ active, intensity }: { active: boolean; intensity: number }) {
  const [levelL, setLevelL] = useState(0);
  const [levelR, setLevelR] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!active) { setLevelL(0); setLevelR(0); return; }
    const run = () => {
      setLevelL(prev => prev + (Math.max(0.05, Math.min(1, intensity + (Math.random() - 0.5) * 0.3)) - prev) * 0.25);
      setLevelR(prev => prev + (Math.max(0.05, Math.min(1, intensity + (Math.random() - 0.5) * 0.35)) - prev) * 0.25);
      raf.current = requestAnimationFrame(run);
    };
    raf.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf.current);
  }, [active, intensity]);

  const renderBar = (level: number) => (
    <div className="flex flex-col-reverse gap-[0.5px] w-[5px]" style={{ height: 160 }}>
      {Array.from({ length: 32 }, (_, i) => {
        const lit = i < Math.round(level * 32);
        const c = lit ? (i < 20 ? "#22c55e" : i < 27 ? "#eab308" : "#ef4444") : "#0a0a1a";
        return <div key={i} style={{ flex: 1, borderRadius: 0.5, background: c, opacity: lit ? 1 : 0.08 }} />;
      })}
    </div>
  );

  return (
    <div className="flex gap-[1px]">
      {renderBar(levelL)}
      {renderBar(levelR)}
    </div>
  );
}

/* ── Channel Strip ── */
function ChannelStrip({
  label, color, volume, onVolume, pan, onPan,
  muted, solo, onMute, onSolo, active, isMaster, isMono
}: {
  label: string; color: string;
  volume: number; onVolume: (v: number) => void;
  pan: number; onPan: (v: number) => void;
  muted: boolean; solo: boolean;
  onMute?: () => void; onSolo?: () => void;
  active: boolean; isMaster?: boolean; isMono?: boolean;
}) {
  const db = volume > 0 ? ((volume / 100 - 1) * 48).toFixed(1) : "-∞";

  return (
    <div className="flex flex-col items-center w-[68px] shrink-0 py-2 gap-1.5 border-r border-[#222] last:border-r-0">
      {/* Channel label */}
      <div className="w-14 h-4 rounded text-[7px] font-black flex items-center justify-center text-white truncate px-1"
        style={{ background: color }}>
        {label.slice(0, 6).toUpperCase()}
      </div>

      {/* Pan knob */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[6px] font-mono text-[#888]">PAN</span>
        <PanKnob value={pan} onChange={onPan} color={color} size={24} />
        <span className="text-[6px] font-mono text-[#666]">
          {pan === 0 ? "C" : pan < 0 ? `L${Math.abs(pan)}` : `R${pan}`}
        </span>
      </div>

      {/* Fader + meters */}
      <div className="flex gap-[2px] items-end">
        {isMono ? (
          <>
            <MonoLevelMeter active={active && !muted} intensity={volume / 100} />
            <Fader value={volume} onChange={onVolume} color={color} />
          </>
        ) : (
          <>
            <StereoLevelMeter active={active && !muted} intensity={volume / 100} />
            <Fader value={volume} onChange={onVolume} color={color} />
          </>
        )}
      </div>

      {/* dB readout */}
      <div className="w-14 h-3.5 rounded border border-[#333] flex items-center justify-center"
        style={{ background: "#0a0a1a" }}>
        <span className="text-[7px] font-mono text-[#ccc]">
          {db === "-48.0" ? "0.0" : db} dB
        </span>
      </div>

      {/* Solo / Mute */}
      {!isMaster ? (
        <div className="flex gap-1">
          <button onClick={onSolo}
            className="px-1.5 py-0.5 rounded text-[7px] font-black transition-colors"
            style={{ background: solo ? "#eab308" : "#2a2a3e", color: solo ? "#000" : "#888", border: `1px solid ${solo ? "#eab308" : "#333"}` }}>
            S
          </button>
          <button onClick={onMute}
            className="px-1.5 py-0.5 rounded text-[7px] font-black transition-colors"
            style={{ background: muted ? "#ef4444" : "#2a2a3e", color: muted ? "#fff" : "#888", border: `1px solid ${muted ? "#ef4444" : "#333"}` }}>
            M
          </button>
        </div>
      ) : (
        <span className="text-[8px] font-bold text-[#63b3ed]">MASTER</span>
      )}
    </div>
  );
}

/* ── EQ Section ── */
function EQSection({ selectedTrack }: { selectedTrack?: string }) {
  const [low, setLow] = useState(0);
  const [mid, setMid] = useState(0);
  const [high, setHigh] = useState(0);

  return (
    <div className="px-3 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-white">3-Band EQ</h3>
        <span className="text-[8px] text-[#888]">{selectedTrack || "Master"}</span>
      </div>
      <div className="flex gap-6 justify-center">
        {[
          { label: "Low", freq: "100Hz", value: low, onChange: setLow, color: "#ef4444" },
          { label: "Mid", freq: "1kHz", value: mid, onChange: setMid, color: "#eab308" },
          { label: "High", freq: "8kHz", value: high, onChange: setHigh, color: "#22c55e" },
        ].map(band => (
          <div key={band.label} className="flex flex-col items-center gap-1">
            <PanKnob value={band.value} onChange={band.onChange} color={band.color} size={32} />
            <span className="text-[8px] font-bold text-[#888]">{band.label}</span>
            <span className="text-[6px] font-mono text-[#555]">{band.freq}</span>
            <span className="text-[7px] font-mono text-[#666]">{band.value > 0 ? "+" : ""}{(band.value / 10).toFixed(1)}dB</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Effects Section ── */
function EffectsSection() {
  const [reverb, setReverb] = useState(20);
  const [delay, setDelay] = useState(0);
  const [comp, setComp] = useState(30);
  const [chorus, setChorus] = useState(0);

  return (
    <div className="px-3 py-3 space-y-2">
      <h3 className="text-xs font-bold text-white">ADD EFX</h3>
      <div className="flex gap-4 justify-center">
        {[
          { label: "Reverb", value: reverb, onChange: setReverb, color: "#63b3ed" },
          { label: "Delay", value: delay, onChange: setDelay, color: "#a855f7" },
          { label: "Comp", value: comp, onChange: setComp, color: "#f59e0b" },
          { label: "Chorus", value: chorus, onChange: setChorus, color: "#22c55e" },
        ].map(fx => (
          <div key={fx.label} className="flex flex-col items-center gap-1">
            <PanKnob value={fx.value} onChange={fx.onChange} color={fx.color} size={28} />
            <span className="text-[8px] font-bold text-[#888]">{fx.label}</span>
            <span className="text-[7px] font-mono text-[#666]">{fx.value}%</span>
          </div>
        ))}
      </div>
      {/* Preset buttons */}
      <div className="flex gap-1.5 pt-1">
        {["Vocal Plate", "Room", "Hall", "Slapback"].map(p => (
          <button key={p} className="flex-1 py-1 rounded text-[7px] font-bold border border-[#333] text-[#888]"
            style={{ background: "#1a1a2e" }}>{p}</button>
        ))}
      </div>
    </div>
  );
}

/* ── Reverb Detail Panel ── */
function ReverbPanel() {
  const [size, setSize] = useState(40);
  const [decay, setDecay] = useState(30);
  const [mix, setMix] = useState(20);
  const [preDelay, setPreDelay] = useState(10);
  const [preset, setPreset] = useState("Vocal Hall");

  return (
    <div className="px-3 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-white">Reverb</h3>
        <span className="text-[8px] text-[#63b3ed]">{preset}</span>
      </div>
      <div className="flex gap-4 justify-center">
        {[
          { label: "Size", value: size, onChange: setSize, color: "#63b3ed" },
          { label: "Decay", value: decay, onChange: setDecay, color: "#4fd1c5" },
          { label: "Mix", value: mix, onChange: setMix, color: "#a855f7" },
          { label: "Pre-Dly", value: preDelay, onChange: setPreDelay, color: "#f59e0b" },
        ].map(p => (
          <div key={p.label} className="flex flex-col items-center gap-1">
            <PanKnob value={p.value} onChange={p.onChange} color={p.color} size={28} />
            <span className="text-[8px] font-bold text-[#888]">{p.label}</span>
            <span className="text-[7px] font-mono text-[#666]">{p.value}%</span>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        {["Vocal Hall", "Large Hall", "Plate", "Room", "Cathedral"].map(p => (
          <button key={p} onClick={() => setPreset(p)}
            className={`flex-1 py-1.5 rounded text-[7px] font-bold border transition-colors ${
              preset === p ? "border-[#63b3ed] text-[#63b3ed]" : "border-[#333] text-[#888]"
            }`}
            style={{ background: preset === p ? "#2a3a5a" : "#1a1a2e" }}>{p}</button>
        ))}
      </div>
      {/* Mono output toggle */}
      <div className="flex items-center gap-2 pt-1">
        <span className="text-[8px] text-[#888]">Output:</span>
        <button className="px-2 py-1 rounded text-[7px] font-bold border border-[#444] text-[#888]"
          style={{ background: "#2a2a3e" }}>Mono</button>
        <span className="text-[7px] text-[#555]">0 dB</span>
      </div>
    </div>
  );
}

/* ── Delay Detail Panel ── */
function DelayPanel() {
  const [time, setTime] = useState(25);
  const [feedback, setFeedback] = useState(30);
  const [mix, setMix] = useState(15);
  const [sync, setSync] = useState(0);

  return (
    <div className="px-3 py-3 space-y-3">
      <h3 className="text-xs font-bold text-white">Delay</h3>
      <div className="flex gap-4 justify-center">
        {[
          { label: "Time", value: time, onChange: setTime, color: "#63b3ed" },
          { label: "Feedback", value: feedback, onChange: setFeedback, color: "#ef4444" },
          { label: "Mix", value: mix, onChange: setMix, color: "#a855f7" },
          { label: "Sync", value: sync, onChange: setSync, color: "#22c55e" },
        ].map(p => (
          <div key={p.label} className="flex flex-col items-center gap-1">
            <PanKnob value={p.value} onChange={p.onChange} color={p.color} size={28} />
            <span className="text-[8px] font-bold text-[#888]">{p.label}</span>
            <span className="text-[7px] font-mono text-[#666]">{p.value}%</span>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        {["1/4", "1/8", "1/16", "Dotted", "Triplet"].map(p => (
          <button key={p} className="flex-1 py-1.5 rounded text-[7px] font-bold border border-[#333] text-[#888]"
            style={{ background: "#1a1a2e" }}>{p}</button>
        ))}
      </div>
    </div>
  );
}

const TABS = ["Channels", "EQ", "Effects", "Reverb", "Delay"] as const;

export default function MixerScreen(props: MixerScreenProps) {
  const {
    beatName, takes, beatVolume, setBeatVolume, beatPan, setBeatPan,
    masterVolume, setMasterVolume, onToggleMute, onToggleSolo,
    onUpdateTakeVolume, onUpdateTakePan, isPlaying,
  } = props;

  const [activeTab, setActiveTab] = useState<typeof TABS[number]>("Channels");

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex gap-1 px-2 py-2 border-b border-[#333] overflow-x-auto" style={{ background: "#1a1a2e" }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap ${
              activeTab === tab
                ? "bg-[#2a3a5a] text-[#63b3ed] border border-[#3a5a8a]"
                : "text-[#666] border border-[#333]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto" style={{ background: "#111122" }}>
        {/* Channel faders */}
        {(activeTab === "Channels" || activeTab === "EQ" || activeTab === "Effects") && (
          <div className="flex px-1 py-2 min-w-max">
            {/* Beat channel - stereo */}
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
              isMono={false}
            />
            {/* Vocal/guitar channels - MONO */}
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
                isMono={true}
              />
            ))}
            {/* Master - stereo */}
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
              isMono={false}
            />
          </div>
        )}

        {/* EQ section below faders */}
        {activeTab === "EQ" && (
          <div className="border-t border-[#333]">
            <EQSection />
          </div>
        )}

        {/* Effects section below faders */}
        {activeTab === "Effects" && (
          <div className="border-t border-[#333]">
            <EffectsSection />
          </div>
        )}

        {activeTab === "Reverb" && (
          <div className="border-t border-[#333]">
            <ReverbPanel />
          </div>
        )}

        {activeTab === "Delay" && (
          <div className="border-t border-[#333]">
            <DelayPanel />
          </div>
        )}
      </div>
    </div>
  );
}
