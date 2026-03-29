import { useState, useRef, useEffect } from "react";
import { X, Mic, Music, Volume2, Play, Pause, SkipBack, Repeat } from "lucide-react";
import type { TakeLocal } from "./StudioDAWView";

interface MixerSheetProps {
  open: boolean;
  onClose: () => void;
  beatName: string | null;
  takes: TakeLocal[];
  activeTakeId: string | null;
  beatVolume: number;
  setBeatVolume: (v: number) => void;
  vocalVolume: number;
  setVocalVolume: (v: number) => void;
  beatPan: number;
  setBeatPan: (v: number) => void;
  vocalPan: number;
  setVocalPan: (v: number) => void;
  masterVolume: number;
  setMasterVolume: (v: number) => void;
  onToggleMute: (id: string) => void;
  onToggleSolo: (id: string) => void;
  isAudioActive: boolean;
  onPlayAll?: () => void;
  onStopPlayback?: () => void;
}

/* ── Vertical Fader ── */
function VerticalFader({ value, onChange, accentColor }: { value: number; onChange: (v: number) => void; accentColor?: string }) {
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

  const dbMarks = [0, -6, -12, -24, -48];
  const color = accentColor || "#22c55e";

  return (
    <div className="relative flex">
      <div className="flex flex-col justify-between h-full mr-0.5 py-1">
        {dbMarks.map(db => (
          <span key={db} className="text-[5px] font-mono text-[#666] leading-none text-right w-4">{db}</span>
        ))}
      </div>
      <div
        ref={trackRef}
        className="relative w-[16px] h-full cursor-pointer touch-none rounded-sm"
        style={{ background: "#1a1a1a", border: "1px solid #3a3a3a" }}
        onPointerDown={(e) => { setDragging(true); handlePointer(e.clientY); }}
      >
        <div className="absolute bottom-0 left-0 right-0 rounded-sm"
          style={{ height: `${value}%`, background: `linear-gradient(to top, ${color}40 0%, ${color}20 100%)` }} />
        <div className="absolute left-[-3px] right-[-3px] h-[12px] rounded-[2px]"
          style={{
            bottom: `${value}%`, transform: "translateY(50%)",
            background: "linear-gradient(180deg, #aaa 0%, #777 50%, #666 100%)",
            border: "1px solid #bbb",
            boxShadow: "0 1px 3px #00000060, inset 0 1px 0 #ccc",
          }}>
          <div className="flex flex-col gap-[1px] items-center justify-center h-full">
            <div className="w-3.5 h-[0.5px] bg-[#aaa]" />
            <div className="w-3.5 h-[0.5px] bg-[#999]" />
            <div className="w-3.5 h-[0.5px] bg-[#aaa]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Level Meter ── */
function MixerMeter({ active, intensity }: { active: boolean; intensity: number }) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (!active) { setLevel(0); return; }
    const animate = () => {
      const target = intensity + (Math.random() - 0.5) * 0.25;
      setLevel(prev => prev + (Math.max(0.05, Math.min(1, target)) - prev) * 0.25);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, intensity]);

  const segments = 28;
  const lit = Math.round(level * segments);
  return (
    <div className="flex flex-col-reverse gap-[1px] w-[5px]">
      {Array.from({ length: segments }, (_, i) => {
        const isLit = i < lit;
        let color = "#1a1a1a";
        if (isLit) {
          if (i < segments * 0.6) color = "#22c55e";
          else if (i < segments * 0.85) color = "#eab308";
          else color = "#ef4444";
        }
        return <div key={i} style={{ height: 3, backgroundColor: color, opacity: isLit ? 1 : 0.1, borderRadius: 0.5,
          boxShadow: isLit && i >= segments * 0.85 ? "0 0 3px #ef4444" : "none" }} />;
      })}
    </div>
  );
}

/* ── Pan Knob ── */
function PanKnob({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const knobRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);
  const startValRef = useRef(0);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const delta = (startYRef.current - e.clientY) * 2;
      onChange(Math.round(Math.max(-100, Math.min(100, startValRef.current + delta))));
    };
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [dragging]);

  const rotation = value * 1.35;
  const label = value === 0 ? "C" : value < 0 ? `L${Math.abs(value)}` : `R${value}`;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        ref={knobRef}
        className="w-[22px] h-[22px] rounded-full border-2 border-[#555] flex items-center justify-center cursor-pointer touch-none"
        style={{ background: "radial-gradient(circle, #555 0%, #3a3a3a 100%)" }}
        onPointerDown={(e) => {
          setDragging(true);
          startYRef.current = e.clientY;
          startValRef.current = value;
        }}
        onDoubleClick={() => onChange(0)}
      >
        <div className="w-[1px] h-2.5 rounded-full" style={{ background: "#ddd", transform: `rotate(${rotation}deg)`, transformOrigin: "bottom center" }} />
      </div>
      <span className="text-[6px] font-mono text-[#888]">{label}</span>
    </div>
  );
}

/* ── Channel Strip ── */
function ChannelStrip({
  name, icon, accentColor, volume, onVolumeChange, pan, onPanChange,
  isMuted, isSolo, onMute, onSolo, isRecordArmed, audioActive, isMaster,
}: {
  name: string; icon: React.ReactNode; accentColor: string;
  volume: number; onVolumeChange: (v: number) => void;
  pan: number; onPanChange: (v: number) => void;
  isMuted: boolean; isSolo: boolean;
  onMute?: () => void; onSolo?: () => void;
  isRecordArmed?: boolean; audioActive: boolean; isMaster?: boolean;
}) {
  const db = volume > 0 ? ((volume / 100 - 1) * 50).toFixed(1) : "-∞";

  return (
    <div className="flex flex-col items-center w-[72px] shrink-0 border-r border-[#333]"
      style={{ background: isMaster ? "linear-gradient(180deg, #2a3540 0%, #1e2830 100%)" : "#2a2a2a" }}>

      {/* Name */}
      <div className="w-full px-1 pt-1.5 pb-1 border-b border-[#333]">
        <span className={`text-[7px] font-bold truncate block text-center ${isMaster ? "text-[#4fd1c5]" : "text-[#bbb]"}`}>{name}</span>
      </div>

      {/* Icon */}
      <div className="py-1.5">{icon}</div>

      {/* M / S / R */}
      {!isMaster && (
        <div className="flex items-center gap-[2px] py-1">
          <button onClick={onMute}
            className={`w-[20px] h-[16px] text-[7px] font-black rounded-[2px] flex items-center justify-center border ${
              isMuted ? "bg-red-600/80 text-white border-red-500" : "bg-[#3a3a3a] text-[#888] border-[#444]"
            }`}>M</button>
          <button onClick={onSolo}
            className={`w-[20px] h-[16px] text-[7px] font-black rounded-[2px] flex items-center justify-center border ${
              isSolo ? "bg-yellow-500/80 text-black border-yellow-400" : "bg-[#3a3a3a] text-[#888] border-[#444]"
            }`}>S</button>
          {isRecordArmed !== undefined && (
            <div className={`w-[16px] h-[16px] rounded-full flex items-center justify-center ${
              isRecordArmed ? "bg-red-500" : "bg-[#3a3a3a] border border-[#444]"
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isRecordArmed ? "bg-white" : "bg-[#666]"}`} />
            </div>
          )}
        </div>
      )}

      {/* Pan knob */}
      {!isMaster && <PanKnob value={pan} onChange={onPanChange} />}

      {/* dB display */}
      <div className="w-[48px] h-3.5 rounded-sm border border-[#444] flex items-center justify-center my-1" style={{ background: "#111" }}>
        <span className="text-[7px] font-mono text-[#aaa]">{db === "-50.0" ? "-∞" : `${db}dB`}</span>
      </div>

      {/* Fader + meters */}
      <div className="flex gap-[2px] flex-1 py-0.5 px-1" style={{ height: 160 }}>
        <MixerMeter active={audioActive && !isMuted} intensity={volume / 100} />
        <VerticalFader value={volume} onChange={onVolumeChange} accentColor={accentColor} />
        <MixerMeter active={audioActive && !isMuted} intensity={volume / 120} />
      </div>

      {/* Label */}
      <div className="py-1">
        {isMaster ? (
          <span className="text-[7px] font-bold text-[#4fd1c5]">MASTER</span>
        ) : (
          <span className="text-[6px] font-mono text-[#666]">{volume}%</span>
        )}
      </div>
    </div>
  );
}

/* ═══ MIXER SHEET ═══ */
export default function MixerSheet({
  open, onClose, beatName, takes, activeTakeId,
  beatVolume, setBeatVolume, vocalVolume, setVocalVolume,
  beatPan, setBeatPan, vocalPan, setVocalPan,
  masterVolume, setMasterVolume,
  onToggleMute, onToggleSolo, isAudioActive,
  onPlayAll, onStopPlayback,
}: MixerSheetProps) {
  if (!open) return null;

  const ACCENT_COLORS = ["#38b2ac", "#6366f1", "#8b5cf6", "#a855f7", "#3b82f6"];

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-[#000]/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative mt-auto rounded-t-xl overflow-hidden border-t border-[#444]"
        style={{ maxHeight: "90vh", background: "#222" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#333]" style={{ background: "#2a2a2a" }}>
          <span className="text-[11px] font-bold text-[#ddd]">Mixer</span>
          <button onClick={onClose} className="w-6 h-6 rounded-full flex items-center justify-center bg-[#444]">
            <X className="w-3.5 h-3.5 text-[#ccc]" />
          </button>
        </div>

        {/* Channel strips */}
        <div className="flex overflow-x-auto overflow-y-hidden" style={{ maxHeight: "calc(90vh - 90px)" }}>
          {/* Beat */}
          <ChannelStrip
            name={beatName || "Beat"}
            icon={<Music className="w-4 h-4 text-[#4fd1c5]" />}
            accentColor={ACCENT_COLORS[0]}
            volume={beatVolume}
            onVolumeChange={setBeatVolume}
            pan={beatPan}
            onPanChange={setBeatPan}
            isMuted={false}
            isSolo={false}
            audioActive={isAudioActive}
          />

          {/* Vocal takes */}
          {takes.map((take, idx) => (
            <ChannelStrip
              key={take.id}
              name={take.name}
              icon={<Mic className="w-4 h-4 text-[#b794f4]" />}
              accentColor={ACCENT_COLORS[(idx + 1) % ACCENT_COLORS.length]}
              volume={vocalVolume}
              onVolumeChange={setVocalVolume}
              pan={vocalPan}
              onPanChange={setVocalPan}
              isMuted={take.muted}
              isSolo={take.solo}
              onMute={() => onToggleMute(take.id)}
              onSolo={() => onToggleSolo(take.id)}
              isRecordArmed={activeTakeId === take.id}
              audioActive={isAudioActive && !take.muted}
            />
          ))}

          {/* Master */}
          <ChannelStrip
            name="Master"
            icon={<Volume2 className="w-4 h-4 text-[#4fd1c5]" />}
            accentColor="#4fd1c5"
            volume={masterVolume}
            onVolumeChange={setMasterVolume}
            pan={0}
            onPanChange={() => {}}
            isMuted={false}
            isSolo={false}
            audioActive={isAudioActive}
            isMaster
          />
        </div>

        {/* Transport */}
        <div className="flex items-center justify-center gap-3 py-2 border-t border-[#333]" style={{ background: "#1e1e1e" }}>
          <button onClick={onStopPlayback}
            className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: "#3a3a3a" }}>
            <SkipBack className="w-3.5 h-3.5 text-[#ccc]" />
          </button>
          <button onClick={onPlayAll}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "radial-gradient(circle, #ef4444 60%, #b91c1c 100%)" }}>
            <div className="w-3.5 h-3.5 rounded-full bg-white/90" />
          </button>
          <button onClick={onPlayAll}
            className="w-10 h-10 rounded-md flex items-center justify-center"
            style={{ background: "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)" }}>
            <Play className="w-4 h-4 text-white ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
