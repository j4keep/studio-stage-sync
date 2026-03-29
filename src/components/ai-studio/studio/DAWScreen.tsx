import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowLeft, Play, Pause, SkipBack, SkipForward, Repeat,
  Mic, Music, Plus, X, MoreHorizontal, Scissors, Move, ChevronRight
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
  onBack: () => void;
  onAddTrack?: () => void;
  onDeleteTake?: (id: string) => void;
}

function formatTime(s: number) {
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const sec = String(Math.floor(s % 60)).padStart(2, "0");
  const ms = String(Math.floor((s % 1) * 10));
  return `${m}:${sec}.${ms}`;
}

function formatRemaining(current: number, total: number) {
  const remaining = Math.max(0, total - current);
  return `-${formatTime(remaining)}`;
}

/* ── Multitrack Waveform ── */
function TrackWaveform({ peaks, color, playPct, height }: { peaks: number[]; color: string; playPct?: number; height: number }) {
  if (peaks.length === 0) return (
    <div className="h-full w-full flex items-center justify-center">
      <span className="text-[10px] text-[#555] italic">Empty track</span>
    </div>
  );
  const displayed = peaks.length > 120
    ? Array.from({ length: 120 }, (_, i) => peaks[Math.floor(i * peaks.length / 120)])
    : peaks;
  const playIdx = playPct !== undefined ? Math.floor((playPct / 100) * displayed.length) : -1;

  return (
    <div className="flex items-center h-full w-full gap-[0.3px] px-0.5 relative" style={{ height }}>
      {displayed.map((peak, i) => {
        const h = Math.max(peak * 90, 2);
        const past = playIdx >= 0 && i <= playIdx;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-center" style={{ minWidth: 1 }}>
            <div style={{ height: `${h / 2}%`, background: color, opacity: past ? 1 : 0.55, borderRadius: "1px 1px 0 0", width: "100%" }} />
            <div style={{ height: `${h / 2}%`, background: color, opacity: past ? 0.7 : 0.25, borderRadius: "0 0 1px 1px", width: "100%" }} />
          </div>
        );
      })}
      {/* Red playhead line */}
      {playIdx >= 0 && (
        <div className="absolute top-0 bottom-0 w-[2px] pointer-events-none z-10"
          style={{ left: `${(playIdx / displayed.length) * 100}%`, background: "#ff4444", boxShadow: "0 0 8px #ff4444" }} />
      )}
    </div>
  );
}

/* ── VU Meter (vertical LED) ── */
function VUMeter({ active, color }: { active: boolean; color?: string }) {
  const [level, setLevel] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (!active) { setLevel(0); return; }
    const run = () => {
      setLevel(prev => prev + (Math.random() * 0.4 + 0.3 - prev) * 0.3);
      raf.current = requestAnimationFrame(run);
    };
    raf.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf.current);
  }, [active]);

  return (
    <div className="flex flex-col-reverse gap-[0.5px] w-[8px]" style={{ height: 80 }}>
      {Array.from({ length: 20 }, (_, i) => {
        const lit = i < Math.round(level * 20);
        const c = lit
          ? (color || (i < 12 ? "#22c55e" : i < 17 ? "#eab308" : "#ef4444"))
          : "#1a1a2e";
        return <div key={i} style={{ flex: 1, borderRadius: 0.5, background: c, opacity: lit ? 1 : 0.12 }} />;
      })}
    </div>
  );
}

export default function DAWScreen(props: DAWScreenProps) {
  const {
    sessionName, beatName, beatUrl, beatWaveform, takes,
    isRecording, isPlaying, recordTime, playbackTime, playbackDuration,
    liveWaveform,
    onStartRecording, onStopRecording, onPlayAll, onStopPlayback, onBack,
    onAddTrack, onDeleteTake,
  } = props;

  const [loopOn, setLoopOn] = useState(false);
  const currentTime = isRecording ? recordTime : playbackTime;
  const totalDuration = Math.max(...takes.map(t => t.duration), playbackDuration, 30);
  const playPct = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  const handleRecord = () => {
    if (isRecording) onStopRecording();
    else onStartRecording();
  };

  const handlePlay = () => {
    if (isPlaying) onStopPlayback();
    else onPlayAll(loopOn);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ── Top bar: back + timer ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#333]"
        style={{ background: "#1a1a2e" }}>
        <button onClick={onBack} className="flex items-center gap-1 p-1">
          <ArrowLeft className="w-5 h-5 text-[#888]" />
          <span className="text-xs text-[#666]">-</span>
        </button>
        <div className="flex items-center gap-4">
          <span className="text-2xl font-mono font-bold text-white tracking-wider">
            {formatTime(currentTime)}
          </span>
          <span className="text-sm font-mono text-[#666]">
            {formatRemaining(currentTime, totalDuration)}
          </span>
        </div>
        <div className="w-8" />
      </div>

      {/* ── Timeline ruler with red playhead ── */}
      <div className="h-6 border-b border-[#333] relative overflow-hidden" style={{ background: "#151525" }}>
        {Array.from({ length: Math.ceil(totalDuration / 5) + 1 }, (_, i) => {
          const t = i * 5;
          return (
            <div key={i} className="absolute bottom-0 flex flex-col items-center"
              style={{ left: `${(t / totalDuration) * 100}%` }}>
              <span className="text-[7px] font-mono text-[#555]">{t}s</span>
              <div className="w-px h-2 bg-[#444]" />
            </div>
          );
        })}
        {/* Playhead marker */}
        <div className="absolute top-0 bottom-0 w-[2px] z-10"
          style={{ left: `${playPct}%`, background: "#ef4444", boxShadow: "0 0 8px #ef4444" }}>
          <div className="w-3 h-3 rounded-full bg-red-500 absolute -top-0.5 -left-[5px]" 
            style={{ boxShadow: "0 0 6px #ef4444" }} />
        </div>
      </div>

      {/* ── Full-width master waveform (overview) ── */}
      <div className="h-16 border-b border-[#333]" style={{ background: "#0d1520" }}>
        <TrackWaveform
          peaks={beatWaveform.length > 0 ? beatWaveform : Array.from({ length: 100 }, () => 0.1)}
          color="#63b3ed"
          playPct={isPlaying || isRecording ? playPct : undefined}
          height={64}
        />
      </div>

      {/* ── Track lanes (scrollable) ── */}
      <div className="flex-1 overflow-y-auto" style={{ background: "#111122" }}>
        {/* Beat Track */}
        <div className="border-b border-[#333]">
          <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: "#1a2a3a" }}>
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: "#2a4a5a" }}>
              <Music className="w-3.5 h-3.5 text-[#4fd1c5]" />
            </div>
            <span className="text-xs font-bold text-white flex-1">Beat Track</span>
            <button className="p-0.5"><MoreHorizontal className="w-4 h-4 text-[#555]" /></button>
          </div>
          <div className="h-20 relative" style={{ background: "#0d1822" }}>
            <TrackWaveform peaks={beatWaveform} color="#63b3ed" playPct={isPlaying ? playPct : undefined} height={80} />
          </div>
        </div>

        {/* Vocal / Take Tracks */}
        {takes.map((take, idx) => (
          <div key={take.id} className="border-b border-[#333]">
            <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: "#2a1a3a" }}>
              <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: "#3a2a5a" }}>
                <Mic className="w-3.5 h-3.5 text-[#b794f4]" />
              </div>
              <span className="text-[10px] text-[#b794f4]">◇</span>
              <span className="text-xs font-bold text-white flex-1">{take.name}</span>
              {/* Track controls */}
              <button className="p-0.5" title="Trim/Edit">
                <Scissors className="w-3.5 h-3.5 text-[#666]" />
              </button>
              <button className="p-0.5"><MoreHorizontal className="w-4 h-4 text-[#555]" /></button>
            </div>
            <div className="h-16 relative" style={{ background: "#180d22" }}>
              <TrackWaveform peaks={take.waveform} color="#b794f4" playPct={isPlaying && !take.muted ? playPct : undefined} height={64} />
            </div>
          </div>
        ))}

        {/* Live recording waveform */}
        {isRecording && liveWaveform.length > 0 && (
          <div className="border-b border-[#333]">
            <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: "#2e1a1a" }}>
              <div className="w-6 h-6 rounded flex items-center justify-center bg-red-900/50">
                <Mic className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              </div>
              <span className="text-xs font-bold text-red-300 flex-1">Recording...</span>
              <span className="text-[10px] text-red-400 font-mono">{formatTime(recordTime)}</span>
            </div>
            <div className="h-16" style={{ background: "#200d0d" }}>
              <TrackWaveform peaks={liveWaveform} color="#ef4444" height={64} />
            </div>
          </div>
        )}

        {!beatUrl && takes.length === 0 && !isRecording && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Music className="w-10 h-10 text-[#333]" />
            <p className="text-sm text-[#555]">Upload a beat & start recording</p>
          </div>
        )}
      </div>

      {/* ── Transport bar ── */}
      <div className="border-t border-[#333]" style={{ background: "#1a1a2e" }}>
        {/* Transport controls row */}
        <div className="flex items-center justify-center gap-4 px-4 py-2 border-b border-[#222]"
          style={{ background: "#222238" }}>
          <button onClick={() => setLoopOn(!loopOn)} className="p-1.5 rounded-lg" style={{ background: loopOn ? "#2a3a5a" : "transparent" }}>
            <Repeat className={`w-4 h-4 ${loopOn ? "text-[#63b3ed]" : "text-[#555]"}`} />
          </button>
          <button className="p-1.5 rounded-lg" style={{ background: "#2a2a3e" }}>
            <div className="w-4 h-0.5 bg-[#888] rounded" />
          </button>
          <button className="p-1.5"><SkipBack className="w-4 h-4 text-[#888]" /></button>
          <button onClick={handlePlay}
            className="p-1.5 rounded-lg" style={{ background: "#2a2a3e" }}>
            {isPlaying
              ? <Pause className="w-5 h-5 text-white" />
              : <Play className="w-5 h-5 text-white ml-0.5" />}
          </button>
          <button className="p-1.5"><SkipForward className="w-4 h-4 text-[#888]" /></button>
          <button className="p-1.5"><ChevronRight className="w-4 h-4 text-[#555]" /></button>
        </div>

        {/* Record button row with VU meters */}
        <div className="flex items-center justify-center gap-3 px-4 py-3">
          {/* Add track button */}
          <button
            onClick={onAddTrack}
            className="w-9 h-9 rounded-full border border-[#444] flex items-center justify-center"
            style={{ background: "#2a2a3e" }}
          >
            <Plus className="w-4 h-4 text-[#888]" />
          </button>

          {/* Left VU meters */}
          <div className="flex gap-[2px]">
            <VUMeter active={isRecording || isPlaying} color="#22c55e" />
            <VUMeter active={isRecording || isPlaying} color="#63b3ed" />
          </div>

          {/* Record button */}
          <button
            onClick={handleRecord}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              isRecording ? "animate-pulse" : ""
            }`}
            style={{
              background: isRecording
                ? "radial-gradient(circle, #ff2222 40%, #cc0000 100%)"
                : "radial-gradient(circle, #ff4444 30%, #991111 70%, #661111 100%)",
              boxShadow: isRecording
                ? "0 0 30px #ff000080, inset 0 0 15px #ffffff30"
                : "0 0 15px #ff000040, inset 0 0 10px #ffffff20",
              border: "3px solid #88333380",
            }}
          >
            <div className={`w-5 h-5 rounded-full ${isRecording ? "bg-white" : "bg-white/80"}`}
              style={{ boxShadow: "0 0 10px #ffffff60" }} />
          </button>

          {/* Right VU meters */}
          <div className="flex gap-[2px]">
            <VUMeter active={isRecording || isPlaying} color="#63b3ed" />
            <VUMeter active={isRecording || isPlaying} color="#22c55e" />
          </div>

          {/* Delete/Cancel button */}
          <button
            className="w-9 h-9 rounded-full border border-[#444] flex items-center justify-center"
            style={{ background: "#2a2a3e" }}
          >
            <X className="w-4 h-4 text-[#888]" />
          </button>
        </div>
      </div>
    </div>
  );
}
