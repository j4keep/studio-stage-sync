import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  ArrowLeft, Mic, Play, Pause, Square, SkipBack,
  Repeat, Music, Volume2, Sliders, Download, Save,
  X, AudioWaveform, Pencil, Settings, Trash2,
  Monitor, Undo2, Redo2, Headphones, LayoutGrid
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
  masterVolume: number;
  setMasterVolume: (v: number) => void;
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

const TRACK_COLORS = [
  { bg: "#1a2e2e", wave: "#4fd1c5", accent: "#38b2ac", label: "#4fd1c5" },
  { bg: "#1a2040", wave: "#63b3ed", accent: "#4299e1", label: "#63b3ed" },
  { bg: "#251a40", wave: "#b794f4", accent: "#9f7aea", label: "#b794f4" },
  { bg: "#1a1a40", wave: "#7f9cf5", accent: "#667eea", label: "#7f9cf5" },
  { bg: "#2a1a1a", wave: "#fc8181", accent: "#e53e3e", label: "#fc8181" },
];

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 100);
  return `${m}:${String(sec).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
};

/* ── Level Meter (vertical, segmented) ── */
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

  const segments = 16;
  const lit = Math.round(level * segments);
  return (
    <div className="flex flex-col-reverse gap-[1px] w-[4px]">
      {Array.from({ length: segments }, (_, i) => {
        const isLit = i < lit;
        let color = "#1a1a1a";
        if (isLit) {
          if (i < segments * 0.6) color = "#22c55e";
          else if (i < segments * 0.85) color = "#eab308";
          else color = "#ef4444";
        }
        return <div key={i} style={{ height: 2, backgroundColor: color, opacity: isLit ? 1 : 0.12, borderRadius: 0.5 }} />;
      })}
    </div>
  );
}

/* ── Waveform ── */
function WaveformDisplay({ peaks, color, playheadPct, isActive }: {
  peaks: number[]; color: string; playheadPct?: number; isActive?: boolean;
}) {
  if (peaks.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <span className="text-[8px] text-[#444] italic">Empty</span>
      </div>
    );
  }
  const displayed = peaks.length > 120
    ? Array.from({ length: 120 }, (_, i) => peaks[Math.floor(i * peaks.length / 120)])
    : peaks;

  return (
    <div className="flex items-center h-full w-full gap-[0.5px] px-0.5 relative">
      {displayed.map((peak, i) => {
        const h = Math.max(peak * 85, 3);
        const pct = i / displayed.length * 100;
        const played = playheadPct !== undefined && pct < playheadPct;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-center" style={{ minWidth: 1 }}>
            <div style={{ height: `${h / 2}%`, backgroundColor: color, opacity: played ? 1 : (isActive ? 0.7 : 0.45), borderRadius: "1px 1px 0 0", width: "100%" }} />
            <div style={{ height: `${h / 2}%`, backgroundColor: color, opacity: played ? 0.6 : (isActive ? 0.35 : 0.2), borderRadius: "0 0 1px 1px", width: "100%" }} />
          </div>
        );
      })}
    </div>
  );
}

/* ── Track Lane ── */
function TrackLane({
  name, colorSet, waveform, isActive, isMuted, isSolo,
  isRecordArmed, isRecordingNow, liveWaveform, volume,
  onMute, onSolo, onRecordArm, onClick, onDelete,
  audioActive, trackNumber, playheadPct,
}: {
  name: string;
  colorSet: typeof TRACK_COLORS[0];
  waveform: number[];
  isActive: boolean;
  isMuted: boolean;
  isSolo: boolean;
  isRecordArmed?: boolean;
  isRecordingNow?: boolean;
  liveWaveform?: number[];
  volume: number;
  onMute?: () => void;
  onSolo?: () => void;
  onRecordArm?: () => void;
  onClick?: () => void;
  onDelete?: () => void;
  audioActive: boolean;
  trackNumber: number;
  playheadPct?: number;
}) {
  return (
    <div
      className={`flex border-b border-[#2a2a2a] ${isActive ? "ring-1 ring-inset" : ""}`}
      style={{
        minHeight: 72,
        ...(isActive ? { boxShadow: `inset 0 0 0 1px ${colorSet.accent}40` } : {}),
      }}
      onClick={onClick}
    >
      {/* Track header */}
      <div className="w-[100px] shrink-0 border-r border-[#333] flex flex-col p-1.5 gap-0.5"
        style={{ background: "#2e2e2e" }}>

        <div className="flex items-center gap-1">
          <span className="text-[9px] font-mono text-[#666]">{trackNumber}</span>
          <span className="text-[9px] font-bold truncate flex-1" style={{ color: colorSet.label }}>{name}</span>
          {onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="opacity-30 hover:opacity-100">
              <X className="w-2.5 h-2.5 text-[#888]" />
            </button>
          )}
        </div>

        {/* M / S / R buttons */}
        <div className="flex items-center gap-[3px] mt-0.5">
          <button onClick={(e) => { e.stopPropagation(); onMute?.(); }}
            className={`w-[22px] h-[18px] text-[8px] font-black rounded-[2px] flex items-center justify-center border ${
              isMuted ? "bg-red-600/80 text-white border-red-500" : "bg-[#444] text-[#999] border-[#555]"
            }`}>M</button>
          <button onClick={(e) => { e.stopPropagation(); onSolo?.(); }}
            className={`w-[22px] h-[18px] text-[8px] font-black rounded-[2px] flex items-center justify-center border ${
              isSolo ? "bg-yellow-500/80 text-black border-yellow-400" : "bg-[#444] text-[#999] border-[#555]"
            }`}>S</button>
          {onRecordArm !== undefined && (
            <button onClick={(e) => { e.stopPropagation(); onRecordArm?.(); }}
              className={`w-[18px] h-[18px] rounded-full flex items-center justify-center ${
                isRecordArmed
                  ? isRecordingNow ? "bg-red-500 animate-pulse" : "bg-red-600"
                  : "bg-[#444] border border-[#555]"
              }`}>
              <div className={`w-2 h-2 rounded-full ${isRecordArmed ? "bg-white" : "bg-[#666]"}`} />
            </button>
          )}
        </div>

        {/* Level meters */}
        <div className="flex items-center gap-[2px] mt-auto">
          <LevelMeter active={audioActive && !isMuted} intensity={volume / 100} />
          <LevelMeter active={audioActive && !isMuted} intensity={volume / 120} />
          <span className="text-[7px] font-mono text-[#555] ml-1">{volume}%</span>
        </div>
      </div>

      {/* Waveform area */}
      <div className="flex-1 relative overflow-hidden" style={{ backgroundColor: colorSet.bg }}>
        {isRecordingNow && liveWaveform && liveWaveform.length > 0 ? (
          <div className="flex items-center h-full w-full gap-[0.5px] px-0.5">
            {liveWaveform.map((peak, i) => {
              const h = Math.max(peak * 85, 3);
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-center" style={{ minWidth: 1 }}>
                  <div style={{ height: `${h / 2}%`, backgroundColor: colorSet.wave, opacity: 0.9, borderRadius: "1px 1px 0 0", width: "100%" }} />
                  <div style={{ height: `${h / 2}%`, backgroundColor: colorSet.wave, opacity: 0.5, borderRadius: "0 0 1px 1px", width: "100%" }} />
                </div>
              );
            })}
          </div>
        ) : (
          <WaveformDisplay peaks={waveform} color={colorSet.wave} playheadPct={playheadPct} isActive={isActive || audioActive} />
        )}

        {/* Playhead line on waveform */}
        {playheadPct !== undefined && playheadPct > 0 && (
          <div className="absolute top-0 bottom-0 w-[1.5px] z-10" style={{ left: `${playheadPct}%`, backgroundColor: "#fff", opacity: 0.8 }} />
        )}

        {isMuted && (
          <div className="absolute inset-0 bg-[#1a1a1a]/60 flex items-center justify-center">
            <span className="text-[9px] font-bold text-[#555] uppercase tracking-wider">Muted</span>
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
    masterVolume, setMasterVolume,
    onStartRecording, onStopRecording, onPlayAll, onPlayBeatOnly, onPlayTake,
    onStopPlayback, onPausePlayback, onToggleMute, onToggleSolo,
    onDeleteTake, onSave, savingTake,
    onNavigate, onBack, beatPan, setBeatPan, vocalPan, setVocalPan,
    beatWaveform,
  } = props;

  const [showMixer, setShowMixer] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [armedTrackId, setArmedTrackId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // Arm the first vocal take by default, or "new" for new recording
  useEffect(() => {
    if (!armedTrackId && takes.length === 0) setArmedTrackId("new");
  }, [takes.length]);

  const totalDuration = useMemo(() => {
    const maxTake = Math.max(...takes.map(t => t.duration), 0);
    return Math.max(maxTake, recordTime, playbackDuration, 30);
  }, [takes, recordTime, playbackDuration]);

  const currentTime = isRecording ? recordTime : isPlaying ? playbackTime : 0;
  const playheadPct = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  const isAudioActive = isRecording || isPlaying;

  // Timeline markers
  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    const interval = totalDuration > 180 ? 30 : totalDuration > 60 ? 10 : 5;
    for (let t = 0; t <= totalDuration; t += interval) markers.push(t);
    return markers;
  }, [totalDuration]);

  return (
    <div className="flex flex-col h-full" style={{ background: "#1a1a1a" }}>

      {/* ── TOP BAR ── */}
      <div className="flex items-center gap-1 px-1.5 py-1 border-b border-[#333] shrink-0"
        style={{ background: "linear-gradient(180deg, #3a3a3a 0%, #2e2e2e 100%)" }}>

        <button onClick={onBack} className="p-1 hover:bg-[#555] rounded"><ArrowLeft className="w-3.5 h-3.5 text-[#aaa]" /></button>
        <div className="w-px h-3.5 bg-[#444]" />

        {/* Arrangement view toggle */}
        <button className="p-1 hover:bg-[#555] rounded" title="Track View">
          <LayoutGrid className="w-3.5 h-3.5 text-[#4fd1c5]" />
        </button>

        {/* Play/Pause in top bar */}
        <button
          onClick={isPlaying ? onPausePlayback : onPlayAll}
          disabled={isRecording}
          className="p-1 hover:bg-[#555] rounded disabled:opacity-30"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 text-[#22c55e]" /> : <Play className="w-3.5 h-3.5 text-[#ccc] ml-[1px]" />}
        </button>

        {/* Session name */}
        <span className="text-[10px] font-bold text-[#ccc] truncate flex-1 mx-1">{sessionName}</span>

        {/* Time display */}
        <div className="px-1.5 py-0.5 rounded font-mono text-[10px] tabular-nums border border-[#444]"
          style={{ background: "#111", color: "#e0e0e0" }}>
          {fmt(currentTime)}
        </div>

        {isRecording && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse ml-1" />}

        <button onClick={onSave} className="p-1 hover:bg-[#555] rounded ml-1"><Save className="w-3.5 h-3.5 text-[#aaa]" /></button>
      </div>

      {/* ── TIMELINE RULER ── */}
      <div className="flex h-5 border-b border-[#333] shrink-0" style={{ background: "#222" }}>
        <div className="w-[100px] shrink-0 border-r border-[#333]" />
        <div className="flex-1 relative overflow-hidden">
          {/* Playhead triangle */}
          <div className="absolute top-0 z-20" style={{ left: `${playheadPct}%`, transform: "translateX(-50%)" }}>
            <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "6px solid #4fd1c5" }} />
          </div>

          {/* Loop region highlight */}
          {loopEnabled && (
            <div className="absolute top-0 bottom-0 opacity-15" style={{ left: "10%", width: "30%", backgroundColor: "#eab308" }} />
          )}

          {/* Time markers */}
          {timeMarkers.map(t => (
            <div key={t} className="absolute bottom-0 flex flex-col items-center" style={{ left: `${(t / totalDuration) * 100}%` }}>
              <span className="text-[6px] font-mono text-[#666] leading-none">{Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, "0")}</span>
              <div className="w-px h-1.5 bg-[#444]" />
            </div>
          ))}

          {/* Playhead line */}
          <div className="absolute top-0 bottom-0 w-[1px] z-10" style={{ left: `${playheadPct}%`, backgroundColor: "#4fd1c5" }} />
        </div>
      </div>

      {/* ── TRACK LANES ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">

        {/* Beat Track */}
        {beatUrl && (
          <TrackLane
            name={beatName || "Beat Track"}
            colorSet={TRACK_COLORS[0]}
            waveform={beatWaveform}
            isActive={false}
            isMuted={false}
            isSolo={false}
            volume={beatVolume}
            onMute={() => {}}
            onSolo={() => {}}
            audioActive={isAudioActive}
            trackNumber={1}
            playheadPct={isAudioActive ? playheadPct : undefined}
          />
        )}

        {/* Vocal Takes as tracks */}
        {takes.map((take, idx) => (
          <TrackLane
            key={take.id}
            name={take.name}
            colorSet={TRACK_COLORS[(idx + 1) % TRACK_COLORS.length]}
            waveform={take.waveform}
            isActive={activeTakeId === take.id || selectedClipId === take.id}
            isMuted={take.muted}
            isSolo={take.solo}
            isRecordArmed={armedTrackId === take.id}
            isRecordingNow={isRecording && armedTrackId === take.id}
            liveWaveform={armedTrackId === take.id ? liveWaveform : undefined}
            volume={vocalVolume}
            onMute={() => onToggleMute(take.id)}
            onSolo={() => onToggleSolo(take.id)}
            onRecordArm={() => setArmedTrackId(armedTrackId === take.id ? null : take.id)}
            onClick={() => { setActiveTakeId(take.id); setSelectedClipId(take.id); }}
            onDelete={() => onDeleteTake(take.id)}
            audioActive={isAudioActive && !take.muted}
            trackNumber={idx + 2}
            playheadPct={isAudioActive && !take.muted ? playheadPct : undefined}
          />
        ))}

        {/* Recording placeholder when no takes */}
        {isRecording && takes.length === 0 && (
          <TrackLane
            name="Recording..."
            colorSet={TRACK_COLORS[1]}
            waveform={[]}
            isActive={true}
            isMuted={false}
            isSolo={false}
            isRecordArmed={true}
            isRecordingNow={true}
            liveWaveform={liveWaveform}
            volume={vocalVolume}
            audioActive={true}
            trackNumber={2}
          />
        )}

        {/* Add Track area */}
        <div className="flex" style={{ minHeight: 56 }}>
          <div className="w-[100px] shrink-0 border-r border-[#333] p-2 flex items-center justify-center" style={{ background: "#252525" }}>
            <button
              onClick={onStartRecording}
              disabled={isRecording || savingTake}
              className="w-full border border-dashed border-[#444] rounded-md py-2 flex items-center justify-center gap-1 text-[#555] hover:text-[#4fd1c5] hover:border-[#4fd1c5]/40 transition-colors disabled:opacity-20 text-[10px]"
            >
              <Mic className="w-3 h-3" /> Add Track
            </button>
          </div>
          <div className="flex-1" style={{ background: "#1a1a1a" }} />
        </div>

        {/* Selected clip actions */}
        {selectedClipId && !isRecording && (
          <div className="mx-2 my-1 flex items-center gap-1 p-1.5 rounded-md border border-[#444]" style={{ background: "#2a2a2a" }}>
            <span className="text-[8px] text-[#888] mr-1">Clip:</span>
            <button onClick={() => onNavigate("takes")} className="px-2 py-0.5 rounded text-[8px] font-bold text-[#ccc] bg-[#444] hover:bg-[#555]">Trim</button>
            <button onClick={() => { if (selectedClipId) onDeleteTake(selectedClipId); setSelectedClipId(null); }}
              className="px-2 py-0.5 rounded text-[8px] font-bold text-red-400 bg-[#333] hover:bg-red-500/20">Delete</button>
            <button onClick={() => setSelectedClipId(null)} className="ml-auto"><X className="w-3 h-3 text-[#666]" /></button>
          </div>
        )}

        <div className="h-16" />
      </div>

      {/* ── TRANSPORT BAR ── */}
      <div className="flex items-center justify-between px-2 py-1.5 border-t border-[#444] shrink-0"
        style={{ background: "linear-gradient(180deg, #333 0%, #262626 100%)" }}>

        {/* Left: Transport controls */}
        <div className="flex items-center gap-1.5">
          {/* Rewind */}
          <button onClick={onStopPlayback}
            className="w-8 h-8 rounded-md flex items-center justify-center active:scale-90"
            style={{ background: "#444" }}>
            <SkipBack className="w-3.5 h-3.5 text-[#ccc]" />
          </button>

          {/* Record */}
          <button
            onClick={isRecording ? onStopRecording : onStartRecording}
            disabled={savingTake}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-50"
            style={{
              background: isRecording
                ? "radial-gradient(circle, #ef4444 60%, #dc2626 100%)"
                : "radial-gradient(circle, #666 60%, #555 100%)",
              boxShadow: isRecording ? "0 0 12px #ef444480" : "0 2px 4px #00000040",
            }}>
            {isRecording ? <Square className="w-3.5 h-3.5 text-white" /> : <div className="w-4 h-4 rounded-full bg-red-500" />}
          </button>

          {/* Play/Pause */}
          <button
            onClick={isPlaying ? onPausePlayback : onPlayAll}
            disabled={isRecording}
            className="w-10 h-10 rounded-md flex items-center justify-center transition-all active:scale-90 disabled:opacity-30"
            style={{
              background: isPlaying
                ? "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)"
                : "linear-gradient(180deg, #555 0%, #444 100%)",
            }}>
            {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
          </button>

          {/* Loop */}
          <button onClick={() => setLoopEnabled(!loopEnabled)}
            className="w-7 h-7 rounded-md flex items-center justify-center active:scale-90"
            style={{ background: loopEnabled ? "#ca8a04" : "#444" }}>
            <Repeat className="w-3 h-3" style={{ color: loopEnabled ? "#000" : "#aaa" }} />
          </button>
        </div>

        {/* Center: Undo/Redo/Metronome */}
        <div className="flex items-center gap-1">
          <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#555]" style={{ background: "#3a3a3a" }}>
            <Undo2 className="w-3 h-3 text-[#888]" />
          </button>
          <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#555]" style={{ background: "#3a3a3a" }}>
            <Redo2 className="w-3 h-3 text-[#888]" />
          </button>
          <button onClick={() => setMetronomeEnabled(!metronomeEnabled)}
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#555]"
            style={{ background: metronomeEnabled ? "#4fd1c5" : "#3a3a3a" }}>
            <Headphones className="w-3 h-3" style={{ color: metronomeEnabled ? "#000" : "#888" }} />
          </button>
        </div>

        {/* Right: Mixer / Effects / Export */}
        <div className="flex items-center gap-1">
          <button onClick={() => setShowMixer(true)}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#555]"
            style={{ background: "#444" }}>
            <Sliders className="w-3.5 h-3.5 text-[#aaa]" />
          </button>
          <button onClick={() => onNavigate("effects")}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#555]"
            style={{ background: "#444" }}>
            <AudioWaveform className="w-3.5 h-3.5 text-[#aaa]" />
          </button>
          <button onClick={() => onNavigate("export")}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#555]"
            style={{ background: "#444" }}>
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
        masterVolume={masterVolume}
        setMasterVolume={setMasterVolume}
        onToggleMute={onToggleMute}
        onToggleSolo={onToggleSolo}
        isAudioActive={isAudioActive}
        onPlayAll={onPlayAll}
        onStopPlayback={onStopPlayback}
      />
    </div>
  );
}
