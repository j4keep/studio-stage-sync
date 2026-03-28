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

function VerticalFader({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
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
      className="relative w-8 h-full rounded-sm bg-black/50 cursor-pointer touch-none"
      onPointerDown={(e) => { setDragging(true); handlePointer(e.clientY); }}
    >
      {/* Fill */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-sm opacity-30"
        style={{ height: `${value}%`, backgroundColor: color }}
      />
      {/* Thumb */}
      <div
        className="absolute left-0 right-0 h-3 rounded-sm shadow-md border border-white/30"
        style={{
          bottom: `${value}%`,
          transform: "translateY(50%)",
          backgroundColor: color,
        }}
      />
    </div>
  );
}

function MeterBar({ active, intensity }: { active: boolean; intensity: number }) {
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

  return (
    <div className="w-[6px] h-full rounded-sm overflow-hidden bg-black/60">
      <div
        className="absolute bottom-0 left-0 right-0 rounded-sm transition-[height] duration-75 w-full"
        style={{
          height: `${Math.round(level * 100)}%`,
          position: "relative",
          background: `linear-gradient(to top, #22c55e 0%, #22c55e 50%, #eab308 75%, #ef4444 95%)`,
        }}
      />
    </div>
  );
}

function ChannelStrip({
  name, icon, volume, onVolumeChange, pan, onPanChange,
  isMuted, isSolo, onMute, onSolo, isActive, color, audioActive,
}: {
  name: string;
  icon: React.ReactNode;
  volume: number;
  onVolumeChange: (v: number) => void;
  pan: number;
  onPanChange: (v: number) => void;
  isMuted: boolean;
  isSolo: boolean;
  onMute?: () => void;
  onSolo?: () => void;
  isActive: boolean;
  color: string;
  audioActive: boolean;
}) {
  const db = volume > 0 ? ((volume / 100 - 1) * 50).toFixed(1) : "-∞";

  return (
    <div className={`flex flex-col items-center w-[72px] shrink-0 p-2 border-r border-border/30 ${isActive ? "bg-primary/5" : ""}`}>
      {/* Label */}
      <span className="text-[8px] font-bold text-foreground truncate w-full text-center mb-1">{name}</span>
      
      {/* Icon */}
      <div className="mb-1">{icon}</div>

      {/* M / S / Arm */}
      <div className="flex items-center gap-0.5 mb-1.5">
        <button
          onClick={onMute}
          className={`w-[20px] h-[16px] text-[7px] font-black rounded flex items-center justify-center ${
            isMuted ? "bg-red-500/80 text-white" : "bg-muted/80 text-muted-foreground"
          }`}
        >M</button>
        <button
          onClick={onSolo}
          className={`w-[20px] h-[16px] text-[7px] font-black rounded flex items-center justify-center ${
            isSolo ? "bg-yellow-500/80 text-black" : "bg-muted/80 text-muted-foreground"
          }`}
        >S</button>
        <div className={`w-[16px] h-[16px] rounded-full flex items-center justify-center ${isActive ? "bg-red-500/60" : "bg-muted/80"}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-white" : "bg-muted-foreground/40"}`} />
        </div>
      </div>

      {/* Pan */}
      <input
        type="range"
        min={-100}
        max={100}
        value={pan}
        onChange={(e) => onPanChange(Number(e.target.value))}
        className="w-14 h-1 accent-primary mb-1"
      />
      
      {/* dB label */}
      <span className="text-[8px] font-mono text-muted-foreground mb-1">{db}</span>

      {/* Fader + Meters */}
      <div className="flex gap-1 h-32 mb-1">
        <MeterBar active={audioActive && !isMuted} intensity={volume / 100} />
        <VerticalFader value={volume} onChange={onVolumeChange} color={color} />
        <MeterBar active={audioActive && !isMuted} intensity={volume / 120} />
      </div>

      {/* Gain readout */}
      <div className="flex items-center gap-1 mb-1.5">
        <div className="w-4 h-3 rounded-sm bg-muted/50 flex items-center justify-center">
          <Volume2 className="w-2 h-2 text-muted-foreground" />
        </div>
        <span className="text-[8px] font-mono text-muted-foreground">
          {pan >= 0 ? `+${(pan / 100).toFixed(1)}` : (pan / 100).toFixed(1)}
        </span>
      </div>

      {/* EQ / FX buttons */}
      <button className="text-[7px] w-full py-1 rounded bg-muted/60 font-bold text-muted-foreground mb-0.5">EQ</button>
      <button className="text-[7px] w-full py-0.5 rounded bg-muted/30 font-bold text-muted-foreground/60 mb-0.5">ADD EFX</button>
      <div className="w-full h-6 border border-dashed border-muted/30 rounded flex items-center justify-center mb-0.5">
        <Plus className="w-2.5 h-2.5 text-muted-foreground/30" />
      </div>
      <button className="text-[7px] w-full py-0.5 rounded bg-muted/40 font-bold text-muted-foreground">Speaker</button>
      <button className="text-[7px] text-primary/60 w-full mt-0.5">Add send</button>
    </div>
  );
}

export default function MixerSheet({
  open, onClose, beatName, takes, activeTakeId,
  beatVolume, setBeatVolume, vocalVolume, setVocalVolume,
  beatPan, setBeatPan, vocalPan, setVocalPan,
  onToggleMute, onToggleSolo, isAudioActive,
}: MixerSheetProps) {
  if (!open) return null;

  const CHANNEL_COLORS = ["#06b6d4", "#8b5cf6", "#6366f1", "#a855f7", "#3b82f6"];

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative mt-auto bg-card border-t border-border/50 rounded-t-2xl overflow-hidden" style={{ maxHeight: "85vh" }}>
        {/* Handle + close */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
          <span className="text-xs font-bold text-foreground">Mixer</span>
          <button onClick={onClose} className="p-1 rounded-lg bg-muted/50">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable channel strips */}
        <div className="flex overflow-x-auto overflow-y-hidden py-2 px-1" style={{ maxHeight: "calc(85vh - 52px)" }}>
          {/* Beat channel */}
          <ChannelStrip
            name={beatName || "Beat"}
            icon={<Music className="w-4 h-4 text-cyan-400" />}
            volume={beatVolume}
            onVolumeChange={setBeatVolume}
            pan={beatPan}
            onPanChange={setBeatPan}
            isMuted={false}
            isSolo={false}
            isActive={false}
            color={CHANNEL_COLORS[0]}
            audioActive={isAudioActive}
          />

          {/* Vocal channels */}
          {takes.map((take, idx) => (
            <ChannelStrip
              key={take.id}
              name={take.name}
              icon={<Mic className="w-4 h-4 text-violet-400" />}
              volume={vocalVolume}
              onVolumeChange={setVocalVolume}
              pan={vocalPan}
              onPanChange={setVocalPan}
              isMuted={take.muted}
              isSolo={take.solo}
              onMute={() => onToggleMute(take.id)}
              onSolo={() => onToggleSolo(take.id)}
              isActive={activeTakeId === take.id}
              color={CHANNEL_COLORS[(idx + 1) % CHANNEL_COLORS.length]}
              audioActive={isAudioActive && !take.muted}
            />
          ))}

          {/* Master / Speaker channel */}
          <ChannelStrip
            name="Speaker"
            icon={<Volume2 className="w-4 h-4 text-primary" />}
            volume={Math.round((beatVolume + vocalVolume) / 2)}
            onVolumeChange={() => {}}
            pan={0}
            onPanChange={() => {}}
            isMuted={false}
            isSolo={false}
            isActive={false}
            color="#3b82f6"
            audioActive={isAudioActive}
          />
        </div>
      </div>
    </div>
  );
}
