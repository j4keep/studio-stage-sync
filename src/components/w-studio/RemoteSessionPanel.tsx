/**
 * W.Studio RECEIVE — Remote Recording Session UI
 *
 * Floating panel overlay that provides:
 * - Session join screen
 * - Video call layout (artist + engineer webcams)
 * - Sync controls (Play / Stop / Record)
 * - Vocal input with waveform + ARM RECORD
 * - Monitoring meters (Vocal Level, Talkback Level)
 * - Effects knobs (Comp, EQ, Reverb)
 * - Recording take strip with transport (Punch In, Rewind, Forward)
 * - Connection status badge
 *
 * Pure UI — no real WebRTC or signaling.
 */

import { useState, useRef, useEffect, useCallback, type CSSProperties } from "react";
import {
  Mic, MicOff, Video, VideoOff, Monitor, Settings, X, Menu,
  Play, Square, Circle, ChevronLeft, ChevronRight, Pause,
  Volume2, Headphones, Radio, Wifi, WifiOff, Phone, PhoneOff,
  Upload,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type ConnectionStatus = "disconnected" | "connecting" | "connected";
type SessionView = "join" | "artist" | "engineer";
type RecordingState = "idle" | "armed" | "recording";

interface Participant {
  id: string;
  name: string;
  location: string;
  role: "engineer" | "artist";
  videoOn: boolean;
  audioOn: boolean;
}

/* ------------------------------------------------------------------ */
/*  Mock helpers                                                      */
/* ------------------------------------------------------------------ */

const MOCK_PARTICIPANTS: Participant[] = [
  { id: "1", name: "Jay", location: "Florida", role: "artist", videoOn: true, audioOn: true },
  { id: "2", name: "Bob", location: "New York", role: "engineer", videoOn: true, audioOn: true },
];

/* ------------------------------------------------------------------ */
/*  Knob component (dark studio style)                                */
/* ------------------------------------------------------------------ */

function Knob({ label, value = 50, size = 52 }: { label: string; value?: number; size?: number }) {
  const angle = -135 + (value / 100) * 270;
  const r = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;
  const rad = (angle * Math.PI) / 180;
  const ix = cx + r * 0.55 * Math.sin(rad);
  const iy = cy - r * 0.55 * Math.cos(rad);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="#232326" stroke="#555" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={r - 4} fill="#2a2a2e" />
        {/* pointer line */}
        <line x1={cx} y1={cy} x2={ix} y2={iy} stroke="#d0d0d4" strokeWidth={2} strokeLinecap="round" />
        {/* center dot */}
        <circle cx={cx} cy={cy} r={2} fill="#888" />
      </svg>
      <span className="text-[10px] font-medium tracking-wide text-zinc-300 uppercase">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Vertical meter                                                    */
/* ------------------------------------------------------------------ */

function VerticalMeter({ label, level = 0.6 }: { label: string; level?: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] text-zinc-400 font-medium">{label}</span>
      <div className="relative h-[90px] w-[18px] rounded-sm bg-zinc-900 border border-zinc-700 overflow-hidden">
        {/* fill */}
        <div
          className="absolute bottom-0 left-0 right-0 rounded-sm transition-all duration-100"
          style={{
            height: `${level * 100}%`,
            background: level > 0.85
              ? "linear-gradient(to top, #22c55e, #f59e0b, #ef4444)"
              : level > 0.6
                ? "linear-gradient(to top, #22c55e, #f59e0b)"
                : "#22c55e",
          }}
        />
        {/* ticks */}
        {[0.25, 0.5, 0.75].map(t => (
          <div key={t} className="absolute left-0 right-0 h-px bg-zinc-600" style={{ bottom: `${t * 100}%` }} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Fake waveform bar                                                 */
/* ------------------------------------------------------------------ */

function FakeWaveform({ height = 40, className = "" }: { height?: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#4ade80";
    const bars = Math.floor(w / 3);
    for (let i = 0; i < bars; i++) {
      const amp = Math.random() * 0.7 + 0.1;
      const bh = amp * h * 0.8;
      ctx.fillRect(i * 3, (h - bh) / 2, 2, bh);
    }
  }, []);
  return <canvas ref={canvasRef} width={600} height={height} className={`w-full ${className}`} style={{ height }} />;
}

/* ------------------------------------------------------------------ */
/*  Video tile                                                        */
/* ------------------------------------------------------------------ */

function VideoTile({ participant }: { participant: Participant }) {
  return (
    <div className="relative flex-1 min-h-[120px] rounded bg-zinc-900 border border-zinc-700 overflow-hidden flex items-center justify-center">
      {/* Placeholder gradient for video feed */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center text-xl font-bold text-zinc-300">
          {participant.name[0]}
        </div>
        {!participant.videoOn && (
          <VideoOff className="w-5 h-5 text-zinc-500" />
        )}
      </div>
      {/* Name badge */}
      <div className="absolute bottom-2 left-2 z-10 text-xs text-zinc-200 bg-black/60 rounded px-2 py-0.5">
        {participant.name} - {participant.location}
      </div>
      {/* Audio indicator */}
      {!participant.audioOn && (
        <div className="absolute top-2 right-2 z-10">
          <MicOff className="w-3.5 h-3.5 text-red-400" />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Session Join Screen                                               */
/* ------------------------------------------------------------------ */

function SessionJoinScreen({ onJoin }: { onJoin: (role: SessionView) => void }) {
  const [sessionCode, setSessionCode] = useState("");
  const [name, setName] = useState("");

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-white tracking-wide">W.STUDIO</span>
        <span className="text-lg text-zinc-400 font-light">RECEIVE</span>
      </div>
      <p className="text-zinc-500 text-sm">Join a remote recording session</p>

      <div className="w-full max-w-xs flex flex-col gap-3">
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full rounded bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <input
          type="text"
          placeholder="Session code"
          value={sessionCode}
          onChange={e => setSessionCode(e.target.value)}
          className="w-full rounded bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => onJoin("artist")}
            className="flex-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium py-2 transition-colors"
          >
            Join as Artist
          </button>
          <button
            onClick={() => onJoin("engineer")}
            className="flex-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2 transition-colors"
          >
            Join as Engineer
          </button>
        </div>
      </div>

      <p className="text-[11px] text-zinc-600 mt-4">
        Ask your engineer or artist for the session code
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Talkback button                                                   */
/* ------------------------------------------------------------------ */

function TalkbackButton() {
  const [active, setActive] = useState(false);
  return (
    <button
      onPointerDown={() => setActive(true)}
      onPointerUp={() => setActive(false)}
      onPointerLeave={() => setActive(false)}
      className={`flex items-center gap-1.5 rounded px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? "bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,.5)]"
          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
      }`}
    >
      <Play className="w-3.5 h-3.5" />
      Talk
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Screen share panel (inline placeholder)                           */
/* ------------------------------------------------------------------ */

function ScreenSharePanel() {
  const [sharing, setSharing] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setSharing(!sharing)}
        className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
          sharing ? "bg-green-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
        }`}
      >
        <Monitor className="w-3.5 h-3.5" />
        {sharing ? "Stop Share" : "Share"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main panel (artist or engineer view)                              */
/* ------------------------------------------------------------------ */

function SessionPanel({
  view,
  onClose,
  connectionStatus,
}: {
  view: SessionView;
  onClose: () => void;
  connectionStatus: ConnectionStatus;
}) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [recState, setRecState] = useState<RecordingState>("idle");
  const [autoUpload, setAutoUpload] = useState(true);
  const [vocalLevel] = useState(0.55);
  const [talkbackLevel] = useState(0.35);
  const [takeNum, setTakeNum] = useState(4);

  const isEngineer = view === "engineer";
  const sessionTitle = isEngineer
    ? "Session: Live with Jay - Florida"
    : "Session: Live with Bob - New York";

  const statusColor: Record<ConnectionStatus, string> = {
    connected: "bg-emerald-500 text-white",
    connecting: "bg-yellow-500 text-black",
    disconnected: "bg-red-500 text-white",
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-bold text-white tracking-wide">W.STUDIO</span>
          <span className="text-sm text-zinc-400 font-light">RECEIVE</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-1 text-zinc-400 hover:text-zinc-200"><Menu className="w-4 h-4" /></button>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-200"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {/* ── Session bar ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-700/60">
        <span className="text-xs text-zinc-300 font-medium">{sessionTitle}</span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[connectionStatus]}`}>
            {connectionStatus.toUpperCase()}
          </span>
          <Volume2 className="w-3.5 h-3.5 text-zinc-500" />
          <ScreenSharePanel />
          <button className="p-1 text-zinc-400 hover:text-zinc-200"><X className="w-3.5 h-3.5" /></button>
          <button className="p-1 text-zinc-400 hover:text-zinc-200"><Settings className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* LEFT — Video feeds */}
        <div className="flex flex-col w-[220px] shrink-0 border-r border-zinc-700/60 p-2 gap-2">
          {MOCK_PARTICIPANTS.map(p => (
            <VideoTile key={p.id} participant={p} />
          ))}
          {/* Video controls */}
          <div className="flex items-center justify-center gap-4 py-2 border-t border-zinc-700/60 mt-auto">
            <button
              onClick={() => setMicOn(!micOn)}
              className={`flex flex-col items-center gap-0.5 text-[10px] ${micOn ? "text-zinc-300" : "text-red-400"}`}
            >
              {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              Mute
            </button>
            <TalkbackButton />
            <button className="flex flex-col items-center gap-0.5 text-[10px] text-zinc-300">
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>

        {/* CENTER — Sync + Vocal */}
        <div className="flex flex-col flex-1 min-w-0 p-3 gap-3">
          {/* Sync Controls */}
          <div className="rounded border border-zinc-700 bg-zinc-800/80 p-3">
            <h3 className="text-[11px] font-bold text-zinc-300 tracking-wider uppercase mb-2">Sync Controls</h3>
            <p className="text-center text-xs text-zinc-400 mb-2">— SYNCED: 120 BPM —</p>
            <div className="flex items-center justify-center gap-2">
              <button className="flex items-center gap-1 rounded bg-zinc-700 hover:bg-zinc-600 px-4 py-1.5 text-xs text-zinc-200 font-medium transition-colors">
                <Play className="w-3.5 h-3.5" /> Play
              </button>
              <button className="flex items-center gap-1 rounded bg-red-800/60 hover:bg-red-700/60 px-4 py-1.5 text-xs text-zinc-200 font-medium transition-colors">
                <Square className="w-3.5 h-3.5" /> Stop
              </button>
              <button
                onClick={() => {
                  if (recState === "idle") setRecState("armed");
                  else if (recState === "armed") setRecState("recording");
                  else setRecState("idle");
                }}
                className={`flex items-center gap-1 rounded px-4 py-1.5 text-xs font-medium transition-colors ${
                  recState === "recording"
                    ? "bg-red-600 text-white animate-pulse"
                    : recState === "armed"
                      ? "bg-red-600/70 text-white"
                      : "bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                }`}
              >
                <Circle className="w-3.5 h-3.5" /> Record
              </button>
            </div>
          </div>

          {/* Vocal Input */}
          <div className="rounded border border-zinc-700 bg-zinc-800/80 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold text-zinc-300 tracking-wider uppercase">Vocal Input</h3>
              <div className="flex gap-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <div className="w-2.5 h-2.5 rounded-sm bg-yellow-500" />
                <div className="w-2.5 h-2.5 rounded-sm bg-red-500/40" />
              </div>
            </div>
            <p className="text-center text-xs text-zinc-400 font-medium mb-2">REMOTE VOCAL</p>
            <div className="rounded bg-zinc-900 border border-zinc-700 p-1 mb-3">
              <FakeWaveform height={36} />
            </div>
            <button
              onClick={() => setRecState(recState === "armed" ? "idle" : "armed")}
              className={`w-full rounded py-2 text-xs font-bold tracking-wider transition-colors ${
                recState !== "idle"
                  ? "bg-red-600 text-white"
                  : "bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
              }`}
            >
              ARM RECORD
            </button>
          </div>
        </div>

        {/* RIGHT — Monitoring + Effects */}
        <div className="flex flex-col w-[180px] shrink-0 border-l border-zinc-700/60 p-3 gap-3">
          {/* Monitoring */}
          <div className="rounded border border-zinc-700 bg-zinc-800/80 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold text-zinc-300 tracking-wider uppercase">Monitoring</h3>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-1.5 h-3 rounded-sm bg-zinc-600" />
                ))}
              </div>
            </div>
            <div className="flex justify-center gap-4">
              <VerticalMeter label="Vocal Level" level={vocalLevel} />
              <VerticalMeter label="Talkback Level" level={talkbackLevel} />
            </div>
          </div>

          {/* Effects */}
          <div className="rounded border border-zinc-700 bg-zinc-800/80 p-3">
            <h3 className="text-[11px] font-bold text-zinc-300 tracking-wider uppercase mb-3">Effects</h3>
            <div className="flex justify-center gap-3">
              <Knob label="Comp" value={40} size={46} />
              <Knob label="EQ" value={55} size={46} />
              <Knob label="Reverb" value={30} size={46} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Recording take strip ──────────────────────────────── */}
      <div className="border-t border-zinc-700 bg-zinc-800/90">
        {/* Take waveform */}
        <div className="px-3 pt-2 pb-1">
          <p className="text-[11px] text-zinc-400 mb-1">
            {MOCK_PARTICIPANTS[0].name}'s Vocal Take {takeNum} –{" "}
            {recState === "recording" ? (
              <span className="text-red-400">Recording...</span>
            ) : (
              "Ready"
            )}
          </p>
          <div className="rounded bg-zinc-900/80 border border-zinc-700/60 p-0.5">
            <FakeWaveform height={28} />
          </div>
        </div>

        {/* Transport bar */}
        <div className="flex items-center justify-between px-3 py-1.5 text-[11px]">
          <div className="flex items-center gap-1">
            <button className="flex items-center gap-1 rounded bg-zinc-700/80 hover:bg-zinc-600 px-2 py-1 text-zinc-300">
              <Pause className="w-3 h-3" /> Punch In
            </button>
            <button className="flex items-center gap-1 rounded bg-zinc-700/80 hover:bg-zinc-600 px-2 py-1 text-zinc-300">
              <ChevronLeft className="w-3 h-3" /><ChevronLeft className="w-3 h-3 -ml-1.5" /> Rewind
            </button>
            <button className="flex items-center gap-1 rounded bg-zinc-700/80 hover:bg-zinc-600 px-2 py-1 text-zinc-300">
              <ChevronRight className="w-3 h-3" /><ChevronRight className="w-3 h-3 -ml-1.5" /> Forward
            </button>
          </div>

          {/* REC indicator */}
          <div className="flex items-center gap-2">
            {recState === "recording" ? (
              <span className="flex items-center gap-1 rounded bg-red-700/80 px-2.5 py-1 text-red-100 font-bold animate-pulse">
                <Circle className="w-2.5 h-2.5 fill-red-400 text-red-400" /> REC
                <Circle className="w-2.5 h-2.5 fill-red-400 text-red-400" /> RECORDING...
              </span>
            ) : recState === "armed" ? (
              <span className="flex items-center gap-1 rounded bg-red-700/50 px-2.5 py-1 text-red-300 font-bold">
                <Circle className="w-2.5 h-2.5 fill-red-400 text-red-400" /> ARMED
              </span>
            ) : (
              <span className="text-zinc-500">IDLE</span>
            )}
            {/* Level dots */}
            <div className="flex gap-0.5">
              <div className="w-2 h-2 rounded-sm bg-emerald-500" />
              <div className="w-2 h-2 rounded-sm bg-emerald-500" />
              <div className="w-2 h-2 rounded-sm bg-yellow-500" />
              <div className="w-2 h-2 rounded-sm bg-zinc-600" />
            </div>
          </div>

          {/* Auto upload */}
          <button
            onClick={() => setAutoUpload(!autoUpload)}
            className={`flex items-center gap-1 rounded px-2 py-1 font-medium transition-colors ${
              autoUpload ? "text-emerald-400" : "text-zinc-500"
            }`}
          >
            AUTO UPLOAD: {autoUpload ? "ON" : "OFF"}
            {autoUpload && <Play className="w-3 h-3 text-emerald-400" />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported overlay container                                        */
/* ------------------------------------------------------------------ */

export function RemoteSessionPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [view, setView] = useState<SessionView>("join");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");

  const handleJoin = useCallback((role: SessionView) => {
    setConnectionStatus("connecting");
    setView(role);
    // Simulate connection
    setTimeout(() => setConnectionStatus("connected"), 1500);
  }, []);

  const handleClose = useCallback(() => {
    setView("join");
    setConnectionStatus("disconnected");
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
      <div
        className="relative flex flex-col w-full max-w-[920px] h-[min(600px,85vh)] rounded-lg border border-zinc-600 bg-[#2a2a2e] shadow-2xl overflow-hidden"
        style={{ fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif" }}
      >
        {view === "join" ? (
          <SessionJoinScreen onJoin={handleJoin} />
        ) : (
          <SessionPanel view={view} onClose={handleClose} connectionStatus={connectionStatus} />
        )}
      </div>
    </div>
  );
}
