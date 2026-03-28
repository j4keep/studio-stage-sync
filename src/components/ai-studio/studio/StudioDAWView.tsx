import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  ArrowLeft, Mic, Play, Pause, Square, SkipBack,
  Repeat, Music, Volume2, Sliders, Download, Save,
  X, AudioWaveform, Pencil, RotateCcw, Share2, Upload,
  ChevronRight, Settings, Trash2
} from "lucide-react";
import MixerSheet from "./MixerSheet";

export interface TakeLocal {
  id: string;
  name: string;
  audioUrl: string;
  blob?: Blob;
  duration: number;
  muted: boolean;
  solo: boolean;
  trimStart: number;
  trimEnd: number;
  waveform: number[];
  createdAt: string;
  persisted: boolean;
}

interface StudioDAWViewProps {
  sessionName: string;
  beatName: string | null;
  beatUrl: string | null;
  takes: TakeLocal[];
  activeTakeId: string | null;
  setActiveTakeId: (id: string | null) => void;
  isRecording: boolean;
  isPlaying: boolean;
  recordTime: number;
  playbackTime: number;
  playbackDuration: number;
  liveWaveform: number[];
  beatVolume: number;
  setBeatVolume: (v: number) => void;
  vocalVolume: number;
  setVocalVolume: (v: number) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPlayAll: () => void;
  onPlayBeatOnly: () => void;
  onPlayTake: (take: TakeLocal) => void;
  onStopPlayback: () => void;
  onPausePlayback: () => void;
  onToggleMute: (id: string) => void;
  onToggleSolo: (id: string) => void;
  onDeleteTake: (id: string) => void;
  onSave: () => void;
  savingTake: boolean;
  onNavigate: (screen: string) => void;
  onBack: () => void;
  beatPan: number;
  setBeatPan: (v: number) => void;
  vocalPan: number;
  setVocalPan: (v: number) => void;
  beatWaveform: number[];
}

/* ── colour sets per track ── */
const TRACK_COLORS = [
  { bg: "#2a4a4a", wave: "#4fd1c5", border: "#2d6a5e", accent: "#38b2ac" },
  { bg: "#2a3a5a", wave: "#63b3ed", border: "#2b4a7a", accent: "#4299e1" },
  { bg: "#3a2a5a", wave: "#b794f4", border: "#4a2d7a", accent: "#9f7aea" },
  { bg: "#2a2a5a", wave: "#7f9cf5", border: "#3a3a7a", accent: "#667eea" },
];

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor(((s % 1) * 1000));
  return `${m} :${String(sec).padStart(2, "0")} :${String(ms).padStart(3, "0")}`;
};

/* ── Level Meter ── */
function LevelMeter({ active, intensity = 0.5 }: { active: boolean; intensity?: number }) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) { setLevel(0); return; }
    const animate = () => {
      const target = intensity + (Math.random() - 0.5) * 0.3;
      setLevel(prev => prev + (Math.max(0.05, Math.min(1, target)) - prev) * 0.3);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, intensity]);

  const segments = 20;
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
        return (
          <div
            key={i}
            className="rounded-[0.5px]"
            style={{
              height: 3,
              backgroundColor: color,
              opacity: isLit ? 1 : 0.15,
              boxShadow: isLit && i >= segments * 0.85 ? "0 0 4px #ef4444" : "none",
            }}
          />
        );
      })}
    </div>
  );
}

/* ── Waveform Display ── */
function WaveformDisplay({ peaks, color, isActive }: { peaks: number[]; color: string; isActive?: boolean }) {
  if (peaks.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <span className="text-[9px] text-[#555] italic">No audio</span>
      </div>
    );
  }
  const displayed = peaks.length > 120 
    ? Array.from({ length: 120 }, (_, i) => peaks[Math.floor(i * peaks.length / 120)]) 
    : peaks;
  
  return (
    <div className="flex items-center h-full w-full gap-[0.5px] px-0.5">
      {displayed.map((peak, i) => {
        const h = Math.max(peak * 90, 4);
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-center" style={{ minWidth: 1 }}>
            <div
              style={{
                height: `${h / 2}%`,
                backgroundColor: color,
                opacity: isActive ? 0.9 : 0.7,
                borderRadius: "1px 1px 0 0",
                width: "100%",
              }}
            />
            <div
              style={{
                height: `${h / 2}%`,
                backgroundColor: color,
                opacity: isActive ? 0.5 : 0.35,
                borderRadius: "0 0 1px 1px",
                width: "100%",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ── Track Lane ── */
function TrackLane({
  name, icon, colorSet, waveform, isActive, isMuted, isSolo,
  isRecordArmed, isRecordingNow, liveWaveform, volume, onVolumeChange,
  onMute, onSolo, onClick, onDelete, onPlay, audioActive, trackNumber,
  isPlaying,
}: {
  name: string;
  icon: React.ReactNode;
  colorSet: typeof TRACK_COLORS[0];
  waveform: number[];
  isActive: boolean;
  isMuted: boolean;
  isSolo: boolean;
  isRecordArmed?: boolean;
  isRecordingNow?: boolean;
  liveWaveform?: number[];
  volume: number;
  onVolumeChange: (v: number) => void;
  onMute?: () => void;
  onSolo?: () => void;
  onClick?: () => void;
  onDelete?: () => void;
  onPlay?: () => void;
  audioActive: boolean;
  trackNumber: number;
  isPlaying?: boolean;
}) {
  return (
    <div
      className={`flex border-b border-[#333] ${isActive ? "ring-1 ring-[#4fd1c5]/40" : ""}`}
      style={{ minHeight: 100 }}
      onClick={onClick}
    >
      {/* Track header */}
      <div className="w-[130px] shrink-0 border-r border-[#444] flex flex-col p-2 gap-1"
        style={{ background: "linear-gradient(180deg, #4a4a4a 0%, #3a3a3a 100%)" }}>
        
        {/* Track name + delete */}
        <div className="flex items-center gap-1">
          {icon}
          <span className="text-[10px] font-bold text-[#e0e0e0] truncate flex-1">
            {trackNumber}: {name}
          </span>
          {onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="opacity-40 hover:opacity-100">
              <X className="w-3 h-3 text-[#999]" />
            </button>
          )}
        </div>

        {/* M / S / Record arm / Play */}
        <div className="flex items-center gap-1 mt-1">
          <button
            onClick={(e) => { e.stopPropagation(); onMute?.(); }}
            className={`w-[26px] h-[22px] text-[9px] font-black rounded-sm flex items-center justify-center transition-colors border ${
              isMuted 
                ? "bg-[#666] text-white border-[#888]" 
                : "bg-[#555] text-[#ccc] border-[#666] hover:bg-[#666]"
            }`}
          >M</button>
          <button
            onClick={(e) => { e.stopPropagation(); onSolo?.(); }}
            className={`w-[26px] h-[22px] text-[9px] font-black rounded-sm flex items-center justify-center transition-colors border ${
              isSolo 
                ? "bg-[#666] text-white border-[#888]" 
                : "bg-[#555] text-[#ccc] border-[#666] hover:bg-[#666]"
            }`}
          >S</button>
          {isRecordArmed !== undefined && (
            <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center border ${
              isRecordingNow 
                ? "bg-red-500 border-red-400 animate-pulse" 
                : "bg-[#555] border-[#666]"
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full ${isRecordingNow ? "bg-white" : "bg-[#999]"}`} />
            </div>
          )}
          {/* Per-track play button */}
          {onPlay && (
            <button
              onClick={(e) => { e.stopPropagation(); onPlay(); }}
              className={`w-[22px] h-[22px] rounded-sm flex items-center justify-center border ml-auto transition-colors ${
                isPlaying ? "bg-green-600 border-green-500" : "bg-[#555] border-[#666] hover:bg-[#666]"
              }`}
            >
              {isPlaying ? (
                <Pause className="w-2.5 h-2.5 text-white" />
              ) : (
                <Play className="w-2.5 h-2.5 text-[#ccc] ml-[1px]" />
              )}
            </button>
          )}
          {!onPlay && audioActive && !isMuted && (
            <Volume2 className="w-3.5 h-3.5 text-[#4fd1c5] ml-auto" />
          )}
        </div>

        {/* Volume slider */}
        <div className="flex items-center gap-1 mt-1">
          <div className="relative flex-1 h-[6px] bg-[#333] rounded-sm overflow-hidden">
            <div
              className="absolute left-0 top-0 bottom-0 rounded-sm"
              style={{ width: `${volume}%`, backgroundColor: "#666" }}
            />
            <input
              type="range" min={0} max={100} value={volume}
              onChange={(e) => { e.stopPropagation(); onVolumeChange(Number(e.target.value)); }}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <div className="w-4 h-4 bg-[#555] border border-[#777] rounded-[2px] cursor-grab" />
        </div>
      </div>

      {/* Waveform area */}
      <div className="flex-1 relative overflow-hidden flex items-center"
        style={{ backgroundColor: colorSet.bg }}>
        
        {isRecordingNow && liveWaveform && liveWaveform.length > 0 ? (
          <div className="flex items-center h-full w-full gap-[0.5px] px-0.5">
            {liveWaveform.map((peak, i) => {
              const h = Math.max(peak * 90, 4);
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-center" style={{ minWidth: 1 }}>
                  <div style={{ height: `${h / 2}%`, backgroundColor: colorSet.wave, opacity: 0.9, borderRadius: "1px 1px 0 0", width: "100%" }} />
                  <div style={{ height: `${h / 2}%`, backgroundColor: colorSet.wave, opacity: 0.5, borderRadius: "0 0 1px 1px", width: "100%" }} />
                </div>
              );
            })}
          </div>
        ) : (
          <WaveformDisplay peaks={waveform} color={colorSet.wave} isActive={isActive} />
        )}

        {/* Level meters */}
        <div className="absolute right-1 top-2 bottom-2 flex gap-[2px]">
          <LevelMeter active={audioActive && !isMuted} intensity={volume / 100} />
          <LevelMeter active={audioActive && !isMuted} intensity={volume / 120} />
        </div>

        {isMuted && (
          <div className="absolute inset-0 bg-[#1a1a1a]/50 flex items-center justify-center">
            <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider">Muted</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN DAW VIEW
   ═══════════════════════════════════════════ */
export default function StudioDAWView(props: StudioDAWViewProps) {
  const {
    sessionName, beatName, beatUrl, takes, activeTakeId, setActiveTakeId,
    isRecording, isPlaying, recordTime, playbackTime, playbackDuration,
    liveWaveform, beatVolume, setBeatVolume, vocalVolume, setVocalVolume,
    onStartRecording, onStopRecording, onPlayAll, onPlayBeatOnly, onPlayTake,
    onStopPlayback, onPausePlayback, onToggleMute, onToggleSolo,
    onDeleteTake, onSave, savingTake,
    onNavigate, onBack, beatPan, setBeatPan, vocalPan, setVocalPan,
    beatWaveform,
  } = props;

  const [showMixer, setShowMixer] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);

  const activeTake = takes.find(t => t.id === activeTakeId);
  const totalDuration = useMemo(() => {
    const maxTake = Math.max(...takes.map(t => t.duration), 0);
    return Math.max(maxTake, recordTime, playbackDuration, 30);
  }, [takes, recordTime, playbackDuration]);

  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    const interval = totalDuration > 120 ? 30 : totalDuration > 60 ? 10 : 5;
    for (let t = 0; t <= totalDuration; t += interval) markers.push(t);
    return markers;
  }, [totalDuration]);

  const currentTime = isRecording ? recordTime : isPlaying ? playbackTime : 0;
  const playheadPct = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  const isAudioActive = isRecording || isPlaying;

  return (
    <div className="flex flex-col h-full" style={{ background: "#1e1e1e" }}>
      
      {/* ── Top toolbar ── */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#333]"
        style={{ background: "linear-gradient(180deg, #4a4a4a 0%, #3a3a3a 100%)" }}>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1 hover:bg-[#555] rounded">
            <ArrowLeft className="w-4 h-4 text-[#ccc]" />
          </button>
          <div className="w-px h-4 bg-[#555]" />
          <button onClick={() => onNavigate("effects")} className="p-1 hover:bg-[#555] rounded" title="Effects & Settings">
            <Settings className="w-4 h-4 text-[#aaa]" />
          </button>
        </div>
        <span className="text-[11px] font-bold text-[#ddd] truncate max-w-[180px]">{sessionName}</span>
        <div className="flex items-center gap-1">
          <button onClick={onSave} className="p-1 hover:bg-[#555] rounded" title="Save Session">
            <Save className="w-4 h-4 text-[#aaa]" />
          </button>
        </div>
      </div>

      {/* ── Timeline ruler ── */}
      <div className="flex h-6 border-b border-[#333] shrink-0" style={{ background: "#2a2a2a" }}>
        <div className="w-[130px] shrink-0 border-r border-[#444]" />
        <div className="flex-1 relative overflow-hidden">
          {/* Playhead triangle */}
          <div
            className="absolute top-0 z-20"
            style={{ left: `${playheadPct}%`, transform: "translateX(-50%)" }}
          >
            <div style={{
              width: 0, height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "8px solid #4fd1c5",
            }} />
          </div>
          
          <div className="flex h-full items-end">
            {timeMarkers.map(t => (
              <div
                key={t}
                className="absolute bottom-0 flex flex-col items-center"
                style={{ left: `${(t / totalDuration) * 100}%` }}
              >
                <span className="text-[7px] font-mono text-[#888] leading-none mb-0.5">
                  {Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, "0")}.000
                </span>
                <div className="w-px h-2 bg-[#555]" />
              </div>
            ))}
            {/* Red beat markers */}
            {Array.from({ length: Math.min(20, Math.ceil(totalDuration / 2)) }, (_, i) => (
              <div
                key={`beat-${i}`}
                className="absolute top-0 w-[2px] h-1.5"
                style={{
                  left: `${(i * 2 / totalDuration) * 100}%`,
                  backgroundColor: "#ef4444",
                }}
              />
            ))}
          </div>

          {/* Playhead line */}
          <div
            className="absolute top-0 bottom-0 w-[1px] z-10"
            style={{ left: `${playheadPct}%`, backgroundColor: "#eab308" }}
          />
        </div>
      </div>

      {/* ── Track Lanes ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0" style={{ background: "#1e1e1e" }}>
        {/* Beat Track */}
        <TrackLane
          name={beatName || "Beat Track"}
          icon={<Music className="w-3.5 h-3.5 text-[#4fd1c5]" />}
          colorSet={TRACK_COLORS[0]}
          waveform={beatWaveform}
          isActive={false}
          isMuted={false}
          isSolo={false}
          volume={beatVolume}
          onVolumeChange={setBeatVolume}
          onPlay={beatUrl ? onPlayBeatOnly : undefined}
          audioActive={isAudioActive}
          trackNumber={1}
          isPlaying={isPlaying}
        />

        {/* Vocal takes */}
        {takes.map((take, idx) => (
          <TrackLane
            key={take.id}
            name={take.name}
            icon={<Mic className="w-3.5 h-3.5 text-[#b794f4]" />}
            colorSet={TRACK_COLORS[(idx + 1) % TRACK_COLORS.length]}
            waveform={take.waveform}
            isActive={activeTakeId === take.id}
            isMuted={take.muted}
            isSolo={take.solo}
            isRecordArmed={activeTakeId === take.id}
            isRecordingNow={isRecording && activeTakeId === take.id}
            liveWaveform={activeTakeId === take.id ? liveWaveform : undefined}
            volume={vocalVolume}
            onVolumeChange={setVocalVolume}
            onMute={() => onToggleMute(take.id)}
            onSolo={() => onToggleSolo(take.id)}
            onClick={() => setActiveTakeId(take.id)}
            onPlay={() => onPlayTake(take)}
            onDelete={() => onDeleteTake(take.id)}
            audioActive={isAudioActive && !take.muted && activeTakeId === take.id}
            trackNumber={idx + 2}
            isPlaying={isPlaying && activeTakeId === take.id}
          />
        ))}

        {/* Recording placeholder when no takes yet */}
        {isRecording && takes.length === 0 && (
          <TrackLane
            name="Recording..."
            icon={<Mic className="w-3.5 h-3.5 text-red-400" />}
            colorSet={TRACK_COLORS[1]}
            waveform={[]}
            isActive={true}
            isMuted={false}
            isSolo={false}
            isRecordArmed={true}
            isRecordingNow={true}
            liveWaveform={liveWaveform}
            volume={vocalVolume}
            onVolumeChange={setVocalVolume}
            audioActive={true}
            trackNumber={2}
          />
        )}

        {/* Add track button */}
        <div className="flex" style={{ minHeight: 70 }}>
          <div className="w-[130px] shrink-0 border-r border-[#333] p-3 flex items-center justify-center"
            style={{ background: "#2e2e2e" }}>
            <button
              onClick={onStartRecording}
              disabled={isRecording || savingTake}
              className="w-full border-2 border-dashed border-[#555] rounded-lg py-3 flex items-center justify-center gap-1 text-[#777] hover:text-[#4fd1c5] hover:border-[#4fd1c5]/50 transition-colors disabled:opacity-30"
            >
              <span className="text-2xl font-light">+</span>
            </button>
          </div>
          <div className="flex-1" style={{ background: "#1e1e1e" }} />
        </div>

        {/* Right-side toolbar */}
        <div className="absolute right-0 top-[120px] flex flex-col gap-1 z-10">
          <button onClick={() => setShowMixer(true)} className="w-7 h-7 bg-[#444] hover:bg-[#555] rounded-l flex items-center justify-center border-l border-t border-b border-[#555]">
            <Sliders className="w-3.5 h-3.5 text-[#bbb]" />
          </button>
          <button onClick={() => onNavigate("takes")} className="w-7 h-7 bg-[#444] hover:bg-[#555] rounded-l flex items-center justify-center border-l border-t border-b border-[#555]">
            <AudioWaveform className="w-3.5 h-3.5 text-[#bbb]" />
          </button>
        </div>

        <div className="h-20" />
      </div>

      {/* ── Transport Bar ── */}
      <div className="flex items-center justify-between px-2 py-2 border-t border-[#444] shrink-0"
        style={{ background: "linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 100%)" }}>
        
        {/* Left: Record, Play, Rewind, Loop */}
        <div className="flex items-center gap-2">
          {/* Record - only red/pulsing when actively recording */}
          <button
            onClick={isRecording ? onStopRecording : onStartRecording}
            disabled={savingTake}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-50"
            style={{
              background: isRecording
                ? "radial-gradient(circle, #ef4444 60%, #dc2626 100%)"
                : "radial-gradient(circle, #777 60%, #555 100%)",
              boxShadow: isRecording ? "0 0 12px #ef444480" : "0 2px 6px #00000060",
            }}
          >
            {isRecording ? (
              <Square className="w-4 h-4 text-white" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-red-500" />
            )}
          </button>

          {/* Play - plays all tracks together */}
          <button
            onClick={isPlaying ? onPausePlayback : onPlayAll}
            disabled={isRecording}
            className="w-10 h-10 rounded-md flex items-center justify-center transition-all active:scale-90 disabled:opacity-30"
            style={{
              background: isPlaying
                ? "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)"
                : "linear-gradient(180deg, #555 0%, #444 100%)",
              boxShadow: "0 2px 4px #00000040",
            }}
          >
            {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
          </button>

          {/* Rewind */}
          <button
            onClick={onStopPlayback}
            className="w-8 h-8 rounded-md flex items-center justify-center active:scale-90 transition-all"
            style={{ background: "linear-gradient(180deg, #555 0%, #444 100%)" }}
          >
            <SkipBack className="w-3.5 h-3.5 text-[#ccc]" />
          </button>

          {/* Loop */}
          <button
            onClick={() => setLoopEnabled(!loopEnabled)}
            className="w-8 h-8 rounded-md flex items-center justify-center transition-all active:scale-90"
            style={{
              background: loopEnabled
                ? "linear-gradient(180deg, #eab308 0%, #ca8a04 100%)"
                : "linear-gradient(180deg, #555 0%, #444 100%)",
            }}
          >
            <Repeat className="w-3.5 h-3.5" style={{ color: loopEnabled ? "#000" : "#ccc" }} />
          </button>
        </div>

        {/* Center: Time display */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-md font-mono text-sm tabular-nums border"
            style={{
              background: "#111",
              borderColor: "#444",
              color: "#e0e0e0",
              fontFamily: "monospace",
              letterSpacing: "0.05em",
            }}>
            {fmt(currentTime)}
          </div>
          {isRecording && (
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            </div>
          )}
        </div>

        {/* Right: Tool buttons */}
        <div className="flex items-center gap-1">
          <button className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#555]"
            style={{ background: "#444" }} onClick={() => onNavigate("effects")}>
            <Pencil className="w-3.5 h-3.5 text-[#aaa]" />
          </button>
          <button className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#555]"
            style={{ background: "#444" }} onClick={() => setShowMixer(true)}>
            <Sliders className="w-3.5 h-3.5 text-[#aaa]" />
          </button>
          <button className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#555]"
            style={{ background: "#444" }} onClick={() => onNavigate("export")}>
            <Download className="w-3.5 h-3.5 text-[#aaa]" />
          </button>
        </div>
      </div>

      {/* Saving overlay */}
      {savingTake && (
        <div className="absolute inset-0 bg-[#000]/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex items-center gap-3 bg-[#333] border border-[#555] rounded-xl px-6 py-4">
            <div className="w-5 h-5 border-2 border-[#4fd1c5] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-[#ddd]">Saving take...</span>
          </div>
        </div>
      )}

      {/* Mixer Sheet */}
      <MixerSheet
        open={showMixer}
        onClose={() => setShowMixer(false)}
        beatName={beatName}
        takes={takes}
        activeTakeId={activeTakeId}
        beatVolume={beatVolume}
        setBeatVolume={setBeatVolume}
        vocalVolume={vocalVolume}
        setVocalVolume={setVocalVolume}
        beatPan={beatPan}
        setBeatPan={setBeatPan}
        vocalPan={vocalPan}
        setVocalPan={setVocalPan}
        onToggleMute={onToggleMute}
        onToggleSolo={onToggleSolo}
        isAudioActive={isAudioActive}
      />
    </div>
  );
}
