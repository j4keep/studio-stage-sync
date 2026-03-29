import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ArrowLeft, Play, Pause, SkipBack, SkipForward, Repeat,
  Mic, Music, Plus, X, MoreHorizontal
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

/* ── Waveform ── */
function Waveform({ peaks, color, playPct }: { peaks: number[]; color: string; playPct?: number }) {
  if (peaks.length === 0) return (
    <div className="h-full w-full flex items-center justify-center">
      <span className="text-[10px] text-[#555] italic">Empty</span>
    </div>
  );
  const displayed = peaks.length > 100
    ? Array.from({ length: 100 }, (_, i) => peaks[Math.floor(i * peaks.length / 100)])
    : peaks;
  const playIdx = playPct !== undefined ? Math.floor((playPct / 100) * displayed.length) : -1;

  return (
    <div className="flex items-center h-full w-full gap-[0.5px] px-1 relative">
      {displayed.map((peak, i) => {
        const h = Math.max(peak * 85, 3);
        const past = playIdx >= 0 && i <= playIdx;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-center" style={{ minWidth: 1 }}>
            <div style={{ height: `${h / 2}%`, background: color, opacity: past ? 1 : 0.5, borderRadius: "1px 1px 0 0", width: "100%" }} />
            <div style={{ height: `${h / 2}%`, background: color, opacity: past ? 0.6 : 0.25, borderRadius: "0 0 1px 1px", width: "100%" }} />
          </div>
        );
      })}
      {playIdx >= 0 && (
        <div className="absolute top-0 bottom-0 w-[2px] pointer-events-none"
          style={{ left: `${(playIdx / displayed.length) * 100}%`, background: "#ff4444", boxShadow: "0 0 6px #ff4444" }} />
      )}
    </div>
  );
}

/* ── VU Meter ── */
function VUMeter({ active }: { active: boolean }) {
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
    <div className="flex flex-col-reverse gap-[1px] w-[6px]">
      {Array.from({ length: 24 }, (_, i) => {
        const lit = i < Math.round(level * 24);
        const color = lit
          ? i < 14 ? "#22c55e" : i < 20 ? "#eab308" : "#ef4444"
          : "#222";
        return <div key={i} style={{ height: 3, borderRadius: 0.5, background: color, opacity: lit ? 1 : 0.15 }} />;
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
      {/* Top bar with timer */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#333]"
        style={{ background: "#1a1a2e" }}>
        <button onClick={onBack} className="p-1">
          <ArrowLeft className="w-5 h-5 text-[#888]" />
        </button>
        <div className="flex items-center gap-4">
          <span className="text-xl font-mono font-bold text-white tracking-wider">
            {formatTime(currentTime)}
          </span>
          <span className="text-sm font-mono text-[#666]">
            {formatRemaining(currentTime, totalDuration)}
          </span>
        </div>
        <div className="w-6" />
      </div>

      {/* Timeline ruler */}
      <div className="h-5 border-b border-[#333] relative overflow-hidden" style={{ background: "#151525" }}>
        {Array.from({ length: Math.ceil(totalDuration / 5) }, (_, i) => {
          const t = i * 5;
          return (
            <div key={i} className="absolute bottom-0 flex flex-col items-center"
              style={{ left: `${(t / totalDuration) * 100}%` }}>
              <span className="text-[6px] font-mono text-[#555]">{Math.floor(t / 60)}:{String(t % 60).padStart(2, "0")}</span>
              <div className="w-px h-1.5 bg-[#444]" />
            </div>
          );
        })}
        {/* Playhead */}
        <div className="absolute top-0 bottom-0 w-[2px] z-10"
          style={{ left: `${playPct}%`, background: "#ef4444", boxShadow: "0 0 6px #ef4444" }}>
          <div style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "5px solid #ef4444", position: "absolute", top: 0, left: -3 }} />
        </div>
      </div>

      {/* Track lanes */}
      <div className="flex-1 overflow-y-auto" style={{ background: "#111122" }}>
        {/* Beat Track */}
        <div className="border-b border-[#333]">
          <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: "#1a1a2e" }}>
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: "#2a4a5a" }}>
              <Music className="w-3.5 h-3.5 text-[#63b3ed]" />
            </div>
            <span className="text-xs font-bold text-white flex-1">Beat Track</span>
            <button className="p-0.5"><MoreHorizontal className="w-4 h-4 text-[#555]" /></button>
          </div>
          <div className="h-20 px-1" style={{ background: "#0d1520" }}>
            <Waveform peaks={beatWaveform} color="#63b3ed" playPct={isPlaying ? playPct : undefined} />
          </div>
        </div>

        {/* Vocal Tracks */}
        {takes.map((take, idx) => (
          <div key={take.id} className="border-b border-[#333]">
            <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: "#1a1a2e" }}>
              <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: "#3a2a4a" }}>
                <Mic className="w-3.5 h-3.5 text-[#b794f4]" />
              </div>
              <span className="text-xs font-bold text-white flex-1">{take.name}</span>
              <span className="text-[10px] text-[#666] font-mono">{Math.round(take.duration)}s</span>
              <button className="p-0.5"><MoreHorizontal className="w-4 h-4 text-[#555]" /></button>
            </div>
            <div className="h-16 px-1" style={{ background: "#150d20" }}>
              <Waveform peaks={take.waveform} color="#b794f4" playPct={isPlaying && !take.muted ? playPct : undefined} />
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
            <div className="h-16 px-1" style={{ background: "#200d0d" }}>
              <Waveform peaks={liveWaveform} color="#ef4444" />
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

      {/* Transport + Record */}
      <div className="border-t border-[#333] pt-3 pb-4 px-4 space-y-3" style={{ background: "#1a1a2e" }}>
        {/* Transport controls */}
        <div className="flex items-center justify-center gap-6">
          <button onClick={() => setLoopOn(!loopOn)} className="p-2">
            <Repeat className={`w-5 h-5 ${loopOn ? "text-[#63b3ed]" : "text-[#555]"}`} />
          </button>
          <button className="p-2"><SkipBack className="w-5 h-5 text-[#888]" /></button>
          <button onClick={handlePlay}
            className="w-10 h-10 rounded-full flex items-center justify-center border border-[#444]"
            style={{ background: "#2a2a3e" }}>
            {isPlaying
              ? <Pause className="w-5 h-5 text-white" />
              : <Play className="w-5 h-5 text-white ml-0.5" />}
          </button>
          <button className="p-2"><SkipForward className="w-5 h-5 text-[#888]" /></button>
          <button className="p-2"><SkipForward className="w-5 h-5 text-[#555]" /></button>
        </div>

        {/* Record button row */}
        <div className="flex items-center justify-center gap-4">
          <button className="w-8 h-8 rounded-full border border-[#444] flex items-center justify-center"
            style={{ background: "#2a2a3e" }}>
            <Plus className="w-4 h-4 text-[#888]" />
          </button>

          {/* VU meters + Record button */}
          <div className="flex items-center gap-2">
            <VUMeter active={isRecording || isPlaying} />
            <VUMeter active={isRecording || isPlaying} />

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
              <div className={`w-6 h-6 rounded-full ${isRecording ? "bg-white" : "bg-white/80"}`}
                style={{ boxShadow: "0 0 10px #ffffff60" }} />
            </button>

            <VUMeter active={isRecording || isPlaying} />
            <VUMeter active={isRecording || isPlaying} />
          </div>

          <button className="w-8 h-8 rounded-full border border-[#444] flex items-center justify-center"
            style={{ background: "#2a2a3e" }}>
            <X className="w-4 h-4 text-[#888]" />
          </button>
        </div>
      </div>
    </div>
  );
}
