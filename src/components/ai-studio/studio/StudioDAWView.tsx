import { useState, useRef, useEffect, useMemo } from "react";
import {
  ArrowLeft, Mic, Play, Pause, Square, SkipBack, SkipForward,
  Repeat, Music, Volume2, Layers, Sliders, Download, Save,
  X, Guitar, AudioWaveform
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
  onPlayActiveTake: () => void;
  onStopPlayback: () => void;
  onPausePlayback: () => void;
  onToggleMute: (id: string) => void;
  onToggleSolo: (id: string) => void;
  onSave: () => void;
  savingTake: boolean;
  onNavigate: (screen: string) => void;
  onBack: () => void;
  beatPan: number;
  setBeatPan: (v: number) => void;
  vocalPan: number;
  setVocalPan: (v: number) => void;
}

const TRACK_COLORS = [
  { bg: "bg-cyan-900/40", wave: "bg-cyan-400/70", border: "border-cyan-500/30" },
  { bg: "bg-blue-900/40", wave: "bg-blue-400/70", border: "border-blue-500/30" },
  { bg: "bg-violet-900/40", wave: "bg-violet-400/70", border: "border-violet-500/30" },
  { bg: "bg-indigo-900/40", wave: "bg-indigo-400/70", border: "border-indigo-500/30" },
  { bg: "bg-purple-900/40", wave: "bg-purple-400/70", border: "border-purple-500/30" },
];

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(Math.floor(sec)).padStart(2, "0")}`;
};

const fmtMs = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const ms = Math.floor((sec % 1) * 100);
  return `${m}:${String(Math.floor(sec)).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
};

function LevelMeter({ active, intensity = 0.5 }: { active: boolean; intensity?: number }) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) { setLevel(0); return; }
    let target = intensity;
    const animate = () => {
      target = intensity + (Math.random() - 0.5) * 0.3;
      target = Math.max(0.05, Math.min(1, target));
      setLevel(prev => prev + (target - prev) * 0.3);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, intensity]);

  const pct = Math.round(level * 100);
  const isHot = pct > 85;
  const isWarm = pct > 60;

  return (
    <div className="w-2.5 h-full rounded-sm overflow-hidden bg-black/60 relative">
      <div
        className="absolute bottom-0 left-0 right-0 rounded-sm transition-[height] duration-75"
        style={{
          height: `${pct}%`,
          background: isHot
            ? "linear-gradient(to top, #22c55e 0%, #eab308 60%, #ef4444 90%)"
            : isWarm
            ? "linear-gradient(to top, #22c55e 0%, #eab308 80%)"
            : "linear-gradient(to top, #22c55e 0%, #22c55e 100%)",
        }}
      />
    </div>
  );
}

function WaveformDisplay({ peaks, color, height = 40 }: { peaks: number[]; color: string; height?: number }) {
  if (peaks.length === 0) return <div className="h-full w-full" />;
  return (
    <div className="flex items-center h-full w-full gap-px px-1">
      {peaks.slice(0, 100).map((peak, i) => (
        <div
          key={i}
          className={`flex-1 ${color} rounded-[1px]`}
          style={{
            height: `${Math.max(peak * 100, 6)}%`,
            minWidth: 1,
          }}
        />
      ))}
    </div>
  );
}

function TrackLane({
  name,
  icon,
  colorIndex,
  waveform,
  isActive,
  isMuted,
  isSolo,
  isRecordArmed,
  isRecordingNow,
  liveWaveform,
  volume,
  onVolumeChange,
  onMute,
  onSolo,
  onClick,
  onDelete,
  audioActive,
}: {
  name: string;
  icon: React.ReactNode;
  colorIndex: number;
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
  audioActive: boolean;
}) {
  const colors = TRACK_COLORS[colorIndex % TRACK_COLORS.length];

  return (
    <div
      className={`flex border-b border-border/30 min-h-[72px] ${isActive ? "ring-1 ring-primary/40" : ""}`}
      onClick={onClick}
    >
      {/* Track header */}
      <div className="w-[110px] shrink-0 border-r border-border/30 bg-card/90 p-1.5 flex flex-col gap-1">
        <div className="flex items-center gap-1">
          {icon}
          <span className="text-[9px] font-bold text-foreground truncate flex-1">{name}</span>
          {onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="opacity-50 hover:opacity-100">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onMute?.(); }}
            className={`w-[22px] h-[18px] text-[8px] font-black rounded flex items-center justify-center transition-colors ${
              isMuted ? "bg-red-500/80 text-white" : "bg-muted/80 text-muted-foreground"
            }`}
          >
            M
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSolo?.(); }}
            className={`w-[22px] h-[18px] text-[8px] font-black rounded flex items-center justify-center transition-colors ${
              isSolo ? "bg-yellow-500/80 text-black" : "bg-muted/80 text-muted-foreground"
            }`}
          >
            S
          </button>
          {isRecordArmed !== undefined && (
            <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center ${
              isRecordingNow ? "bg-red-500 animate-pulse" : "bg-muted/80"
            }`}>
              <div className={`w-2 h-2 rounded-full ${isRecordingNow ? "bg-white" : "bg-muted-foreground/50"}`} />
            </div>
          )}
          {audioActive && (
            <Volume2 className="w-3 h-3 text-primary ml-auto" />
          )}
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => { e.stopPropagation(); onVolumeChange(Number(e.target.value)); }}
          onClick={(e) => e.stopPropagation()}
          className="w-full h-1 accent-primary cursor-pointer"
        />
      </div>

      {/* Waveform area */}
      <div className={`flex-1 ${colors.bg} relative overflow-hidden flex items-center`}>
        {isRecordingNow && liveWaveform && liveWaveform.length > 0 ? (
          <div className="flex items-center h-full w-full gap-px px-1">
            {liveWaveform.map((peak, i) => (
              <div
                key={i}
                className={`flex-1 ${colors.wave} rounded-[1px] transition-all duration-75`}
                style={{ height: `${Math.max(peak * 100, 6)}%`, minWidth: 1 }}
              />
            ))}
          </div>
        ) : (
          <WaveformDisplay peaks={waveform} color={colors.wave} />
        )}

        {/* Level meters (right edge) */}
        <div className="absolute right-1 top-1 bottom-1 flex gap-0.5">
          <LevelMeter active={audioActive && !isMuted} intensity={volume / 100} />
          <LevelMeter active={audioActive && !isMuted} intensity={volume / 120} />
        </div>

        {isMuted && (
          <div className="absolute inset-0 bg-background/40 flex items-center justify-center">
            <span className="text-[9px] font-bold text-muted-foreground uppercase">Muted</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudioDAWView(props: StudioDAWViewProps) {
  const {
    sessionName, beatName, takes, activeTakeId, setActiveTakeId,
    isRecording, isPlaying, recordTime, playbackTime, playbackDuration,
    liveWaveform, beatVolume, setBeatVolume, vocalVolume, setVocalVolume,
    onStartRecording, onStopRecording, onPlayActiveTake, onStopPlayback,
    onPausePlayback, onToggleMute, onToggleSolo, onSave, savingTake,
    onNavigate, onBack, beatPan, setBeatPan, vocalPan, setVocalPan,
  } = props;

  const [showMixer, setShowMixer] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const tracksRef = useRef<HTMLDivElement>(null);

  const activeTake = takes.find(t => t.id === activeTakeId);
  const totalDuration = useMemo(() => {
    const maxTake = Math.max(...takes.map(t => t.duration), 0);
    return Math.max(maxTake, recordTime, playbackDuration, 30);
  }, [takes, recordTime, playbackDuration]);

  // Generate time markers
  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    const interval = totalDuration > 120 ? 30 : totalDuration > 60 ? 10 : 5;
    for (let t = 0; t <= totalDuration; t += interval) markers.push(t);
    return markers;
  }, [totalDuration]);

  const currentTime = isRecording ? recordTime : isPlaying ? playbackTime : 0;
  const playheadPct = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  // Fake beat waveform for display
  const beatWaveform = useMemo(() =>
    Array.from({ length: 80 }, () => 0.2 + Math.random() * 0.6),
  []);

  const isAudioActive = isRecording || isPlaying;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 text-center min-w-0 px-2">
          <span className="text-xs font-bold text-foreground truncate block">{sessionName}</span>
        </div>
        <button onClick={onSave} className="text-[10px] font-bold text-primary px-2 py-1 rounded-lg bg-primary/10">
          <Save className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Timeline ruler */}
      <div className="flex h-5 border-b border-border/30 shrink-0 bg-card/30">
        <div className="w-[110px] shrink-0 border-r border-border/30" />
        <div className="flex-1 relative overflow-hidden">
          <div className="flex h-full items-end">
            {timeMarkers.map(t => (
              <div
                key={t}
                className="absolute bottom-0 flex flex-col items-center"
                style={{ left: `${(t / totalDuration) * 100}%` }}
              >
                <span className="text-[7px] font-mono text-muted-foreground/70 leading-none mb-0.5">{fmt(t)}</span>
                <div className="w-px h-1.5 bg-muted-foreground/30" />
              </div>
            ))}
          </div>
          {/* Playhead on ruler */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 transition-[left] duration-100"
            style={{ left: `${playheadPct}%` }}
          >
            <div className="w-2 h-2 bg-red-500 rounded-b-sm -ml-[3px]" />
          </div>
        </div>
      </div>

      {/* Track lanes */}
      <div ref={tracksRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        {/* Beat Track */}
        <TrackLane
          name={beatName || "Beat Track"}
          icon={<Music className="w-3 h-3 text-cyan-400" />}
          colorIndex={0}
          waveform={beatWaveform}
          isActive={false}
          isMuted={false}
          isSolo={false}
          volume={beatVolume}
          onVolumeChange={setBeatVolume}
          audioActive={isAudioActive}
        />

        {/* Vocal takes as tracks */}
        {takes.map((take, idx) => (
          <TrackLane
            key={take.id}
            name={take.name}
            icon={<Mic className="w-3 h-3 text-violet-400" />}
            colorIndex={idx + 1}
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
            audioActive={isAudioActive && !take.muted && (activeTakeId === take.id)}
          />
        ))}

        {/* Recording lane (when recording a new take) */}
        {isRecording && takes.length === 0 && (
          <TrackLane
            name="Recording..."
            icon={<Mic className="w-3 h-3 text-red-400" />}
            colorIndex={1}
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
          />
        )}

        {/* Add track placeholder */}
        <div className="flex min-h-[52px] border-b border-border/20">
          <div className="w-[110px] shrink-0 border-r border-border/20 p-2 flex items-center justify-center">
            <button
              onClick={onStartRecording}
              disabled={isRecording || savingTake}
              className="w-full border border-dashed border-border/50 rounded-lg py-1 flex items-center justify-center gap-1 text-[9px] text-muted-foreground/60 hover:text-primary hover:border-primary/30 transition-colors disabled:opacity-30"
            >
              <span className="text-sm">+</span>
            </button>
          </div>
          <div className="flex-1 bg-card/10" />
        </div>

        {/* Spacer */}
        <div className="h-20" />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-t border-border/30 bg-card/50 shrink-0 overflow-x-auto">
        <button onClick={() => onNavigate("takes")} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted/50 text-[10px] font-bold text-foreground shrink-0">
          <Layers className="w-3 h-3" /> Takes {takes.length > 0 && `(${takes.length})`}
        </button>
        <button onClick={() => onNavigate("effects")} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted/50 text-[10px] font-bold text-foreground shrink-0">
          <AudioWaveform className="w-3 h-3" /> Effects
        </button>
        <button onClick={() => setShowMixer(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-[10px] font-bold text-primary shrink-0">
          <Sliders className="w-3 h-3" /> Mixer
        </button>
        <button onClick={() => onNavigate("export")} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted/50 text-[10px] font-bold text-foreground shrink-0">
          <Download className="w-3 h-3" /> Export
        </button>
      </div>

      {/* Transport bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-card border-t border-border/50 shrink-0">
        <div className="flex items-center gap-2">
          {/* Record button */}
          <button
            onClick={isRecording ? onStopRecording : onStartRecording}
            disabled={savingTake}
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 ${
              isRecording
                ? "bg-red-500 shadow-red-500/40 animate-pulse"
                : "bg-red-500/90 shadow-red-500/20 hover:bg-red-500"
            } disabled:opacity-50`}
          >
            {isRecording ? (
              <Square className="w-4 h-4 text-white" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-white" />
            )}
          </button>

          {/* Play / Pause */}
          <button
            onClick={isPlaying ? onPausePlayback : onPlayActiveTake}
            disabled={isRecording || (!activeTake && takes.length === 0)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 ${
              isPlaying ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
            } disabled:opacity-30`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          {/* Rewind */}
          <button
            onClick={onStopPlayback}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-muted/50 text-muted-foreground active:scale-90 transition-all"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {/* Loop */}
          <button
            onClick={() => setLoopEnabled(!loopEnabled)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 ${
              loopEnabled ? "bg-yellow-500/20 text-yellow-400" : "bg-muted/50 text-muted-foreground"
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Time display */}
        <div className="flex items-center gap-2">
          <div className="bg-background/80 border border-border/50 rounded-lg px-3 py-1.5 font-mono text-sm text-foreground tabular-nums">
            {fmtMs(currentTime)}
          </div>
          {isRecording && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] font-bold text-red-400 uppercase">REC</span>
            </div>
          )}
        </div>
      </div>

      {/* Saving overlay */}
      {savingTake && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex items-center gap-3 bg-card border border-border rounded-2xl px-6 py-4">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-foreground">Saving take...</span>
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
