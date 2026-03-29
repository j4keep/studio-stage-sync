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
}

const FADER_COLORS = ["#38b2ac", "#6366f1", "#ec4899", "#ef4444", "#3b82f6", "#f59e0b"];
const TABS = ["Beat", "Vocals", "Reverb", "Delay"] as const;

/* ── Pan Knob ── */
function PanKnob({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
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

  return (
    <div
      className="w-7 h-7 rounded-full border-2 flex items-center justify-center cursor-ns-resize touch-none"
      style={{ background: "#333", borderColor: color }}
      onPointerDown={(e) => { setDragging(true); startY.current = e.clientY; startVal.current = value; }}
    >
      <div className="w-[1px] h-2.5 rounded-full"
        style={{ background: color, transform: `rotate(${angle}deg)`, transformOrigin: "bottom center" }} />
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
      className="relative w-[14px] cursor-pointer touch-none rounded-sm"
      style={{ height: 160, background: "#1a1a2e", border: "1px solid #333" }}
      onPointerDown={(e) => { setDragging(true); handlePointer(e.clientY); }}
    >
      {/* Fill */}
      <div className="absolute bottom-0 left-0 right-0 rounded-sm"
        style={{ height: `${value}%`, background: `linear-gradient(to top, ${color}55, ${color}22)` }} />
      {/* Thumb */}
      <div className="absolute left-[-3px] right-[-3px] h-3 rounded-[2px]"
        style={{
          bottom: `${value}%`,
          transform: "translateY(50%)",
          background: `linear-gradient(180deg, ${color}, ${color}cc)`,
          border: `1px solid ${color}`,
          boxShadow: `0 0 6px ${color}40`,
        }}>
        <div className="flex flex-col gap-[1px] items-center justify-center h-full">
          <div className="w-2.5 h-[0.5px]" style={{ background: "#ffffff60" }} />
          <div className="w-2.5 h-[0.5px]" style={{ background: "#ffffff40" }} />
        </div>
      </div>
    </div>
  );
}

/* ── Level Meter ── */
function Meter({ active, intensity }: { active: boolean; intensity: number }) {
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
    <div className="flex flex-col-reverse gap-[0.5px] w-[5px]" style={{ height: 160 }}>
      {Array.from({ length: 32 }, (_, i) => {
        const lit = i < Math.round(level * 32);
        const c = lit ? (i < 19 ? "#22c55e" : i < 27 ? "#eab308" : "#ef4444") : "#1a1a1a";
        return <div key={i} style={{ flex: 1, borderRadius: 0.5, background: c, opacity: lit ? 1 : 0.12 }} />;
      })}
    </div>
  );
}

/* ── Channel Strip ── */
function Channel({
  label, icon, color, volume, onVolume, pan, onPan,
  muted, solo, onMute, onSolo, active, isMaster
}: {
  label: string; icon: React.ReactNode; color: string;
  volume: number; onVolume: (v: number) => void;
  pan: number; onPan: (v: number) => void;
  muted: boolean; solo: boolean;
  onMute?: () => void; onSolo?: () => void;
  active: boolean; isMaster?: boolean;
}) {
  const db = volume > 0 ? ((volume / 100 - 1) * 50).toFixed(1) : "-∞";

  return (
    <div className="flex flex-col items-center w-[72px] shrink-0 py-2 gap-1.5">
      {/* Pan knob */}
      <PanKnob value={pan} onChange={onPan} color={color} />
      <span className="text-[7px] font-mono text-[#666]">
        {pan === 0 ? "0.0" : pan > 0 ? `${(pan / 10).toFixed(1)}` : `${(pan / 10).toFixed(1)}`}
      </span>

      {/* Fader + meters */}
      <div className="flex gap-[2px] items-end">
        <Meter active={active && !muted} intensity={volume / 100} />
        <Fader value={volume} onChange={onVolume} color={color} />
        <Meter active={active && !muted} intensity={volume / 120} />
      </div>

      {/* dB readout */}
      <div className="w-14 h-4 rounded-sm border border-[#333] flex items-center justify-center"
        style={{ background: "#111" }}>
        <span className="text-[7px] font-mono text-[#aaa]">
          {db === "-50.0" ? "0.0" : db}
        </span>
      </div>

      {/* dB label */}
      <span className="text-[7px] font-mono text-[#666]">
        {volume > 0 ? `${(-(100 - volume) * 0.5).toFixed(0)} dB` : "-∞"}
      </span>

      {/* Pan value */}
      <span className="text-[7px] font-mono text-[#555]">0.0</span>

      {/* Icon + M/S */}
      {icon}

      {!isMaster && (
        <div className="flex gap-1">
          <button
            onClick={onSolo}
            className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
              solo ? "bg-yellow-500 text-black" : "bg-[#333] text-[#888]"
            }`}
          >Solo</button>
          <button
            onClick={onMute}
            className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
              muted ? "bg-red-600 text-white" : "bg-[#333] text-[#888]"
            }`}
          >Mute</button>
        </div>
      )}

      {isMaster && (
        <span className="text-[8px] font-bold text-[#63b3ed]">Master</span>
      )}
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
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
              activeTab === tab
                ? "bg-[#2a3a5a] text-[#63b3ed] border border-[#3a5a8a]"
                : "text-[#666] border border-transparent"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Mixer channels */}
      <div className="flex-1 overflow-x-auto overflow-y-auto" style={{ background: "#111122" }}>
        <div className="flex px-2 py-2 min-w-max">
          {/* Beat channel */}
          <Channel
            label={beatName || "Beat"}
            icon={<Music className="w-4 h-4 text-[#38b2ac]" />}
            color={FADER_COLORS[0]}
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
            <Channel
              key={take.id}
              label={take.name}
              icon={<Mic className="w-4 h-4 text-[#b794f4]" />}
              color={FADER_COLORS[(idx + 1) % FADER_COLORS.length]}
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
          <Channel
            label="Master"
            icon={<Volume2 className="w-4 h-4 text-[#63b3ed]" />}
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
      </div>
    </div>
  );
}
