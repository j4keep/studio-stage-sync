/**
 * W.STUDIO Live Session Screen — Plugin-Inspired UI (v2 rebuild)
 *
 * This page intentionally mirrors the JUCE AU plugin's visual language
 * (dark panel, big LIVE button, vertical meters, MUTE/LISTEN/TALK row,
 * GAIN dial, Artist 1–12 selector). All Lovable-side knobs/buttons here
 * are VISUAL PLACEHOLDERS — the AU plugin remains the real controller for
 * Logic-side audio (LIVE / LISTEN / MUTE / GAIN / TALK).
 *
 * Audio routing:
 *  - Artist side: mic captured (via StudioMediaContext); local meter shown.
 *  - Engineer side: NO audible playback of artist mic in the browser.
 *    Browser stays silent; the AU plugin (running on the engineer Mac)
 *    receives artist audio via the persistent engineer→127.0.0.1 relay
 *    started in StudioMediaContext.
 *
 * Booking, session join, navigation, and DB persistence are untouched.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Power,
  ChevronDown,
  Radio,
  LogOut,
  Mic,
  MicOff,
  Headphones,
  MessageSquare,
  Activity,
} from "lucide-react";
import { useSession } from "./SessionContext";
import { useStudioMedia } from "../media/StudioMediaContext";
import { useBookingTimer } from "../booking/BookingTimerContext";
import { SessionTimerBar } from "../booking/SessionTimerBar";

/* Plugin palette (matches JUCE AU shell). */
const C = {
  shellTop: "#0a0d12",
  shellBot: "#04060a",
  panel: "#0e1218",
  panelEdge: "#1a2028",
  inset: "#05070b",
  insetEdge: "#171c24",
  cyan: "#2ee0d8",
  cyanGlow: "rgba(46,224,216,0.55)",
  text: "#eef2f7",
  dim: "#6b7480",
  label: "#9aa3b0",
  green: "#4ade60",
  yellow: "#f5c842",
  red: "#ef4444",
};

const ARTIST_SLOTS = Array.from({ length: 12 }, (_, i) => i + 1);

/* ───────── Local components ───────── */

function PluginButton({
  label,
  active = false,
  onClick,
  accent = false,
  disabled = false,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-[4px] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.12em] transition"
      style={{
        background: active
          ? `linear-gradient(180deg, ${C.cyan} 0%, #1ba9a2 100%)`
          : `linear-gradient(180deg, #1a2028 0%, #0c1116 100%)`,
        color: active ? "#04141a" : accent ? C.cyan : C.text,
        border: `1px solid ${active ? C.cyan : accent ? "rgba(46,224,216,0.45)" : "#222a33"}`,
        boxShadow: active
          ? `0 0 12px ${C.cyanGlow}, inset 0 1px 0 rgba(255,255,255,0.2)`
          : `inset 0 1px 0 rgba(255,255,255,0.04)`,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        minWidth: 86,
      }}
    >
      {label}
    </button>
  );
}

/** Decorative gain dial (visual only — AU plugin owns real gain). */
function GainDial({ value = 0.6, size = 168 }: { value?: number; size?: number }) {
  const angle = -135 + value * 270;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 12;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const a = toRad(angle);
  const indX = cx + Math.cos(a) * (r - 14);
  const indY = cy + Math.sin(a) * (r - 14);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id="dialBody" cx="38%" cy="32%">
          <stop offset="0%" stopColor="#9ea4ac" />
          <stop offset="55%" stopColor="#5a6068" />
          <stop offset="100%" stopColor="#1d2128" />
        </radialGradient>
        <radialGradient id="dialCap" cx="42%" cy="36%">
          <stop offset="0%" stopColor="#b8bec6" />
          <stop offset="100%" stopColor="#3a3f47" />
        </radialGradient>
      </defs>
      {/* Outer cyan arc */}
      <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="#15323a" strokeWidth={2} />
      <path
        d={describeArc(cx, cy, r + 4, -135, angle)}
        stroke={C.cyan}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${C.cyanGlow})` }}
      />
      {/* Tick labels (visual only) */}
      {[
        { l: "0", a: -135 },
        { l: "3", a: -90 },
        { l: "6", a: -45 },
        { l: "9", a: 45 },
        { l: "12", a: 135 },
      ].map((t) => {
        const ra = toRad(t.a);
        const lx = cx + Math.cos(ra) * (r + 18);
        const ly = cy + Math.sin(ra) * (r + 18);
        return (
          <text
            key={t.l}
            x={lx}
            y={ly}
            fill={C.dim}
            fontSize={10}
            textAnchor="middle"
            dominantBaseline="middle"
            fontWeight={600}
          >
            {t.l}
          </text>
        );
      })}
      <circle cx={cx} cy={cy} r={r} fill="url(#dialBody)" stroke="#0a0d12" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={r * 0.7} fill="url(#dialCap)" stroke="#10141a" strokeWidth={1} />
      <line x1={cx} y1={cy} x2={indX} y2={indY} stroke={C.cyan} strokeWidth={3} strokeLinecap="round" />
      <circle cx={indX} cy={indY} r={4} fill={C.cyan} />
    </svg>
  );
}

function describeArc(cx: number, cy: number, r: number, start: number, end: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const s = toRad(start);
  const e = toRad(end);
  const x1 = cx + Math.cos(s) * r;
  const y1 = cy + Math.sin(s) * r;
  const x2 = cx + Math.cos(e) * r;
  const y2 = cy + Math.sin(e) * r;
  const large = end - start > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

/** Big circular LIVE / CONNECTED indicator (visual). */
function LiveOrb({ live, size = 168 }: { live: boolean; size?: number }) {
  return (
    <div
      className="relative flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: live
          ? `radial-gradient(circle at 40% 35%, #1c8b85 0%, #0d3b39 70%, #061a19 100%)`
          : `radial-gradient(circle at 40% 35%, #21262e 0%, #0c1015 70%, #04060a 100%)`,
        border: `3px solid ${live ? C.cyan : "#1d242c"}`,
        boxShadow: live
          ? `0 0 30px ${C.cyanGlow}, inset 0 0 24px rgba(46,224,216,0.35)`
          : "inset 0 0 18px rgba(0,0,0,0.6)",
      }}
    >
      <div
        className="absolute inset-3 rounded-full"
        style={{
          border: `1px solid ${live ? "rgba(46,224,216,0.4)" : "#1a2028"}`,
        }}
      />
      <span
        className="select-none font-black tracking-widest"
        style={{
          color: live ? "#eafffd" : C.dim,
          fontSize: size * 0.18,
          letterSpacing: "0.18em",
          textShadow: live ? `0 0 12px ${C.cyanGlow}` : "none",
        }}
      >
        {live ? "LIVE" : "OFF"}
      </span>
    </div>
  );
}

/** Slim vertical meter with -10 / -2 / -10 labels (stereo). */
function VerticalMeter({ level, height = 168 }: { level: number; height?: number }) {
  const segs = 24;
  const active = Math.round(Math.min(1, Math.max(0, level)) * segs);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex flex-col justify-between" style={{ height, fontSize: 9, color: C.dim }}>
        <span>-10</span>
        <span>-2</span>
        <span>-10</span>
      </div>
      {[0, 1].map((ch) => (
        <div
          key={ch}
          className="flex flex-col-reverse gap-[2px] rounded-[2px] p-[2px]"
          style={{
            height,
            width: 10,
            background: C.inset,
            border: `1px solid ${C.insetEdge}`,
          }}
        >
          {Array.from({ length: segs }).map((_, i) => {
            const on = i < active;
            const pct = (i + 1) / segs;
            let col = C.green;
            if (pct > 0.55) col = C.yellow;
            if (pct > 0.82) col = C.red;
            return (
              <div
                key={i}
                className="flex-1 rounded-[1px]"
                style={{
                  background: on ? col : "#10151c",
                  boxShadow: on ? `0 0 3px ${col}66` : undefined,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ───────── Main screen ───────── */

export default function UnifiedSessionScreen() {
  const navigate = useNavigate();
  const {
    sessionId,
    sessionDisplayName,
    role,
    connection,
    leaveSession,
    muted,
    toggleMute,
    live,
  } = useSession();

  const { localMicLevel, remoteMicLevel, hasRemoteAudio, engineerRelayStats } = useStudioMedia();

  const {
    totalBookedMinutes,
    remainingSeconds,
    warningLevel,
    phase,
    timerRunning,
  } = useBookingTimer();

  const [artistSlot, setArtistSlot] = useState(1);
  const [listenOn, setListenOn] = useState(false);
  const [talkOn, setTalkOn] = useState(false);
  const [bypass, setBypass] = useState(false);

  // If no session — bounce back to join page
  useEffect(() => {
    if (!sessionId || !role) {
      navigate("/wstudio/session/join", { replace: true });
    }
  }, [sessionId, role, navigate]);

  const isArtist = role === "artist";
  const isEngineer = role === "engineer";

  // Meter level: artist sees own mic; engineer sees inbound artist meter.
  const meterLevel = isArtist ? localMicLevel : remoteMicLevel;

  // CONNECTED status sources:
  //  - Artist: WebRTC connection state
  //  - Engineer: persistent relay (artist → AU plugin) reports CONNECTED when packets flow
  const connected = isEngineer
    ? engineerRelayStats?.state === "CONNECTED"
    : connection === "connected" && hasRemoteAudio;

  const statusLabel = useMemo(() => {
    if (isEngineer) {
      if (engineerRelayStats?.state === "CONNECTED") return "Plugin Connected";
      if (engineerRelayStats?.state === "CONNECTING") return "Connecting to Plugin…";
      return "Waiting for Plugin";
    }
    if (connection === "connected") return "Session Connected";
    if (connection === "connecting") return "Connecting…";
    return "Disconnected";
  }, [isEngineer, engineerRelayStats?.state, connection]);

  const handleEnd = () => {
    leaveSession();
    navigate("/wstudio/session/join", { replace: true });
  };

  return (
    <div
      className="flex min-h-[100dvh] w-full flex-col items-center px-3 pb-6 pt-3"
      style={{
        background: `linear-gradient(180deg, ${C.shellTop} 0%, ${C.shellBot} 100%)`,
      }}
    >
      {/* Timer bar (unchanged booking system) */}
      {totalBookedMinutes > 0 && (
        <div className="mb-3 w-full max-w-[640px]">
          <SessionTimerBar
            totalBookedMinutes={totalBookedMinutes}
            remainingSeconds={remainingSeconds}
            warningLevel={warningLevel}
            phase={phase}
            timerRunning={timerRunning}
            compact
          />
        </div>
      )}

      {/* Plugin shell */}
      <div
        className="w-full max-w-[640px] overflow-hidden rounded-[10px]"
        style={{
          background: `linear-gradient(180deg, #0e1218 0%, #05080c 100%)`,
          border: `1px solid ${C.panelEdge}`,
          boxShadow: `0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)`,
        }}
      >
        {/* Top strip: power + bypass-mode dropdown */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ background: "#0a0d12", borderBottom: `1px solid ${C.panelEdge}` }}>
          <button
            onClick={() => setBypass((b) => !b)}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{
              background: bypass ? "#222" : `radial-gradient(circle at 30% 30%, #4a5058 0%, #1c2028 100%)`,
              border: `1px solid ${bypass ? "#333" : C.cyan}`,
              boxShadow: bypass ? "none" : `0 0 8px ${C.cyanGlow}`,
            }}
            aria-label="Bypass"
          >
            <Power className="h-4 w-4" style={{ color: bypass ? C.dim : C.cyan }} />
          </button>
          <div
            className="flex flex-1 items-center justify-between rounded-[4px] px-3 py-1.5"
            style={{ background: C.inset, border: `1px solid ${C.insetEdge}`, color: C.text, fontSize: 12 }}
          >
            <span>Manual</span>
            <ChevronDown className="h-3.5 w-3.5" style={{ color: C.dim }} />
          </div>
          <button
            onClick={handleEnd}
            className="flex items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider"
            style={{ background: "#2a0e0e", color: "#fca5a5", border: "1px solid #4a1818" }}
            aria-label="End session"
          >
            <LogOut className="h-3.5 w-3.5" /> End
          </button>
        </div>

        {/* Header band: W.STUDIO logo + Artist selector + Zoom */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{
            background: `linear-gradient(180deg, ${C.panel} 0%, #0a0e14 100%)`,
            borderBottom: `1px solid ${C.panelEdge}`,
          }}
        >
          <div className="flex items-center">
            <span
              className="text-[22px] font-black italic"
              style={{ color: C.text, fontFamily: "'Inter', sans-serif" }}
            >
              W
            </span>
            <span
              className="mx-0.5 text-[22px] font-black"
              style={{
                color: C.cyan,
                transform: "skewX(-20deg)",
                display: "inline-block",
                textShadow: `0 0 6px ${C.cyanGlow}`,
              }}
            >
              /
            </span>
            <span className="text-[22px] font-black tracking-[0.22em]" style={{ color: C.text }}>
              _STUDIO
            </span>
          </div>
          <div className="flex-1" />
          {/* Artist selector */}
          <select
            value={artistSlot}
            onChange={(e) => setArtistSlot(Number(e.target.value))}
            className="rounded-[4px] px-3 py-1.5 text-[12px] font-semibold focus:outline-none"
            style={{ background: C.inset, color: C.text, border: `1px solid ${C.insetEdge}`, minWidth: 110 }}
          >
            {ARTIST_SLOTS.map((n) => (
              <option key={n} value={n}>
                Artist {n}
              </option>
            ))}
          </select>
          <div
            className="rounded-[4px] px-3 py-1.5 text-[12px] font-semibold"
            style={{ background: C.inset, color: C.text, border: `1px solid ${C.insetEdge}` }}
          >
            100%
          </div>
        </div>

        {/* Status bar */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{
            background: "#0c1117",
            borderBottom: `1px solid ${C.panelEdge}`,
          }}
        >
          <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: C.text }}>
            <Radio className="h-3.5 w-3.5" style={{ color: connected ? C.green : C.dim }} />
            <span className="truncate">
              {sessionDisplayName || `Session ${sessionId}`} — {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: connected ? C.green : C.dim,
                boxShadow: connected ? `0 0 6px ${C.green}` : "none",
              }}
            />
            <span style={{ color: connected ? C.green : C.dim }}>{connected ? "CONNECTED" : "OFFLINE"}</span>
          </div>
        </div>

        {/* Main body: Mic toggle | GAIN dial | LIVE orb | meters */}
        <div className="px-4 py-5" style={{ background: "#0a0e14" }}>
          {/* Mic toggle row */}
          <div className="mb-4 flex items-center gap-2">
            <button
              onClick={isArtist ? toggleMute : undefined}
              disabled={!isArtist}
              className="flex h-5 w-9 items-center rounded-full transition"
              style={{
                background: !muted ? C.cyan : "#1a2028",
                border: `1px solid ${!muted ? C.cyan : "#222a33"}`,
                boxShadow: !muted ? `0 0 6px ${C.cyanGlow}` : "none",
                padding: 2,
                opacity: isArtist ? 1 : 0.6,
                cursor: isArtist ? "pointer" : "default",
              }}
              aria-label="Mic toggle"
            >
              <div
                className="h-3.5 w-3.5 rounded-full transition"
                style={{
                  background: "#fff",
                  transform: !muted ? "translateX(14px)" : "translateX(0)",
                }}
              />
            </button>
            <span className="text-[14px] font-bold" style={{ color: C.text }}>
              Mic
            </span>
            <span className="text-[10px]" style={{ color: C.dim }}>
              slot {artistSlot - 1}
            </span>
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between gap-3 sm:gap-5">
            {/* GAIN dial */}
            <div className="flex flex-col items-center gap-2">
              <GainDial value={0.6} size={120} />
            </div>

            {/* LIVE orb */}
            <div className="flex flex-col items-center gap-2">
              <LiveOrb live={connected} size={130} />
            </div>

            {/* Vertical meter (stereo) */}
            <div className="flex items-center">
              <VerticalMeter level={meterLevel} height={130} />
            </div>
          </div>

          {/* Action button row (visual placeholders — AU plugin owns actual control) */}
          <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-center sm:gap-3">
            <PluginButton label="Gain" accent />
            <PluginButton
              label="Mute"
              active={muted}
              onClick={isArtist ? toggleMute : undefined}
              disabled={!isArtist}
            />
            <PluginButton label="Listen" active={listenOn} onClick={() => setListenOn((v) => !v)} />
            <PluginButton label="Talk" active={talkOn} onClick={() => setTalkOn((v) => !v)} />
            <div
              className="flex items-center justify-between rounded-[4px] px-3 py-2 text-[12px] font-semibold"
              style={{
                background: C.inset,
                color: C.text,
                border: `1px solid ${C.insetEdge}`,
                minWidth: 90,
              }}
            >
              Stereo <ChevronDown className="ml-2 h-3.5 w-3.5" style={{ color: C.dim }} />
            </div>
          </div>

          {/* Tiny role + relay diagnostic strip */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[10px] uppercase tracking-wider" style={{ color: C.dim }}>
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {isArtist ? "Artist" : "Engineer"} · {role}
            </span>
            {isArtist && (
              <span className="flex items-center gap-1">
                {muted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                Mic {muted ? "muted" : "live"}
              </span>
            )}
            {isEngineer && (
              <>
                <span className="flex items-center gap-1">
                  <Headphones className="h-3 w-3" />
                  Browser silent · AU plugin only
                </span>
                {engineerRelayStats && (
                  <span>
                    pkts {engineerRelayStats.packetsPosted ?? 0} · fail {engineerRelayStats.packetsFailed ?? 0}
                  </span>
                )}
              </>
            )}
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              live: {live.artistJoined ? "A✓" : "A·"} {live.engineerJoined ? "E✓" : "E·"}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-center py-2 text-[11px] font-semibold tracking-[0.2em]"
          style={{ background: "#06090d", color: C.dim, borderTop: `1px solid ${C.panelEdge}` }}
        >
          W.STUDIO · slot {artistSlot - 1}
        </div>
      </div>

      {/* Note for engineer about audio path */}
      {isEngineer && (
        <p className="mt-4 max-w-[640px] text-center text-[11px]" style={{ color: C.dim }}>
          Browser playback is intentionally silent. Artist mic is routed to the W.STUDIO AU plugin on
          your Mac (127.0.0.1:47999). Use Logic + the plugin to monitor, mute, gain, and talk.
        </p>
      )}
    </div>
  );
}
