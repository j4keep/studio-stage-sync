import { useState, useRef, useEffect } from "react";
import { X, Mic, Music, Plus, Volume2 } from "lucide-react";
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
  onToggleMute: (id: string) => void;
  onToggleSolo: (id: string) => void;
  isAudioActive: boolean;
}

/* ── Realistic vertical fader ── */
function VerticalFader({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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

  // dB scale markings
  const dbMarks = [0, -3, -6, -12, -20, -30, -40, -50];

  return (
    <div className="relative flex">
      {/* dB labels */}
      <div className="flex flex-col justify-between h-full mr-1 py-1">
        {dbMarks.map(db => (
          <span key={db} className="text-[6px] font-mono text-[#888] leading-none text-right w-5">
            {db}
          </span>
        ))}
      </div>

      {/* Fader track */}
      <div
        ref={trackRef}
        className="relative w-[18px] h-full cursor-pointer touch-none rounded-sm"
        style={{ background: "linear-gradient(180deg, #1a1a1a 0%, #222 100%)", border: "1px solid #444" }}
        onPointerDown={(e) => { setDragging(true); handlePointer(e.clientY); }}
      >
        {/* Green fill */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            height: `${value}%`,
            background: "linear-gradient(to top, #22c55e 0%, #22c55e 50%, #eab308 80%, #ef4444 100%)",
            opacity: 0.5,
          }}
        />
        {/* Thumb */}
        <div
          className="absolute left-[-2px] right-[-2px] h-[10px] rounded-[2px]"
          style={{
            bottom: `${value}%`,
            transform: "translateY(50%)",
            background: "linear-gradient(180deg, #888 0%, #666 50%, #555 100%)",
            border: "1px solid #999",
            boxShadow: "0 1px 3px #00000060, inset 0 1px 0 #aaa",
          }}
        >
          {/* Grip lines */}
          <div className="flex flex-col gap-[1px] items-center justify-center h-full">
            <div className="w-3 h-[0.5px] bg-[#aaa]" />
            <div className="w-3 h-[0.5px] bg-[#999]" />
            <div className="w-3 h-[0.5px] bg-[#aaa]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Level meter (segmented, realistic) ── */
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

  const segments = 30;
  const lit = Math.round(level * segments);

  return (
    <div className="flex flex-col-reverse gap-[1px] w-[6px]">
      {Array.from({ length: segments }, (_, i) => {
        const isLit = i < lit;
        let color = "#1a1a1a";
        if (isLit) {
          if (i < segments * 0.6) color = "#22c55e";
          else if (i < segments * 0.85) color = "#eab308";
          else color = "#ef4444";
        }
        return (
          <div
            key={i}
            className="rounded-[0.5px]"
            style={{
              height: 3,
              backgroundColor: color,
              opacity: isLit ? 1 : 0.12,
              boxShadow: isLit && i >= segments * 0.85 ? "0 0 3px #ef4444" : "none",
            }}
          />
        );
      })}
    </div>
  );
}

/* ── Channel Strip (n-Track style) ── */
function ChannelStrip({
  name, icon, iconColor, volume, onVolumeChange, pan, onPanChange,
  isMuted, isSolo, onMute, onSolo, isRecordArmed, audioActive,
}: {
  name: string;
  icon: React.ReactNode;
  iconColor: string;
  volume: number;
  onVolumeChange: (v: number) => void;
  pan: number;
  onPanChange: (v: number) => void;
  isMuted: boolean;
  isSolo: boolean;
  onMute?: () => void;
  onSolo?: () => void;
  isRecordArmed?: boolean;
  audioActive: boolean;
}) {
  const db = volume > 0 ? ((volume / 100 - 1) * 50).toFixed(1) : "-∞";

  return (
    <div className="flex flex-col items-center w-[80px] shrink-0 border-r border-[#444]"
      style={{ background: "linear-gradient(180deg, #4a4a4a 0%, #3a3a3a 100%)" }}>

      {/* Name + close */}
      <div className="w-full px-1 pt-2 pb-1 border-b border-[#555] flex items-center gap-1">
        <span className="text-[8px] font-bold text-[#ccc] truncate flex-1">{name}</span>
        <X className="w-2.5 h-2.5 text-[#888] cursor-pointer hover:text-[#ccc]" />
      </div>

      {/* Icon */}
      <div className="py-2">
        {icon}
      </div>

      {/* Input label */}
      <div className="w-[64px] h-4 rounded-sm mb-1 flex items-center justify-center"
        style={{ background: iconColor, opacity: 0.7 }}>
        <span className="text-[6px] font-bold text-white truncate px-1">iPhone Microp...</span>
      </div>

      {/* M / S / Record */}
      <div className="flex items-center gap-1 py-1">
        <button
          onClick={onMute}
          className={`w-[24px] h-[20px] text-[9px] font-black rounded-sm flex items-center justify-center border ${
            isMuted ? "bg-[#888] text-white border-[#999]" : "bg-[#555] text-[#bbb] border-[#666]"
          }`}
        >M</button>
        <button
          onClick={onSolo}
          className={`w-[24px] h-[20px] text-[9px] font-black rounded-sm flex items-center justify-center border ${
            isSolo ? "bg-[#888] text-white border-[#999]" : "bg-[#555] text-[#bbb] border-[#666]"
          }`}
        >S</button>
        {isRecordArmed !== undefined && (
          <div className={`w-[20px] h-[20px] rounded-full flex items-center justify-center ${
            isRecordArmed ? "bg-red-500" : "bg-[#555] border border-[#666]"
          }`}>
            <div className={`w-2 h-2 rounded-full ${isRecordArmed ? "bg-white" : "bg-[#888]"}`} />
          </div>
        )}
      </div>

      {/* Pan knob */}
      <div className="py-1">
        <div className="w-[20px] h-[20px] rounded-full border-2 border-[#666] flex items-center justify-center cursor-pointer"
          style={{ background: "#444" }}>
          <div className="w-[1px] h-2 rounded-full"
            style={{
              background: "#ccc",
              transform: `rotate(${pan * 1.35}deg)`,
              transformOrigin: "bottom center",
            }} />
        </div>
      </div>

      {/* dB readout */}
      <div className="w-[50px] h-4 rounded-sm border border-[#555] flex items-center justify-center mb-1"
        style={{ background: "#222" }}>
        <span className="text-[8px] font-mono text-[#ccc]">{db === "-50.0" ? "0" : db}</span>
      </div>

      {/* Fader + meters area */}
      <div className="flex gap-1 flex-1 py-1 px-1" style={{ height: 180 }}>
        <MixerMeter active={audioActive && !isMuted} intensity={volume / 100} />
        <VerticalFader value={volume} onChange={onVolumeChange} />
        <MixerMeter active={audioActive && !isMuted} intensity={volume / 120} />
      </div>

      {/* Volume readout */}
      <div className="flex items-center gap-1 py-1">
        <div className="w-6 h-4 rounded-sm border border-[#555] flex items-center justify-center"
          style={{ background: "#333" }}>
          <Volume2 className="w-2.5 h-2.5 text-[#888]" />
        </div>
        <span className="text-[7px] font-mono text-[#aaa]">+{(pan / 100).toFixed(1)}</span>
      </div>

      {/* EQ button */}
      <button className="w-[62px] h-5 rounded-sm text-[8px] font-bold border mb-1"
        style={{ background: "#444", borderColor: "#666", color: "#ccc" }}>
        EQ
      </button>

      {/* ADD EFX */}
      <button className="w-[62px] h-4 rounded-sm text-[7px] font-bold border mb-1"
        style={{ background: "#3a3a3a", borderColor: "#555", color: "#999" }}>
        ADD EFX
      </button>

      {/* Effect slot */}
      <div className="w-[62px] h-8 border border-dashed border-[#555] rounded-sm flex items-center justify-center mb-1"
        style={{ background: "#2a2a2a" }}>
        <Plus className="w-3 h-3 text-[#666]" />
      </div>

      {/* Speaker */}
      <button className="w-[62px] h-4 rounded-sm text-[7px] font-bold border mb-1"
        style={{ background: "#444", borderColor: "#666", color: "#bbb" }}>
        Speaker
      </button>

      {/* Add send */}
      <button className="text-[7px] text-[#4fd1c5] w-full py-1 mb-1">
        Add send
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MIXER SHEET (full-screen overlay)
   ═══════════════════════════════════════════ */
export default function MixerSheet({
  open, onClose, beatName, takes, activeTakeId,
  beatVolume, setBeatVolume, vocalVolume, setVocalVolume,
  beatPan, setBeatPan, vocalPan, setVocalPan,
  onToggleMute, onToggleSolo, isAudioActive,
}: MixerSheetProps) {
  if (!open) return null;

  const ICON_COLORS = ["#38b2ac", "#6366f1", "#8b5cf6", "#a855f7", "#3b82f6"];

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-[#000]/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative mt-auto rounded-t-xl overflow-hidden border-t border-[#555]"
        style={{ maxHeight: "90vh", background: "#2e2e2e" }}>
        
        {/* Close */}
        <div className="absolute top-2 right-2 z-10">
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: "#555" }}>
            <X className="w-4 h-4 text-[#ccc]" />
          </button>
        </div>

        {/* Scrollable channels */}
        <div className="flex overflow-x-auto overflow-y-hidden" style={{ maxHeight: "calc(90vh - 50px)" }}>
          {/* Beat channel */}
          <ChannelStrip
            name={beatName || "Beat"}
            icon={<Music className="w-5 h-5 text-[#4fd1c5]" />}
            iconColor={ICON_COLORS[0]}
            volume={beatVolume}
            onVolumeChange={setBeatVolume}
            pan={beatPan}
            onPanChange={setBeatPan}
            isMuted={false}
            isSolo={false}
            audioActive={isAudioActive}
          />

          {/* Vocal channels */}
          {takes.map((take, idx) => (
            <ChannelStrip
              key={take.id}
              name={take.name}
              icon={<Mic className="w-5 h-5 text-[#b794f4]" />}
              iconColor={ICON_COLORS[(idx + 1) % ICON_COLORS.length]}
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

          {/* Master/Speaker channel */}
          <ChannelStrip
            name="Speaker"
            icon={<Volume2 className="w-5 h-5 text-[#999]" />}
            iconColor="#3b82f6"
            volume={Math.round((beatVolume + vocalVolume) / 2)}
            onVolumeChange={() => {}}
            pan={0}
            onPanChange={() => {}}
            isMuted={false}
            isSolo={false}
            audioActive={isAudioActive}
          />
        </div>

        {/* Bottom transport (in mixer) */}
        <div className="flex items-center justify-center gap-3 py-2 border-t border-[#444]"
          style={{ background: "#2a2a2a" }}>
          <button className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "radial-gradient(circle, #ef4444 60%, #b91c1c 100%)" }}>
            <div className="w-3.5 h-3.5 rounded-full bg-white/90" />
          </button>
          <button className="w-9 h-9 rounded-md flex items-center justify-center"
            style={{ background: "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)" }}>
            <Play className="w-4 h-4 text-white ml-0.5" />
          </button>
          <button className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: "#444" }}>
            <SkipBack className="w-3.5 h-3.5 text-[#ccc]" />
          </button>
          <button className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: "#eab308" }}>
            <Repeat className="w-3.5 h-3.5 text-black" />
          </button>
        </div>
      </div>
    </div>
  );
}
