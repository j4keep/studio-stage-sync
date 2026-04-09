import { useEffect, useRef, useState } from "react";
import { useSession } from "./SessionContext";
import {
  Mic, MicOff, Play, Square, Monitor, Settings, X, Menu,
  Volume2, Pause, Rewind, FastForward,
} from "lucide-react";

/* ─── Knob (SVG rotary) ─── */
function StudioKnob({ label, value = 0.5, size = 56 }: { label: string; value?: number; size?: number }) {
  const angle = -135 + value * 270;
  const r = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;
  const ticks = 11;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="drop-shadow-lg">
        {/* tick marks */}
        {Array.from({ length: ticks }).map((_, i) => {
          const a = (-135 + (i / (ticks - 1)) * 270) * (Math.PI / 180);
          const x1 = cx + (r + 2) * Math.cos(a);
          const y1 = cy + (r + 2) * Math.sin(a);
          const x2 = cx + (r + 5) * Math.cos(a);
          const y2 = cy + (r + 5) * Math.sin(a);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#666" strokeWidth={1} />;
        })}
        {/* outer ring */}
        <circle cx={cx} cy={cy} r={r} fill="url(#knobGrad)" stroke="#333" strokeWidth={1.5} />
        {/* indicator line */}
        <line
          x1={cx}
          y1={cy}
          x2={cx + (r - 6) * Math.cos(angle * Math.PI / 180)}
          y2={cy + (r - 6) * Math.sin(angle * Math.PI / 180)}
          stroke="#e5e5e5"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <defs>
          <radialGradient id="knobGrad">
            <stop offset="0%" stopColor="#555" />
            <stop offset="100%" stopColor="#222" />
          </radialGradient>
        </defs>
      </svg>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
    </div>
  );
}

/* ─── Vertical LED Meter ─── */
function VerticalMeter({ level = 0.6, height = 100 }: { level?: number; height?: number }) {
  const segments = 16;
  return (
    <div className="flex flex-col-reverse gap-[2px]" style={{ height }}>
      {Array.from({ length: segments }).map((_, i) => {
        const pct = (i + 1) / segments;
        const active = pct <= level;
        let color = "bg-emerald-500";
        if (pct > 0.6) color = "bg-yellow-400";
        if (pct > 0.8) color = "bg-red-500";
        return (
          <div
            key={i}
            className={`w-3 flex-1 rounded-[1px] ${active ? color : "bg-zinc-800"}`}
          />
        );
      })}
    </div>
  );
}

/* ─── Remote Vocal Meter (horizontal) ─── */
function RemoteVocalMeter({ level }: { level: number }) {
  const segments = 40;
  return (
    <div className="flex gap-[1px]">
      {Array.from({ length: segments }).map((_, i) => {
        const pct = (i + 1) / segments;
        const active = pct <= level;
        let color = "bg-emerald-500";
        if (pct > 0.5) color = "bg-yellow-400";
        if (pct > 0.75) color = "bg-red-500";
        return (
          <div key={i} className={`h-4 w-1.5 rounded-[1px] ${active ? color : "bg-zinc-800/60"}`} />
        );
      })}
    </div>
  );
}

/* ─── Waveform Canvas ─── */
function RecordingWaveform({ recording }: { recording: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame: number;
    const draw = (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = recording ? "#6b7280" : "#3f3f46";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const amp = recording
          ? Math.sin(x * 0.03 + t * 0.003) * 20 + Math.sin(x * 0.07 + t * 0.002) * 12 + Math.sin(x * 0.15 + t * 0.005) * 6
          : Math.sin(x * 0.05) * 4;
        ctx.lineTo(x, h / 2 + amp);
      }
      ctx.stroke();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [recording]);
  return <canvas ref={canvasRef} width={900} height={70} className="h-[70px] w-full rounded" />;
}

/* ═══════════════════════════════════════════════════════════════
   UNIFIED SESSION SCREEN
   ═══════════════════════════════════════════════════════════════ */
export default function UnifiedSessionScreen() {
  const {
    role, connection, sessionDisplayName,
    muted, toggleMute,
    talkbackHeld, beginTalkback, endTalkback,
    screenSharing, toggleScreenShare,
    remoteVocalLevel,
    live, setSessionRecording,
    demoClock, leaveSession,
  } = useSession();

  const isEngineer = role === "engineer";
  const [armed, setArmed] = useState(false);

  const connected = connection === "connected";
  const recording = live.recording;

  // Format timer
  const mins = Math.floor(demoClock.remainingSeconds / 60);
  const secs = demoClock.remainingSeconds % 60;
  const timerStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return (
    <div className="flex min-h-screen flex-col bg-[#1a1a1e] text-zinc-100 select-none">
      {/* ─── Title Bar ─── */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-[#222226] px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-black tracking-tight text-white">
            W.<span className="text-white">STUDIO</span>
          </span>
          <span className="text-sm font-light tracking-wide text-zinc-400">RECEIVE</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-zinc-400 hover:text-white"><Menu size={16} /></button>
          <button onClick={leaveSession} className="text-zinc-400 hover:text-white"><X size={16} /></button>
        </div>
      </div>

      {/* ─── Session Status Bar ─── */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-[#1e1e22] px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-300">{sessionDisplayName || "Session"}</span>
          <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${connected ? "bg-emerald-600 text-white" : "bg-zinc-700 text-zinc-400"}`}>
            {connected ? "CONNECTED" : connection.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white"><Volume2 size={16} /></button>
          <button className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white"><Monitor size={16} /></button>
          <button className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white"><X size={16} /></button>
          <button className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white"><Settings size={16} /></button>
          {/* Timer */}
          <span className="ml-2 font-mono text-sm text-zinc-300">{timerStr}</span>
        </div>
      </div>

      {/* ─── Main Body: 3-column layout ─── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Video Tiles + Controls ── */}
        <div className="flex w-[280px] shrink-0 flex-col border-r border-zinc-800 bg-[#161618]">
          {/* Artist Video */}
          <div className="relative aspect-[4/3] w-full bg-zinc-900">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-full w-full bg-gradient-to-br from-zinc-800 to-zinc-900" />
            </div>
            <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">
              Jay - Florida
            </div>
          </div>
          {/* Engineer Video */}
          <div className="relative aspect-[4/3] w-full border-t border-zinc-800 bg-zinc-900">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-full w-full bg-gradient-to-br from-zinc-800 to-zinc-900" />
            </div>
            <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">
              Bob - New York
            </div>
          </div>
          {/* Controls: Mute / Talk / Settings */}
          <div className="flex items-center justify-around border-t border-zinc-800 bg-[#1a1a1e] px-2 py-3">
            <button onClick={toggleMute} className="flex flex-col items-center gap-1">
              {muted ? <MicOff size={20} className="text-red-400" /> : <Mic size={20} className="text-zinc-400" />}
              <span className="text-[10px] text-zinc-500">Mute</span>
            </button>
            <button
              onPointerDown={beginTalkback}
              onPointerUp={endTalkback}
              className={`flex flex-col items-center gap-1 rounded-lg p-2 ${talkbackHeld ? "bg-blue-600" : ""}`}
            >
              <Play size={20} className={talkbackHeld ? "text-white" : "text-blue-400"} />
              <span className="text-[10px] text-zinc-500">Talk</span>
            </button>
            <button className="flex flex-col items-center gap-1">
              <Settings size={20} className="text-zinc-400" />
              <span className="text-[10px] text-zinc-500">Settings</span>
            </button>
          </div>
        </div>

        {/* ── CENTER: Sync + Vocal Input ── */}
        <div className="flex flex-1 flex-col">
          {/* Sync Controls */}
          <div className="border-b border-zinc-800 bg-[#1a1a1e] p-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">Sync Controls</h3>
            <p className="mb-3 text-center text-sm font-semibold text-zinc-300">– SYNCED: 120 BPM –</p>
            <div className="flex items-center justify-center gap-2">
              <button
                disabled={!isEngineer}
                className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
              >
                <Play size={14} /> Play
              </button>
              <button
                disabled={!isEngineer}
                className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
              >
                <Square size={14} className="text-red-400" /> Stop
              </button>
              <button
                disabled={!isEngineer}
                onClick={() => isEngineer && setSessionRecording(!recording)}
                className={`flex items-center gap-1.5 rounded border px-4 py-2 text-sm font-semibold ${recording ? "border-red-600 bg-red-900/40 text-red-300" : "border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700"} disabled:opacity-40`}
              >
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${recording ? "bg-red-500 animate-pulse" : "bg-red-500"}`} /> Record
              </button>
            </div>
          </div>

          {/* Vocal Input */}
          <div className="flex-1 border-b border-zinc-800 bg-[#1a1a1e] p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Vocal Input</h3>
              <div className="flex gap-1">
                <div className="h-3 w-2 rounded-sm bg-blue-500" />
                <div className="h-3 w-2 rounded-sm bg-yellow-500" />
              </div>
            </div>
            <p className="mb-3 text-center text-sm font-bold uppercase tracking-wide text-zinc-200">Remote Vocal</p>
            {/* Level bar */}
            <div className="mb-2 overflow-hidden rounded bg-zinc-900 p-1">
              <div className="h-3 overflow-hidden rounded bg-zinc-950">
                <div
                  className="h-full rounded bg-gradient-to-r from-emerald-600 via-yellow-400 to-red-500 transition-[width] duration-75"
                  style={{ width: `${Math.min(100, remoteVocalLevel * 100)}%` }}
                />
              </div>
            </div>
            {/* Spectrum-style meter */}
            <div className="mb-4 flex justify-center">
              <RemoteVocalMeter level={remoteVocalLevel} />
            </div>
            {/* ARM RECORD */}
            <div className="flex justify-center">
              <button
                disabled={!isEngineer}
                onClick={() => setArmed(!armed)}
                className={`rounded border px-8 py-2 text-sm font-bold uppercase tracking-wider ${armed ? "border-red-500 bg-red-900/40 text-red-300" : "border-zinc-600 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"} disabled:opacity-40`}
              >
                ARM RECORD
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Monitoring + Effects ── */}
        <div className="flex w-[240px] shrink-0 flex-col border-l border-zinc-800 bg-[#161618]">
          {/* Monitoring */}
          <div className="border-b border-zinc-800 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Monitoring</h3>
              <div className="flex gap-[2px]">
                {[3,4,5,3,2].map((h, i) => (
                  <div key={i} className="bg-zinc-500" style={{ width: 3, height: h * 2 }} />
                ))}
              </div>
            </div>
            <div className="flex items-end justify-around">
              {/* Vocal Level */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] font-semibold text-zinc-400">Vocal Level</span>
                <div className="flex items-end gap-2">
                  <StudioKnob label="" value={0.65} size={52} />
                  <VerticalMeter level={remoteVocalLevel} height={80} />
                </div>
              </div>
              {/* Talkback Level */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] font-semibold text-zinc-400">Talkback Level</span>
                <div className="flex items-end gap-2">
                  <StudioKnob label="" value={talkbackHeld ? 0.8 : 0.45} size={52} />
                  <VerticalMeter level={talkbackHeld ? 0.7 : 0.2} height={80} />
                </div>
              </div>
            </div>
          </div>

          {/* Effects */}
          <div className="flex-1 p-4">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Effects</h3>
            <div className="flex items-center justify-around">
              <StudioKnob label="Comp" value={0.35} size={50} />
              <StudioKnob label="EQ" value={0.5} size={50} />
              <StudioKnob label="Reverb" value={0.6} size={50} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Bottom: Waveform / Transport ─── */}
      <div className="border-t border-zinc-800 bg-[#131315]">
        {/* Take title */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-1.5">
          <span className="text-xs font-semibold text-zinc-300">
            Jay's Vocal Take 4 – {recording ? "Recording..." : "Idle"}
          </span>
          <button className="text-zinc-500 hover:text-white">
            <Pause size={12} />
          </button>
        </div>
        {/* Waveform */}
        <div className="px-4 py-2">
          <RecordingWaveform recording={recording} />
        </div>
        {/* Transport bar */}
        <div className="flex items-center gap-2 border-t border-zinc-800 px-4 py-2">
          <button disabled={!isEngineer} className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 disabled:opacity-40">
            <Pause size={12} /> Punch In
          </button>
          <button disabled={!isEngineer} className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 disabled:opacity-40">
            <Rewind size={12} /> Rewind
          </button>
          <button disabled={!isEngineer} className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 disabled:opacity-40">
            <FastForward size={12} /> Forward
          </button>

          {/* REC status */}
          <div className={`ml-auto flex items-center gap-2 rounded px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${recording ? "bg-red-900/50 text-red-400" : "bg-zinc-800 text-zinc-500"}`}>
            <span className={`inline-block h-2 w-2 rounded-full ${recording ? "bg-red-500 animate-pulse" : "bg-zinc-600"}`} />
            REC {recording ? "● RECORDING..." : ""}
          </div>

          {/* Auto Upload indicator */}
          <div className="flex items-center gap-1.5">
            <div className="flex gap-[2px]">
              <div className="h-3 w-2 rounded-sm bg-emerald-500" />
              <div className="h-3 w-2 rounded-sm bg-emerald-500" />
              <div className="h-3 w-2 rounded-sm bg-yellow-500" />
              <div className="h-3 w-2 rounded-sm bg-zinc-600" />
            </div>
            <span className="text-[10px] font-semibold text-zinc-400">AUTO UPLOAD:</span>
            <span className="text-[10px] font-bold text-emerald-400">ON ▶</span>
          </div>
        </div>
      </div>
    </div>
  );
}
