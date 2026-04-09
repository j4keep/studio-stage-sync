import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  Mic,
  MonitorUp,
  Pause,
  Play,
  Radio,
  Settings,
  Square,
  Volume2,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSession } from "./SessionContext";

const JOIN_PATH = "/wstudio/session/join";

/* ── Shared panel style ── */
const PANEL =
  "rounded-lg border border-zinc-700/90 bg-[#1e1e1e] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_4px_12px_rgba(0,0,0,0.35)]";

/* ── Knob component (270° arc, realistic look) ── */
function StudioKnob({ label, value, size = "lg" }: { label: string; value: number; size?: "lg" | "sm" }) {
  const deg = -135 + (value / 100) * 270;
  const dim = size === "lg" ? "h-[72px] w-[72px]" : "h-[56px] w-[56px]";
  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* tick marks */}
      <div className={cn("relative", dim)}>
        <svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full">
          {Array.from({ length: 11 }, (_, i) => {
            const a = -135 + i * 27;
            const r = (a * Math.PI) / 180;
            const x1 = 40 + 35 * Math.cos(r);
            const y1 = 40 + 35 * Math.sin(r);
            const x2 = 40 + 38 * Math.cos(r);
            const y2 = 40 + 38 * Math.sin(r);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#555" strokeWidth="1" />;
          })}
        </svg>
        <div
          className={cn(
            "absolute inset-[4px] rounded-full bg-gradient-to-b from-zinc-600 via-zinc-800 to-zinc-950 shadow-[inset_0_2px_6px_rgba(255,255,255,0.10),0_4px_12px_rgba(0,0,0,0.6)] ring-1 ring-black/70",
          )}
        >
          <div className="absolute inset-[3px] rounded-full bg-gradient-to-b from-zinc-700 to-zinc-950" />
          {/* pointer */}
          <div
            className="absolute bottom-1/2 left-1/2 h-[38%] w-[2px] origin-bottom rounded-full bg-zinc-300"
            style={{ transform: `translateX(-50%) rotate(${deg}deg)` }}
          />
          {/* gloss */}
          <div className="pointer-events-none absolute inset-[20%] rounded-full bg-gradient-to-br from-zinc-600/20 to-transparent" />
        </div>
      </div>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
    </div>
  );
}

/* ── Vertical LED meter ── */
function VerticalLeds({ value, count = 12 }: { value: number; count?: number }) {
  const lit = Math.round((value / 100) * count);
  return (
    <div className="flex flex-col-reverse gap-[2px]">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-[3px] w-[5px] rounded-[1px]",
            i < lit
              ? i >= count - 3
                ? "bg-red-500"
                : i >= count - 5
                  ? "bg-amber-400"
                  : "bg-emerald-500"
              : "bg-zinc-800",
          )}
        />
      ))}
    </div>
  );
}

/* ── Video placeholder ── */
function VideoTile({ name, className }: { name: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-zinc-900", className)}>
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800/50 to-zinc-950/50">
        <div className="h-16 w-16 rounded-full bg-zinc-700/50 flex items-center justify-center text-2xl font-bold text-zinc-500">
          {name.charAt(0)}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
        <span className="text-xs font-medium text-zinc-200">{name}</span>
      </div>
    </div>
  );
}

/* ── Remote vocal horizontal meter ── */
function RemoteVocalMeter({ level }: { level: number }) {
  const pct = Math.min(100, Math.max(0, level * 100));
  return (
    <div className="space-y-1">
      {/* top level bar */}
      <div className="h-2.5 overflow-hidden rounded-sm bg-zinc-950 ring-1 ring-zinc-700">
        <div
          className="h-full rounded-sm bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 transition-[width] duration-75"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* detailed meter with red/amber/green segments */}
      <div className="relative h-5 overflow-hidden rounded-sm bg-zinc-950 ring-1 ring-zinc-700">
        <div className="absolute inset-0 flex">
          {Array.from({ length: 40 }, (_, i) => {
            const segPct = (i / 40) * 100;
            const isLit = segPct < pct;
            let color = "bg-emerald-600";
            if (i > 30) color = "bg-red-600";
            else if (i > 24) color = "bg-amber-500";
            return (
              <div
                key={i}
                className={cn("flex-1 border-r border-zinc-950/80", isLit ? color : "bg-zinc-900/50")}
              />
            );
          })}
        </div>
        {/* scale numbers */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 text-[6px] text-zinc-600">
          <span>220</span><span>150</span><span>100</span><span>50</span><span>0</span><span>5</span><span>10</span><span>15</span><span>20</span><span>25</span>
        </div>
      </div>
    </div>
  );
}

/* ── Waveform animation ── */
function RecordingWaveform({ level, recording }: { level: number; recording: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let id: number;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, w, h);
      const mid = h / 2;
      ctx.strokeStyle = "#444";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();
      if (recording || level > 0.05) {
        ctx.strokeStyle = "rgba(161,161,170,0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < w; x++) {
          const amp = level * 0.4 + Math.random() * 0.08;
          const y = mid + Math.sin(Date.now() / 150 + x * 0.06) * mid * amp;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [level, recording]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={80}
      className="h-16 w-full rounded"
    />
  );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */
export default function EngineerSessionScreen() {
  const {
    sessionId,
    sessionDisplayName,
    connection,
    role,
    demoMode,
    talkbackHeld,
    beginTalkback,
    endTalkback,
    muted,
    toggleMute,
    remoteVocalLevel,
    leaveSession,
    live,
    setSessionRecording,
  } = useSession();

  const [armRecord, setArmRecord] = useState(false);
  const [recording, setRecording] = useState(false);

  const connected = connection === "connected";

  if (!role) return <Navigate to={JOIN_PATH} replace />;
  if (role === "artist") return <Navigate to="/wstudio/session/artist" replace />;

  const onRecord = () => {
    const next = !recording;
    setRecording(next);
    setSessionRecording(next);
    toast.message(next ? "Recording started" : "Recording stopped");
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#111] text-zinc-100">
      {/* ── TOP BAR ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-[#1a1a1a] px-4 py-2">
        <div className="flex items-center gap-1">
          <span className="text-sm font-extrabold tracking-wider text-white">W.STUDIO</span>
          <span className="text-sm font-light tracking-wider text-zinc-400 ml-1">RECEIVE</span>
        </div>
        <div className="flex items-center gap-1">
          {demoMode && (
            <span className="mr-1 rounded border border-emerald-800/60 bg-emerald-950/40 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-emerald-300">
              Demo
            </span>
          )}
          <button type="button" className="rounded p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200" aria-label="Menu">
            <Menu className="h-4 w-4" />
          </button>
          <Link to={JOIN_PATH} onClick={leaveSession} className="rounded p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200" aria-label="Close">
            <X className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* ── MAIN BODY ── */}
      <div className="flex min-h-0 flex-1 flex-col gap-0 p-2">
        {/* Top row: session strip spans center+right */}
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-12">
          {/* ── LEFT: Video stack ── */}
          <div className="flex flex-col gap-0 lg:col-span-4 lg:row-span-2">
            <VideoTile name="Jay - Florida" className="min-h-[160px] flex-1 rounded-t-lg" />
            <VideoTile name="Bob - New York" className="min-h-[160px] flex-1" />
            {/* Mute / Talk / Settings row */}
            <div className="grid grid-cols-3 gap-0 border-t border-zinc-800 bg-[#1a1a1a] rounded-b-lg">
              <button
                type="button"
                onClick={toggleMute}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-semibold uppercase tracking-wide transition border-r border-zinc-800",
                  muted ? "text-rose-300 bg-rose-950/30" : "text-zinc-400 hover:bg-zinc-800",
                )}
              >
                <Mic className="h-5 w-5" />
                Mute
              </button>
              <button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); beginTalkback(); }}
                onPointerUp={endTalkback}
                onPointerLeave={endTalkback}
                onTouchStart={(e) => { e.preventDefault(); beginTalkback(); }}
                onTouchEnd={endTalkback}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-semibold uppercase tracking-wide transition border-r border-zinc-800 select-none touch-manipulation",
                  talkbackHeld ? "text-sky-300 bg-sky-950/40" : "text-zinc-400 hover:bg-zinc-800",
                )}
              >
                <div className={cn("rounded-full p-1", talkbackHeld ? "bg-sky-600" : "")}>
                  <Play className="h-4 w-4" />
                </div>
                Talk
              </button>
              <button
                type="button"
                onClick={() => toast.message("Settings (demo)")}
                className="flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 hover:bg-zinc-800 transition"
              >
                <Settings className="h-5 w-5" />
                Settings
              </button>
            </div>
          </div>

          {/* ── CENTER COLUMN ── */}
          <div className="flex flex-col gap-2 lg:col-span-5">
            {/* Session strip */}
            <div className={cn(PANEL, "flex flex-wrap items-center gap-2 px-3 py-2")}>
              <p className="min-w-0 flex-1 truncate text-xs text-zinc-200">
                {sessionDisplayName || "Session: Live with Jay - Florida"}
              </p>
              <span
                className={cn(
                  "shrink-0 rounded px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                  connected
                    ? "bg-emerald-700/80 text-emerald-50 ring-1 ring-emerald-500/50"
                    : "bg-zinc-700 text-zinc-300",
                )}
              >
                {connected ? "Connected" : "Disconnected"}
              </span>
              <div className="ml-auto flex items-center gap-0.5">
                {[Volume2, MonitorUp, Wrench, Settings].map((Icon, i) => (
                  <button
                    key={i}
                    type="button"
                    className="rounded p-2 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                    onClick={() => toast.message("Demo action")}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>

            {/* Sync Controls */}
            <div className={cn(PANEL, "p-3")}>
              <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Sync Controls</div>
              <p className="mb-2 text-center text-[11px] font-semibold text-zinc-400">— SYNCED: 120 BPM —</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => toast.message("Play (demo)")}
                  className="flex items-center justify-center gap-2 rounded-lg border border-zinc-600 bg-gradient-to-b from-zinc-700 to-zinc-900 py-3 text-[11px] font-bold uppercase text-zinc-200 shadow hover:from-zinc-600"
                >
                  <Play className="h-3.5 w-3.5" /> Play
                </button>
                <button
                  type="button"
                  onClick={() => { setRecording(false); setSessionRecording(false); toast.message("Stop (demo)"); }}
                  className="flex items-center justify-center gap-2 rounded-lg border border-zinc-600 bg-gradient-to-b from-zinc-700 to-zinc-900 py-3 text-[11px] font-bold uppercase text-zinc-200 shadow hover:from-zinc-600"
                >
                  <Square className="h-3 w-3 text-red-400" /> Stop
                </button>
                <button
                  type="button"
                  onClick={onRecord}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border py-3 text-[11px] font-bold uppercase shadow",
                    recording
                      ? "border-red-600/80 bg-red-950/60 text-red-200"
                      : "border-zinc-600 bg-gradient-to-b from-zinc-700 to-zinc-900 text-zinc-200 hover:from-zinc-600",
                  )}
                >
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> Record
                </button>
              </div>
            </div>

            {/* Vocal Input */}
            <div className={cn(PANEL, "p-3")}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Vocal Input</span>
                <div className="flex gap-1">
                  {([1, 2, 3] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={cn(
                        "h-5 w-5 rounded border text-[9px] font-bold",
                        c === 1
                          ? "border-amber-500/70 bg-amber-950/50 text-amber-100"
                          : "border-zinc-700 bg-zinc-900 text-zinc-500",
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-2 text-center text-[11px] font-bold uppercase tracking-wide text-zinc-300">
                Remote Vocal
              </div>
              <RemoteVocalMeter level={remoteVocalLevel} />
              <button
                type="button"
                onClick={() => { setArmRecord(!armRecord); toast.message(armRecord ? "Disarmed" : "Armed for recording"); }}
                className={cn(
                  "mt-3 w-full rounded-lg border py-3 text-xs font-bold uppercase tracking-wider transition",
                  armRecord
                    ? "border-amber-500/60 bg-amber-950/50 text-amber-100"
                    : "border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700",
                )}
              >
                ARM RECORD
              </button>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="flex flex-col gap-2 lg:col-span-3">
            {/* Monitoring */}
            <div className={cn(PANEL, "p-3")}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Monitoring</span>
                <div className="flex gap-[2px]">
                  <VerticalLeds value={65} count={6} />
                  <VerticalLeds value={45} count={6} />
                  <VerticalLeds value={80} count={6} />
                </div>
              </div>
              <div className="mt-2 flex justify-around">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[8px] font-semibold text-zinc-500">Vocal Level</span>
                  <div className="flex items-end gap-1.5">
                    <StudioKnob label="" value={Math.min(100, remoteVocalLevel * 100)} />
                    <VerticalLeds value={Math.min(100, remoteVocalLevel * 100)} count={14} />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[8px] font-semibold text-zinc-500">Talkback Level</span>
                  <div className="flex items-end gap-1.5">
                    <StudioKnob label="" value={talkbackHeld ? 72 : 35} />
                    <VerticalLeds value={talkbackHeld ? 72 : 35} count={14} />
                  </div>
                </div>
              </div>
            </div>

            {/* Effects */}
            <div className={cn(PANEL, "p-3")}>
              <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Effects</div>
              <div className="flex justify-around">
                <StudioKnob label="Comp" value={42} size="sm" />
                <StudioKnob label="EQ" value={58} size="sm" />
                <StudioKnob label="Reverb" value={33} size="sm" />
              </div>
            </div>
          </div>
        </div>

        {/* ── BOTTOM: Waveform + Transport ── */}
        <div className={cn(PANEL, "mt-2 overflow-hidden")}>
          {/* Take title */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
            <span className="text-[11px] font-medium text-zinc-300">
              Jay's Vocal Take 4 – {recording ? "Recording…" : "Ready"}
            </span>
            <Pause className="h-3.5 w-3.5 text-zinc-600" />
          </div>
          {/* Waveform */}
          <div className="bg-zinc-950 px-1 py-1">
            <RecordingWaveform level={remoteVocalLevel} recording={recording || live.recording} />
          </div>
          {/* Transport bar */}
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 bg-[#161616] px-3 py-2">
            <button type="button" className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-[10px] font-bold uppercase text-zinc-300 hover:bg-zinc-700">
              <Pause className="h-3 w-3" /> Punch In
            </button>
            <button type="button" className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-[10px] font-bold uppercase text-zinc-300 hover:bg-zinc-700">
              <ChevronLeft className="h-3 w-3" /><ChevronLeft className="h-3 w-3 -ml-2" /> Rewind
            </button>
            <button type="button" className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-[10px] font-bold uppercase text-zinc-300 hover:bg-zinc-700">
              <ChevronRight className="h-3 w-3" /><ChevronRight className="h-3 w-3 -ml-2" /> Forward
            </button>
            <div
              className={cn(
                "ml-auto flex items-center gap-2 rounded-lg border px-4 py-2 text-[10px] font-bold uppercase tracking-wide",
                recording
                  ? "border-red-600/80 bg-red-950/60 text-red-200 shadow-[0_0_20px_rgba(220,38,38,0.3)]"
                  : "border-zinc-600 bg-zinc-800 text-zinc-500",
              )}
            >
              <span className={cn("inline-block h-2 w-2 rounded-full", recording ? "bg-red-500 animate-pulse" : "bg-zinc-600")} />
              REC {recording ? "● RECORDING…" : "● IDLE"}
            </div>
            <div className="flex items-center gap-2 pl-2">
              <div className="flex gap-[2px]">
                {[true, true, true, false].map((on, i) => (
                  <div key={i} className={cn("h-3 w-2 rounded-[1px]", on ? "bg-emerald-500" : "bg-zinc-700")} />
                ))}
              </div>
              <span className="text-[9px] font-semibold uppercase">
                AUTO UPLOAD: <span className="text-emerald-400">ON</span> <span className="text-emerald-400">▶</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
