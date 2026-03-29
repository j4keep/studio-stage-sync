import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowLeft, Play, Pause, SkipBack, SkipForward, Repeat,
  Mic, Music, Plus, X, MoreHorizontal, Scissors, Move, ChevronRight,
  Square, Circle, Volume2, Upload, RefreshCw, Settings, Sliders,
  Maximize2, MousePointer, ZoomIn, ZoomOut, Trash2
} from "lucide-react";

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
  volume: number;
  pan: number;
}

interface DAWScreenProps {
  sessionName: string;
  beatName: string | null;
  beatUrl: string | null;
  beatWaveform: number[];
  takes: TakeLocal[];
  activeTakeId: string | null;
  isRecording: boolean;
  isPlaying: boolean;
  recordTime: number;
  playbackTime: number;
  playbackDuration: number;
  liveWaveform: number[];
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPlayAll: (loop?: boolean) => void;
  onStopPlayback: () => void;
  onSeekPlayback?: (time: number) => void;
  onBack: () => void;
  onAddTrack?: () => void;
  onDeleteTake?: (id: string) => void;
  onImportAudio?: () => void;
  bpm: number;
  onBpmChange: (bpm: number) => void;
  gridMode: "Measure" | "Beat" | "Free";
  onGridModeChange: (mode: "Measure" | "Beat" | "Free") => void;
  musicalKey: string;
  onMusicalKeyChange: (key: string) => void;
  loopEnabled: boolean;
  onLoopEnabledChange: (enabled: boolean) => void;
  loopStart: number | null;
  loopEnd: number | null;
  onLoopRangeChange: (start: number | null, end: number | null) => void;
}

/* ── Time formatting ── */
function formatBarBeatTick(s: number, bpm = 120) {
  const beatsPerSec = bpm / 60;
  const totalBeats = s * beatsPerSec;
  const bar = Math.floor(totalBeats / 4) + 1;
  const beat = Math.floor(totalBeats % 4) + 1;
  const tick = Math.floor((totalBeats % 1) * 1000);
  return `${bar}:${beat}:${String(tick).padStart(3, "0")}`;
}

/* ── Track Waveform ── */
function TrackWaveform({ peaks, color, playPct, height, clipStart = 0, clipEnd = 100 }: {
  peaks: number[]; color: string; playPct?: number; height: number; clipStart?: number; clipEnd?: number;
}) {
  if (peaks.length === 0) return (
    <div className="h-full w-full flex items-center justify-center">
      <span className="text-[10px] text-[#555] italic">Empty track</span>
    </div>
  );
  const startIdx = Math.floor((clipStart / 100) * peaks.length);
  const endIdx = Math.floor((clipEnd / 100) * peaks.length);
  const slice = peaks.slice(startIdx, endIdx);
  const displayed = slice.length > 200
    ? Array.from({ length: 200 }, (_, i) => slice[Math.floor(i * slice.length / 200)])
    : slice;
  const playIdx = playPct !== undefined ? Math.floor((playPct / 100) * displayed.length) : -1;

  return (
    <div className="flex items-center h-full w-full gap-[0.3px] px-0.5 relative" style={{ height }}>
      {displayed.map((peak, i) => {
        const h = Math.max(peak * 90, 2);
        const past = playIdx >= 0 && i <= playIdx;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-center" style={{ minWidth: 1 }}>
            <div style={{ height: `${h / 2}%`, background: color, opacity: past ? 1 : 0.6, borderRadius: "1px 1px 0 0", width: "100%" }} />
            <div style={{ height: `${h / 2}%`, background: color, opacity: past ? 0.7 : 0.25, borderRadius: "0 0 1px 1px", width: "100%" }} />
          </div>
        );
      })}
    </div>
  );
}

/* ── Level Meter (bottom bar) ── */
function BottomLevelMeter({ active, label }: { active: boolean; label: string }) {
  const [level, setLevel] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!active) { setLevel(0); return; }
    const run = () => {
      setLevel(prev => prev + (Math.random() * 0.5 + 0.3 - prev) * 0.2);
      raf.current = requestAnimationFrame(run);
    };
    raf.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf.current);
  }, [active]);

  return (
    <div className="flex items-center gap-1 flex-1">
      <span className="text-[7px] font-mono text-[#888] w-5">{label}</span>
      <div className="flex-1 h-3 rounded-sm overflow-hidden" style={{ background: "#0a0a1a" }}>
        <div className="h-full rounded-sm transition-all" style={{
          width: `${level * 100}%`,
          background: level > 0.8 ? "linear-gradient(90deg, #22c55e, #eab308, #ef4444)" :
            level > 0.5 ? "linear-gradient(90deg, #22c55e, #eab308)" : "#22c55e",
        }} />
      </div>
      <span className="text-[7px] font-mono text-[#666] w-6 text-right">
        {active ? `${(-50 + level * 50).toFixed(0)}` : "-∞"}
      </span>
    </div>
  );
}

/* ── Add Track Menu ── */
function AddTrackMenu({ onClose, onRecord, onImport }: {
  onClose: () => void; onRecord: () => void; onImport?: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}>
      <div className="rounded-2xl border border-[#444] p-4 w-[280px] space-y-1"
        style={{ background: "#1e1e30" }}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-white mb-3">Add new track</h3>
        {[
          { icon: Mic, label: "Record audio", color: "#63b3ed", desc: "Record vocals or instruments", action: () => { onRecord(); onClose(); } },
          { icon: Upload, label: "Import audio file", color: "#22c55e", desc: "Import WAV, MP3, OGG, etc.", action: () => { onImport?.(); onClose(); } },
          { icon: RefreshCw, label: "Use Loops", color: "#f59e0b", desc: "Browse loop library", action: onClose },
          { icon: Music, label: "Instrument", color: "#a855f7", desc: "Virtual instrument track", action: onClose },
        ].map(item => (
          <button key={item.label} onClick={item.action}
            className="w-full flex items-center gap-3 p-3 rounded-xl active:scale-[0.98] transition-transform hover:bg-[#2a2a3e]">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${item.color}22` }}>
              <item.icon className="w-5 h-5" style={{ color: item.color }} />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">{item.label}</p>
              <p className="text-[10px] text-[#888]">{item.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Track Header ── */
function TrackHeader({ name, color, icon: Icon, muted, solo, armed, onMute, onSolo, onArm, onMore }: {
  name: string; color: string; icon: any; muted: boolean; solo: boolean; armed?: boolean;
  onMute?: () => void; onSolo?: () => void; onArm?: () => void; onMore?: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[#222]" style={{ background: `${color}15` }}>
      <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: `${color}33` }}>
        <Icon className="w-3 h-3" style={{ color }} />
      </div>
      <span className="text-[10px] font-bold text-white flex-1 truncate">{name}</span>
      <button onClick={onMute}
        className="px-1.5 py-0.5 rounded text-[8px] font-black"
        style={{ background: muted ? "#ef4444" : "#2a2a3e", color: muted ? "#fff" : "#888", border: `1px solid ${muted ? "#ef4444" : "#333"}` }}>
        M
      </button>
      <button onClick={onSolo}
        className="px-1.5 py-0.5 rounded text-[8px] font-black"
        style={{ background: solo ? "#eab308" : "#2a2a3e", color: solo ? "#000" : "#888", border: `1px solid ${solo ? "#eab308" : "#333"}` }}>
        S
      </button>
      {onArm && (
        <button onClick={onArm}
          className="w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: armed ? "#ef4444" : "#333", border: "1px solid #555" }}>
          <div className="w-2 h-2 rounded-full" style={{ background: armed ? "#fff" : "#666" }} />
        </button>
      )}
      <button onClick={onMore} className="p-0.5"><MoreHorizontal className="w-3.5 h-3.5 text-[#555]" /></button>
    </div>
  );
}

export default function DAWScreen(props: DAWScreenProps) {
  const {
    sessionName, beatName, beatUrl, beatWaveform, takes,
    isRecording, isPlaying, recordTime, playbackTime, playbackDuration,
    liveWaveform,
    onStartRecording, onStopRecording, onPlayAll, onStopPlayback, onSeekPlayback, onBack,
    onAddTrack, onDeleteTake, onImportAudio,
    bpm, onBpmChange,
    gridMode, onGridModeChange,
    musicalKey, onMusicalKeyChange,
    loopEnabled, onLoopEnabledChange,
    loopStart, loopEnd, onLoopRangeChange,
  } = props;

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
   const [isDraggingLoop, setIsDraggingLoop] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const currentTime = isRecording ? recordTime : playbackTime;
  const totalDuration = Math.max(...takes.map(t => t.duration), playbackDuration, 30);
  const playPct = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  const keyOptions = ["/", "C", "Dm", "Em", "F", "G", "Am", "Bb"];

  const getTimeFromClientX = useCallback((clientX: number) => {
    const el = timelineRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return pct * totalDuration;
  }, [totalDuration]);

  // Timeline scrubbing
  const handleTimelineScrub = useCallback((clientX: number) => {
    onSeekPlayback?.(getTimeFromClientX(clientX));
  }, [getTimeFromClientX, onSeekPlayback]);

  useEffect(() => {
    if (!isDraggingLoop) return;
    const handleMove = (e: PointerEvent) => {
      const next = getTimeFromClientX(e.clientX);
      const start = loopStart ?? next;
      onLoopRangeChange(Math.min(start, next), Math.max(start, next));
    };
    const handleUp = () => setIsDraggingLoop(false);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [getTimeFromClientX, isDraggingLoop, loopStart, onLoopRangeChange]);

  const handleRecord = () => {
    if (isRecording) onStopRecording();
    else onStartRecording();
  };

  const handlePlay = () => {
    if (isPlaying) onStopPlayback();
    else onPlayAll(loopEnabled);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {showAddMenu && (
        <AddTrackMenu
          onClose={() => setShowAddMenu(false)}
          onRecord={() => onAddTrack?.()}
          onImport={onImportAudio}
        />
      )}

      {/* ── Top toolbar ── */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#333]"
        style={{ background: "#1a1a2e" }}>
        <div className="flex items-center gap-1">
          <button onClick={onBack} className="p-1">
            <ArrowLeft className="w-4 h-4 text-[#888]" />
          </button>
          <span className="text-[10px] text-[#555] truncate max-w-[80px]">{sessionName}</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="px-2 py-1 rounded text-[8px] font-bold border border-[#444] text-[#888]"
            style={{ background: "#2a2a3e" }}>
            <span className="text-[#f59e0b]">ADD EFX</span>
          </button>
          <button className="px-2 py-1 rounded text-[8px] font-bold border border-[#444] text-[#888]"
            style={{ background: "#2a2a3e" }}>
            <span className="text-[#63b3ed]">EQ</span>
          </button>
          <button onClick={() => setShowAddMenu(true)}
            className="p-1 rounded" style={{ background: "#2a2a3e" }}>
            <Plus className="w-4 h-4 text-[#63b3ed]" />
          </button>
        </div>
      </div>

      {/* ── Track headers + waveform area ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-[52px] shrink-0 flex flex-col border-r border-[#333]" style={{ background: "#151525" }}>
          {/* Transport buttons */}
          <div className="flex flex-col items-center gap-1 py-2 border-b border-[#333]">
            <button onClick={handleRecord}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: isRecording ? "#ef4444" : "#2a1a1a",
                border: `1px solid ${isRecording ? "#ef4444" : "#444"}`,
              }}>
              <Circle className={`w-4 h-4 ${isRecording ? "text-white fill-white" : "text-[#ef4444]"}`} />
            </button>
            <button onClick={handlePlay}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: isPlaying ? "#22c55e" : "#1a2a1a",
                border: `1px solid ${isPlaying ? "#22c55e" : "#444"}`,
              }}>
              {isPlaying ? <Square className="w-3.5 h-3.5 text-white fill-white" />
                : <Play className="w-4 h-4 text-[#22c55e] ml-0.5" />}
            </button>
            <button className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#444]"
              style={{ background: "#2a2a3e" }}>
              <SkipBack className="w-3.5 h-3.5 text-[#888]" />
            </button>
              <button onClick={() => onLoopEnabledChange(!loopEnabled)}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#444]"
                style={{ background: loopEnabled ? "#2a3a5a" : "#2a2a3e" }}>
                <Repeat className={`w-3.5 h-3.5 ${loopEnabled ? "text-[#63b3ed]" : "text-[#888]"}`} />
            </button>
          </div>

          {/* Time counter */}
          <div className="py-2 px-1 border-b border-[#333] text-center">
            <div className="text-[11px] font-mono font-bold" style={{ color: isRecording ? "#ef4444" : "#22c55e" }}>
              {formatBarBeatTick(currentTime, bpm)}
            </div>
          </div>

          {/* Grid/BPM/Key */}
          <div className="flex flex-col gap-1 py-2 px-1 text-center border-b border-[#333]">
            <div>
              <span className="text-[7px] text-[#888]">Start</span>
              <span className="text-[8px] font-mono text-[#ccc] block">1:1:000</span>
            </div>
            <div>
              <span className="text-[7px] text-[#888]">End</span>
              <span className="text-[8px] font-mono text-[#ccc] block">{formatBarBeatTick(totalDuration, bpm)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 py-2 px-1 text-center border-b border-[#333]">
            <div>
              <span className="text-[7px] text-[#888]">Grid</span>
              <button onClick={() => onGridModeChange(gridMode === "Measure" ? "Beat" : gridMode === "Beat" ? "Free" : "Measure")}
                className="text-[8px] font-bold block w-full" style={{ color: "#63b3ed" }}>
                {gridMode}
              </button>
            </div>
            <div>
              <span className="text-[7px] text-[#888]">Bpm</span>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <button onClick={() => onBpmChange(Math.max(60, bpm - 1))} className="text-[8px] text-[#888]">-</button>
                <span className="text-[8px] font-mono text-[#ccc] block min-w-7">{bpm}</span>
                <button onClick={() => onBpmChange(Math.min(220, bpm + 1))} className="text-[8px] text-[#888]">+</button>
              </div>
            </div>
            <div>
              <span className="text-[7px] text-[#888]">Key</span>
              <button
                onClick={() => onMusicalKeyChange(keyOptions[(keyOptions.indexOf(musicalKey) + 1) % keyOptions.length])}
                className="text-[8px] font-mono text-[#ccc] block w-full"
              >
                {musicalKey}
              </button>
            </div>
          </div>

          {/* Tool icons */}
          <div className="flex flex-col items-center gap-1 py-2 flex-1">
            <button className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "#2a2a3e" }}>
              <MousePointer className="w-3 h-3 text-[#63b3ed]" />
            </button>
            <button className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "#1a1a2e" }}>
              <Scissors className="w-3 h-3 text-[#888]" />
            </button>
            <button className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "#1a1a2e" }}>
              <Move className="w-3 h-3 text-[#888]" />
            </button>
          </div>
        </div>

        {/* Main timeline area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Track headers row (horizontal scroll matching tracks) */}
          <div className="shrink-0 border-b border-[#333] overflow-x-auto" style={{ background: "#1a1a2e" }}>
            <div className="flex" style={{ minWidth: "fit-content" }}>
              {/* Beat track header */}
              {beatUrl && (
                <div className="w-[140px] shrink-0 border-r border-[#333]">
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "#2a4a5a" }}>
                      <Music className="w-3 h-3 text-[#4fd1c5]" />
                    </div>
                    <span className="text-[9px] font-bold text-white truncate flex-1">1: {beatName || "Beat"}</span>
                    <button className="px-1 py-0.5 rounded text-[7px] font-black"
                      style={{ background: "#2a2a3e", color: "#888", border: "1px solid #333" }}>M</button>
                    <button className="px-1 py-0.5 rounded text-[7px] font-black"
                      style={{ background: "#2a2a3e", color: "#888", border: "1px solid #333" }}>S</button>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 border-t border-[#222]">
                    <span className="text-[7px] text-[#555]">Multi-Output Device</span>
                  </div>
                </div>
              )}
              {/* Take track headers */}
              {takes.map((take, idx) => (
                <div key={take.id} className={`w-[140px] shrink-0 border-r border-[#333] ${selectedTrack === take.id ? "ring-1 ring-[#63b3ed]" : ""}`}
                  onClick={() => setSelectedTrack(take.id)}>
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "#3a2a5a" }}>
                      <Mic className="w-3 h-3 text-[#b794f4]" />
                    </div>
                    <span className="text-[9px] font-bold text-white truncate flex-1">{idx + 2}: {take.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); /* toggle mute */ }}
                      className="px-1 py-0.5 rounded text-[7px] font-black"
                      style={{ background: take.muted ? "#ef4444" : "#2a2a3e", color: take.muted ? "#fff" : "#888", border: `1px solid ${take.muted ? "#ef4444" : "#333"}` }}>
                      M
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); /* toggle solo */ }}
                      className="px-1 py-0.5 rounded text-[7px] font-black"
                      style={{ background: take.solo ? "#eab308" : "#2a2a3e", color: take.solo ? "#000" : "#888", border: `1px solid ${take.solo ? "#eab308" : "#333"}` }}>
                      S
                    </button>
                    <div className="w-3 h-3 rounded-full flex items-center justify-center"
                      style={{ background: "#ef4444", border: "1px solid #ff6666" }}>
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 border-t border-[#222]">
                    <span className="text-[7px] text-[#555]">Mono • Audio</span>
                    {onDeleteTake && (
                      <button onClick={(e) => { e.stopPropagation(); onDeleteTake(take.id); }}
                        className="ml-auto p-0.5">
                        <Trash2 className="w-2.5 h-2.5 text-[#555]" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {/* Recording track header */}
              {isRecording && (
                <div className="w-[140px] shrink-0 border-r border-[#333]" style={{ background: "#2e1a1a" }}>
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <div className="w-5 h-5 rounded flex items-center justify-center bg-red-900/50">
                      <Mic className="w-3 h-3 text-red-400 animate-pulse" />
                    </div>
                    <span className="text-[9px] font-bold text-red-300 flex-1">Recording...</span>
                  </div>
                  <div className="flex items-center px-2 py-0.5 border-t border-[#222]">
                    <span className="text-[7px] text-red-400 font-mono">{formatBarBeatTick(recordTime, bpm)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timeline ruler */}
          <div ref={timelineRef}
            className="h-5 border-b border-[#333] relative overflow-hidden shrink-0 touch-none"
            style={{ background: "#151525" }}
            onPointerDown={(e) => {
              if (loopEnabled) {
                const next = getTimeFromClientX(e.clientX);
                onLoopRangeChange(next, next);
                setIsDraggingLoop(true);
                return;
              }
              handleTimelineScrub(e.clientX);
            }}>
            {Array.from({ length: Math.ceil(totalDuration / (gridMode === "Measure" ? 2 : gridMode === "Beat" ? 1 : 5)) + 1 }, (_, i) => {
              const step = gridMode === "Measure" ? 2 : gridMode === "Beat" ? 1 : 5;
              const t = i * step;
              return (
                <div key={i} className="absolute bottom-0 flex flex-col items-center"
                  style={{ left: `${(t / totalDuration) * 100}%` }}>
                  <span className="text-[6px] font-mono text-[#555]">{t}s</span>
                  <div className="w-px h-1.5 bg-[#444]" />
                </div>
              );
            })}
            {/* Loop region */}
            {loopEnabled && loopStart !== null && loopEnd !== null && (
              <div className="absolute top-0 bottom-0 z-5"
                style={{
                  left: `${(loopStart / totalDuration) * 100}%`,
                  width: `${((loopEnd - loopStart) / totalDuration) * 100}%`,
                  background: "#63b3ed20",
                  borderLeft: "2px solid #63b3ed",
                  borderRight: "2px solid #63b3ed",
                }} />
            )}
            {loopEnabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (loopStart === null || loopEnd === null) {
                    onLoopRangeChange(0, Math.min(totalDuration, 8));
                  } else {
                    onLoopRangeChange(null, null);
                  }
                }}
                className="absolute right-1 top-0.5 text-[7px] px-1 py-0.5 rounded border border-[#335] text-[#63b3ed]"
                style={{ background: "#1a1a2e" }}
              >
                {loopStart === null || loopEnd === null ? "SET LOOP" : "CLEAR"}
              </button>
            )}
            {/* Playhead */}
            <div className="absolute top-0 bottom-0 w-[2px] z-10"
              style={{ left: `${playPct}%`, background: "#ef4444", boxShadow: "0 0 6px #ef4444" }}>
              <div className="w-2 h-2 rounded-full bg-red-500 absolute -top-0.5 -left-[3px]"
                style={{ boxShadow: "0 0 4px #ef4444" }} />
            </div>
          </div>

          {/* Waveform lanes (scrollable) */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ background: "#0d1520" }}>
            {/* Beat waveform lane */}
            {beatUrl && (
              <div className="border-b border-[#333] relative" style={{ height: 80 }}>
                <TrackWaveform peaks={beatWaveform} color="#63b3ed" playPct={isPlaying ? playPct : undefined} height={80} />
                {/* Playhead line */}
                <div className="absolute top-0 bottom-0 w-[2px] pointer-events-none z-10"
                  style={{ left: `${playPct}%`, background: "#ef4444", boxShadow: "0 0 4px #ef4444" }} />
              </div>
            )}

            {/* Take waveform lanes */}
            {takes.map((take) => (
              <div key={take.id}
                className={`border-b border-[#333] relative ${selectedTrack === take.id ? "ring-1 ring-inset ring-[#63b3ed]" : ""}`}
                style={{ height: 64, background: selectedTrack === take.id ? "#1a1535" : "#180d22" }}
                onClick={() => setSelectedTrack(take.id)}>
                <TrackWaveform
                  peaks={take.waveform}
                  color="#b794f4"
                  playPct={isPlaying && !take.muted ? playPct : undefined}
                  height={64}
                  clipStart={take.trimStart}
                  clipEnd={take.trimEnd}
                />
                {/* Clip label */}
                <div className="absolute top-0.5 left-1 text-[7px] font-mono text-[#b794f4] opacity-60 pointer-events-none">
                  {take.name}
                </div>
                {/* Playhead */}
                <div className="absolute top-0 bottom-0 w-[2px] pointer-events-none z-10"
                  style={{ left: `${playPct}%`, background: "#ef4444", boxShadow: "0 0 4px #ef4444" }} />
              </div>
            ))}

            {/* Live recording waveform */}
            {isRecording && liveWaveform.length > 0 && (
              <div className="border-b border-[#333] relative" style={{ height: 64, background: "#200d0d" }}>
                <TrackWaveform peaks={liveWaveform} color="#ef4444" height={64} />
              </div>
            )}

            {!beatUrl && takes.length === 0 && !isRecording && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Music className="w-10 h-10 text-[#333]" />
                <p className="text-sm text-[#555]">Tap + to add tracks</p>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar tools */}
        <div className="w-[36px] shrink-0 flex flex-col items-center gap-1 py-2 border-l border-[#333]"
          style={{ background: "#151525" }}>
          <button className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "#2a2a3e" }}>
            <Sliders className="w-3 h-3 text-[#888]" />
          </button>
          <button className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "#1a1a2e" }}>
            <Settings className="w-3 h-3 text-[#888]" />
          </button>
          <button className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "#1a1a2e" }}>
            <Maximize2 className="w-3 h-3 text-[#888]" />
          </button>
          <button className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "#1a1a2e" }}>
            <ZoomIn className="w-3 h-3 text-[#888]" />
          </button>
          <button className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "#1a1a2e" }}>
            <ZoomOut className="w-3 h-3 text-[#888]" />
          </button>
        </div>
      </div>

      {/* ── Bottom level meters ── */}
      <div className="shrink-0 border-t border-[#333] px-2 py-1.5 space-y-0.5"
        style={{ background: "#0d0d1a" }}>
        <BottomLevelMeter active={isRecording || isPlaying} label="Peak" />
        <BottomLevelMeter active={isRecording || isPlaying} label="Sum" />
      </div>
    </div>
  );
}
