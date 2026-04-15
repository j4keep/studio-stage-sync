import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSession } from "./SessionContext";
import { useStudioMedia } from "../media/StudioMediaContext";
import { useBookingTimer } from "../booking/BookingTimerContext";
import { SessionTimerBar } from "../booking/SessionTimerBar";
import { SessionControlsLockOverlay } from "../booking/SessionControlsLockOverlay";
import { ExtensionApprovalDialog } from "../booking/ExtensionApprovalDialog";
import { formatCurrency } from "../booking/bookingTypes";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBridgeOutputDevice } from "../bridge/useBridgeOutputDevice";
import PluginPanel from "./PluginPanel";

const canScreenShare = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

/* ─────────────────────────────────────────────
   STYLE CONSTANTS (matching the reference image)
   ───────────────────────────────────────────── */
const C = {
  shell: "#2b2d32",
  shellEdge: "#3d3f44",
  shellDark: "#1e1f23",
  panel: "#282a2e",
  panelLight: "#323438",
  panelDark: "#1c1d21",
  panelBorder: "#3a3c41",
  inset: "#141517",
  insetBorder: "#2a2c30",
  track: "#111214",
  text: "#e8e8ea",
  label: "#9a9ca2",
  dim: "#656770",
  green: "#4ade60",
  yellow: "#f5c842",
  red: "#ef4444",
  blue: "#3b9dff",
  white: "#ffffff",
  /* Mainstream accent colors */
  acMagenta: "#e040a0",
  acGreen: "#40e060",
  acOrange: "#f08030",
  acCyan: "#40d0e0",
  acPurple: "#a040e0",
  acLime: "#60e040",
};

/* ─── Interactive SVG Knob ─── */
function Knob({ value = 0.5, size = 68, label, onChange, accent }: { value?: number; size?: number; label?: string; onChange?: (v: number) => void; accent?: string }) {
  const angle = -135 + value * 270;
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const ticks = 13;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dragRef = useRef<{ startY: number; startVal: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!onChange) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startY: e.clientY, startVal: value };
    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const delta = (dragRef.current.startY - ev.clientY) / 120;
      onChange(Math.min(1, Math.max(0, dragRef.current.startVal + delta)));
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div onPointerDown={onPointerDown} style={{ cursor: onChange ? "ns-resize" : "default", touchAction: "none", userSelect: "none" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ pointerEvents: "none" }}>
          {Array.from({ length: ticks }).map((_, i) => {
            const a = toRad(-135 + (i / (ticks - 1)) * 270);
            return (<line key={i} x1={cx + (r + 3) * Math.cos(a)} y1={cy + (r + 3) * Math.sin(a)} x2={cx + (r + 6) * Math.cos(a)} y2={cy + (r + 6) * Math.sin(a)} stroke={C.dim} strokeWidth={1} strokeLinecap="round" />);
          })}
          <circle cx={cx} cy={cy} r={r} fill={`url(#knobBody${size})`} stroke={C.shellDark} strokeWidth={2} />
          <circle cx={cx} cy={cy} r={r * 0.62} fill={`url(#knobCap${size})`} stroke={C.panelBorder} strokeWidth={1} />
          <line x1={cx} y1={cy} x2={cx + (r * 0.52) * Math.cos(toRad(angle))} y2={cy + (r * 0.52) * Math.sin(toRad(angle))} stroke={accent || C.white} strokeWidth={2.5} strokeLinecap="round" />
          {accent && <circle cx={cx} cy={cy} r={r} fill="none" stroke={accent} strokeWidth={1.5} opacity={0.35} />}
          <defs>
            <radialGradient id={`knobBody${size}`} cx="38%" cy="34%"><stop offset="0%" stopColor="#484a4e" /><stop offset="60%" stopColor="#2a2c30" /><stop offset="100%" stopColor="#1a1b1e" /></radialGradient>
            <radialGradient id={`knobCap${size}`} cx="40%" cy="36%"><stop offset="0%" stopColor="#3a3c40" /><stop offset="100%" stopColor="#1e1f22" /></radialGradient>
          </defs>
        </svg>
      </div>
      {label && <span style={{ color: C.text, fontSize: 12, fontWeight: 500 }}>{label}</span>}
    </div>
  );
}

/** Vertical tick-mark indicator for MONITORING setpoints — static gain style, NOT a live VU meter. */
function ControlLevelLadder({
  level = 0.5,
  height = 90,
  accent,
}: {
  level?: number;
  height?: number;
  accent?: string;
}) {
  const segs = 16;
  const activeIdx = Math.round(level * segs);
  return (
    <div className="relative flex flex-col-reverse gap-[2px]" style={{ height, width: 10 }} aria-hidden>
      {Array.from({ length: segs }).map((_, i) => {
        const isSetpoint = i === activeIdx - 1;
        return (
          <div
            key={i}
            className="flex-1 rounded-[1px]"
            style={{
              backgroundColor: isSetpoint
                ? (accent ?? "#888")
                : "#1a1b1e",
              border: `1px solid ${isSetpoint ? (accent ? accent + "88" : "#555") : "#222325"}`,
              boxShadow: isSetpoint ? `0 0 4px ${accent ?? "#888"}44` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

function Fader({ value = 0.5, height = 90, onChange }: { value?: number; height?: number; onChange?: (v: number) => void }) {
  const trackH = height - 16;
  const thumbY = trackH - value * trackH;
  const dragRef = useRef<{ startY: number; startVal: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (!onChange) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startY: e.clientY, startVal: value };
    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const delta = (dragRef.current.startY - ev.clientY) / trackH;
      onChange(Math.min(1, Math.max(0, dragRef.current.startVal + delta)));
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };
  return (
    <div className="relative" style={{ width: 18, height, cursor: onChange ? "ns-resize" : "default", touchAction: "none", userSelect: "none" }} onPointerDown={onPointerDown}>
      <div className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ top: 8, width: 4, height: trackH, background: `linear-gradient(180deg, ${C.inset} 0%, #0d0e10 100%)`, border: `1px solid ${C.insetBorder}` }} />
      <div className="absolute left-1/2 -translate-x-1/2 rounded-[2px]" style={{ top: 8 + thumbY - 7, width: 20, height: 14, background: `linear-gradient(180deg, #999 0%, #666 100%)`, border: `1px solid ${C.shellEdge}`, boxShadow: `0 2px 6px rgba(0,0,0,0.5)` }}>
        <div className="absolute left-1/2 top-[4px] h-[1px] w-[10px] -translate-x-1/2 bg-[#555]" />
        <div className="absolute left-1/2 top-[7px] h-[1px] w-[10px] -translate-x-1/2 bg-[#555]" />
      </div>
    </div>
  );
}

function HorizontalMeter({ level }: { level: number }) {
  return (
    <div className="overflow-hidden rounded-sm" style={{ height: 6, background: C.track, border: `1px solid ${C.insetBorder}` }}>
      <div className="h-full rounded-sm transition-[width] duration-75" style={{ width: `${Math.min(100, level * 100)}%`, background: `linear-gradient(90deg, ${C.green} 0%, ${C.yellow} 55%, ${C.red} 100%)` }} />
    </div>
  );
}

function SpectrumBars({ level }: { level: number }) {
  const bars = 48;
  const active = Math.round(level * bars);
  return (
    <div className="flex items-end justify-center gap-[2px]" style={{ height: 22 }}>
      {Array.from({ length: bars }).map((_, i) => {
        const on = i < active;
        const pct = (i + 1) / bars;
        let color = C.green;
        if (pct > 0.55) color = C.yellow;
        if (pct > 0.78) color = C.red;
        return (<div key={i} className="rounded-[1px]" style={{ width: 3, height: 18, backgroundColor: on ? color : "#1e1f23" }} />);
      })}
    </div>
  );
}

function FreqLabels() {
  const labels = ["∞", "350", "5.4k", "700", "320", "100", "50", "20"];
  return (
    <div className="flex justify-between px-1" style={{ fontSize: 7, color: C.dim, letterSpacing: "0.08em" }}>
      {labels.map((l) => (<span key={l}>{l}</span>))}
    </div>
  );
}

function Waveform({ recording, takeCaptured }: { recording: boolean; takeCaptured?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    const draw = (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = C.track;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#1e1f23";
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
      ctx.strokeStyle = recording ? "#8a8c92" : takeCaptured ? "#6b7280" : "#3a3c41";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const spd = recording ? t * 0.003 : 0;
        let amp: number;
        if (takeCaptured && !recording) {
          amp = Math.sin(x * 0.028) * 13 + Math.sin(x * 0.065) * 8 + Math.sin(x * 0.11) * 5;
        } else {
          amp = Math.sin(x * 0.028 + spd) * 14 + Math.sin(x * 0.065 + spd * 0.7) * 9 + Math.sin(x * 0.14 + spd * 1.4) * 4;
        }
        const taper = 0.4 + 0.6 * Math.sin((x / w) * Math.PI);
        ctx.lineTo(x, h / 2 + amp * taper);
      }
      ctx.stroke();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [recording, takeCaptured]);
  return <canvas ref={ref} width={1200} height={64} className="block h-[40px] w-full" />;
}

function Panel({ children, style, className = "", accent }: { children: React.ReactNode; style?: React.CSSProperties; className?: string; accent?: string }) {
  return (
    <div className={`overflow-hidden rounded-[4px] ${className}`} style={{
      background: `linear-gradient(180deg, ${C.panelLight} 0%, ${C.panelDark} 100%)`,
      border: accent ? `1.5px solid ${accent}` : `1px solid ${C.panelBorder}`,
      boxShadow: accent ? `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 12px ${accent}30, 0 1px 0 rgba(255,255,255,0.02)` : `inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 0 rgba(255,255,255,0.02)`,
      ...style,
    }}>{children}</div>
  );
}

function Inset({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-[3px] ${className}`} style={{ background: C.inset, border: `1px solid ${C.insetBorder}`, boxShadow: `inset 0 1px 3px rgba(0,0,0,0.6)`, ...style }}>{children}</div>
  );
}

function TBtn({ sym, label, disabled = false }: { sym: string; label: string; disabled?: boolean }) {
  return (
    <button disabled={disabled} className="flex items-center justify-center gap-2 rounded-[3px] px-5 py-2 text-[14px] font-semibold" style={{
      background: `linear-gradient(180deg, ${C.panelLight} 0%, ${C.panelDark} 100%)`,
      border: `1px solid ${C.panelBorder}`, color: C.text, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05)`,
      opacity: disabled ? 0.4 : 1, cursor: disabled ? "not-allowed" : "pointer", minWidth: 120,
    }}>
      <span className="font-mono tracking-tight">{sym}</span>
      <span>{label}</span>
    </button>
  );
}

/* ─── Live Video Feed ─── */
function VideoFeed({
  stream,
  mirrored,
  /** Local preview: true (default). Remote peer: false so WebRTC audio is audible. */
  muted = true,
  /** Output level0–1 for remote monitoring (local preview typically unused). */
  volume = 1,
}: {
  stream: MediaStream | null;
  mirrored?: boolean;
  muted?: boolean;
  volume?: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream ?? null;
    el.volume = Math.min(1, Math.max(0, volume));
    if (stream) {
      el.play().catch((err) => {
        console.warn("[W.Studio video]", "play() blocked:", err?.message);
        // Retry on next user interaction
        const retryPlay = () => {
          el.play().catch(() => {});
          document.removeEventListener("click", retryPlay);
          document.removeEventListener("touchstart", retryPlay);
        };
        document.addEventListener("click", retryPlay, { once: true });
        document.addEventListener("touchstart", retryPlay, { once: true });
      });
    }
  }, [stream, volume]);
  if (!stream) return null;
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className="absolute inset-0 h-full w-full object-cover"
      style={mirrored ? { transform: "scaleX(-1)" } : undefined}
    />
  );
}

/* ─── Inline Join Session (shown in video placeholder when no session) ─── */
function JoinSessionInline({ onJoin }: { onJoin: () => void }) {
  return (
    <button
      onClick={onJoin}
      className="mt-2 rounded-lg px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide"
      style={{
        background: "linear-gradient(180deg, #f59e0b 0%, #b45309 100%)",
        color: "#fff",
        border: "1px solid rgba(245,158,11,0.5)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      Join Session
    </button>
  );
}

/* ─── Overlay action buttons on video tiles ─── */
function VideoTileActions({
  hasSession,
  onJoin,
  expanded,
  onToggleExpand,
}: {
  hasSession: boolean;
  onJoin: () => void;
  onEnd?: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  isMobile?: boolean;
}) {
  return (
    <>
      {/* Join button bottom-left (only when no session) */}
      {!hasSession && (
        <div className="absolute bottom-2 left-2 z-10">
          <button
            onClick={onJoin}
            className="rounded px-2 py-1 text-[9px] font-bold uppercase tracking-wide"
            style={{
              background: "linear-gradient(180deg, #f59e0b 0%, #b45309 100%)",
              color: "#fff",
              border: "1px solid rgba(245,158,11,0.5)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
            }}
          >
            Join
          </button>
        </div>
      )}
      {/* Connection indicator bottom-left (when in session) */}
      {hasSession && (
        <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 rounded px-2 py-1" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="h-[6px] w-[6px] rounded-full" style={{ background: C.green, boxShadow: `0 0 4px ${C.green}` }} />
          <span style={{ color: "#e8e8ea", fontSize: 9, fontWeight: 600 }}>LIVE</span>
        </div>
      )}
      {/* Expand button bottom-right */}
      <div className="absolute bottom-2 right-2 z-10">
        <button
          onClick={onToggleExpand}
          className="rounded px-1.5 py-1 text-[9px] font-bold"
          style={{
            background: "rgba(0,0,0,0.7)",
            color: "#e8e8ea",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          {expanded ? "▾" : "⛶"}
        </button>
      </div>
    </>
  );
}

/* ─── Expanded video overlay ─── */
function ExpandedVideoOverlay({
  stream,
  mirrored,
  label,
  screenShareStream,
  audioMuted = true,
  volume = 1,
  onClose,
}: {
  stream: MediaStream | null;
  mirrored?: boolean;
  label: string;
  screenShareStream?: MediaStream | null;
  audioMuted?: boolean;
  volume?: number;
  onClose: () => void;
}) {
  const vidRef = useRef<HTMLVideoElement>(null);
  const activeStream = screenShareStream || stream;
  const isMirrored = screenShareStream ? false : mirrored;

  useEffect(() => {
    const el = vidRef.current;
    if (!el) return;
    el.srcObject = activeStream ?? null;
    el.volume = Math.min(1, Math.max(0, volume));
    if (activeStream) void el.play().catch(() => {});
  }, [activeStream, volume]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: "#000" }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ background: "rgba(0,0,0,0.9)" }}>
        <span style={{ color: "#e8e8ea", fontSize: 14, fontWeight: 600 }}>{label}</span>
        <button
          onClick={onClose}
          className="rounded px-3 py-1 text-[11px] font-bold uppercase"
          style={{
            background: "rgba(255,255,255,0.1)",
            color: "#e8e8ea",
            border: "1px solid rgba(255,255,255,0.2)",
          }}
        >
          ✕ Close
        </button>
      </div>
      <div className="relative flex-1">
        {activeStream ? (
          <video
            ref={vidRef}
            autoPlay
            playsInline
            muted={audioMuted}
            className="absolute inset-0 h-full w-full object-contain"
            style={isMirrored ? { transform: "scaleX(-1)" } : undefined}
          />
        ) : (
          <div className="flex h-full items-center justify-center" style={{ color: "#656770" }}>
            No stream available
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   UNIFIED SESSION SCREEN
   ═══════════════════════════════════════════════════════════ */
export default function UnifiedSessionScreen() {
  const navigate = useNavigate();
  const {
    role, connection, sessionDisplayName, muted, toggleMute, talkbackHeld, beginTalkback, endTalkback,
       live, setSessionRecording, setSessionPlaying, setSessionRecordArmed, updateSessionMonitorLevels, updateSessionHeadphoneLevel,
    demoClock, leaveSession, screenSharing, toggleScreenShare, collaborationShareActive,
    sessionId,
  } = useSession();

  const {
    localStream,
    remoteStream,
    remoteStreamForPlayback,
    localScreenPreview,
    localMicLevel,
    localTalkbackTxLevel,
    remoteMicLevel,
    hasRemoteAudio,
    engineerDawVocalIn1,
    engineerBridgeVocalLevel,
    engineerDawReturnLevel,
    dawReturnActive,
  } = useStudioMedia();

  const {
    routingError: bridgeRoutingError,
    routed: bridgeRouted,
  } = useBridgeOutputDevice(role === "engineer" ? engineerDawVocalIn1 ?? null : null);

  const {
    booking, totalBookedMinutes, remainingSeconds: bookingRemaining, warningLevel, timerRunning, phase, pendingExtension,
    sessionValueTotal, startSessionTimer, requestExtension, approveExtension, declineExtension, engineerContinueSession,
    extensionModalOpen, setExtensionModalOpen, controlsLocked, sessionRates,
  } = useBookingTimer();

  const { user } = useAuth();

  const isEngineer = role === "engineer";
  const isArtist = role === "artist";
  /** Monitor mix is engineer-driven; artist UI reflects synced `live` values only. */
  const monitorAdjust = isEngineer ? updateSessionMonitorLevels : undefined;
  const recording = live.recording;
  const playing = live.playing;
  const armed = live.recordArmed;
  const takeCaptured = live.takeCapturedThisSession;
  const vocalLevel = live.vocalLevel;
  const talkbackLevel = live.talkbackLevel;
  const headphoneLevel = isEngineer ? live.headphoneLevelEngineer : live.headphoneLevelArtist;
  const cueMix = live.cueMix;
  const peerPtt = isEngineer ? live.artistPtt : live.engineerPtt;
  /** Hide analyser noise floor in live meters only; monitoring uses raw knob values. */
  const meterDisplay = (x: number) => (x < 0.04 ? 0 : x);
  const spectrumLevel = Math.min(
    1,
    Math.max(
      meterDisplay(localMicLevel),
      meterDisplay(localTalkbackTxLevel),
      hasRemoteAudio ? meterDisplay(remoteMicLevel) : 0,
    ),
  );
  const hasBooking = !!booking && booking.bookedMinutes > 0;
  const isMobile = useIsMobile();

  // Determine which stream goes where based on role (playback stream = processed for artist talkback/HP)
  const artistStream = isArtist ? localStream : remoteStreamForPlayback;
  const engineerStream = isEngineer ? localStream : remoteStreamForPlayback;
  const artistMirrored = isArtist; // mirror local preview
  const engineerMirrored = isEngineer;
  const screenShareViewStream = isEngineer ? localScreenPreview : (collaborationShareActive ? remoteStreamForPlayback : null);
  const remoteTileVolume = 1;

  const vocalTakeTitle = recording
    ? (isMobile ? "Rec..." : "Recording...")
    : takeCaptured
      ? "Take saved"
      : armed
        ? "Armed — ready"
        : playing
          ? "Playing"
          : "Ready";

  const handleTransportRecord = useCallback(() => {
    if (!isEngineer) return;
    if (recording) {
      setSessionRecording(false);
      return;
    }
    if (!armed) return;
    setSessionRecording(true);
    if (!playing) setSessionPlaying(true);
  }, [isEngineer, recording, armed, playing, setSessionRecording, setSessionPlaying]);

  const handleArmRecordToggle = useCallback(() => {
    if (!isEngineer || recording) return;
    setSessionRecordArmed(!armed);
  }, [isEngineer, recording, armed, setSessionRecordArmed]);

  const engineerRecordDimmed = isEngineer && !recording && !armed;
  /** Engineer DAW bridge: isolated vocal bus + session/artist sync (session UI extension only). */
  const bridgePathReady = isEngineer && !!engineerDawVocalIn1 && hasRemoteAudio;
  /** Bridge status derives from actual audio routing state, not session-level handshake */
  const bridgeStatusLabel = !isEngineer
    ? ""
    : bridgePathReady
      ? "Connected"
      : hasRemoteAudio
        ? "Connecting"
        : sessionId.trim()
          ? "Connecting"
          : "Disconnected";
  const bridgeStatusColor =
    bridgeStatusLabel === "Connected" ? C.green : bridgeStatusLabel === "Connecting" ? C.yellow : C.dim;
  const bridgeArtistLabel = live.remoteArtistLabel.trim() || (hasRemoteAudio ? "Artist connected" : "—");
  /** Feed active when the DAW vocal path is actually receiving remote audio */
  const bridgeFeedActive = isEngineer && bridgePathReady;
  const goToJoin = useCallback(() => navigate("/wstudio/session/join"), [navigate]);

  const handleEndSession = useCallback(() => {
    leaveSession();
    navigate("/wstudio/session/join");
  }, [leaveSession, navigate]);

  // Engineer marks session complete → update DB + notify artist
  const handleEngineerMarkComplete = useCallback(async () => {
    if (!sessionId.trim() || !user) return;
    try {
      // Find booking by session code
      const { data: bookingData } = await (supabase as any)
        .from("studio_bookings")
        .select("id, user_id, studio_id, session_code")
        .eq("session_code", sessionId.trim().toUpperCase())
        .single();
      if (bookingData) {
        await (supabase as any)
          .from("studio_bookings")
          .update({
            engineer_completed_at: new Date().toISOString(),
            session_status: "awaiting_confirmation",
          })
          .eq("id", bookingData.id);
        // Notify artist to verify
        await (supabase as any).from("notifications").insert({
          user_id: bookingData.user_id,
          type: "booking",
          title: "✅ Session Complete — Please Verify",
          body: `Your engineer has marked the session (code: ${bookingData.session_code}) as complete. Please confirm or dispute within 48 hours.`,
          reference_id: bookingData.id,
          reference_type: "booking",
        });
        toast.success("Session marked complete. Awaiting artist confirmation.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to mark session complete");
    }
    leaveSession();
    navigate("/wstudio/session/join");
  }, [sessionId, user, leaveSession, navigate]);

  // Artist confirms session completion
  const handleArtistConfirmComplete = useCallback(async () => {
    if (!sessionId.trim() || !user) return;
    try {
      const { data: bookingData } = await (supabase as any)
        .from("studio_bookings")
        .select("id, studio_id")
        .eq("session_code", sessionId.trim().toUpperCase())
        .single();
      if (bookingData) {
        await (supabase as any)
          .from("studio_bookings")
          .update({
            artist_confirmed: true,
            artist_responded_at: new Date().toISOString(),
            session_status: "completed",
            payout_status: "released",
          })
          .eq("id", bookingData.id);
        toast.success("Session confirmed! Payment released.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to confirm session");
    }
    leaveSession();
    navigate("/bookings");
  }, [sessionId, user, leaveSession, navigate]);

  const [expandedPanel, setExpandedPanel] = useState<"artist" | "engineer" | "screen" | null>(null);

  const [autoUpload, setAutoUpload] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const connected = connection === "connected";

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && shellRef.current) {
      shellRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  /* ── Mobile-specific tab state ── */
  const [mobileTab, setMobileTab] = useState<"video" | "controls" | "monitor">("video");

  return (
    <div ref={shellRef} className={`flex select-none overflow-hidden ${isMobile ? "flex-col overflow-y-auto" : "min-h-screen items-center justify-center"}`} style={{ background: "#111214", padding: isFullscreen ? 0 : isMobile ? 0 : 16 }}>
      <div className="w-full overflow-hidden flex flex-col" style={{
        maxWidth: isFullscreen ? "100%" : isMobile ? "100%" : 1440,
        height: isFullscreen ? "100vh" : isMobile ? "100dvh" : "auto",
        borderRadius: isFullscreen || isMobile ? 0 : 8,
        background: `linear-gradient(180deg, ${C.shell} 0%, ${C.shellDark} 100%)`,
        border: isFullscreen || isMobile ? "none" : `1px solid ${C.shellEdge}`,
        boxShadow: isFullscreen || isMobile ? "none" : `0 24px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)`,
        color: C.text,
      }}>
        {/* ─── TITLE BAR ─── */}
        <div className="flex items-center justify-between px-3 md:px-5" style={{ height: isMobile ? 40 : 48, borderBottom: `1px solid ${C.panelBorder}` }}>
          <div className="flex items-end gap-2">
            <span className={`${isMobile ? "text-[16px]" : "text-[20px]"} font-black tracking-tight`} style={{ display: "inline-flex", alignItems: "baseline" }}>
              <svg width={isMobile ? 18 : 24} height={isMobile ? 14 : 18} viewBox="0 0 24 18" fill="none" style={{ marginRight: 1, position: "relative", top: 1 }}>
                <path d="M0 1L4 17H5L9 5L13 17H14L18 1H16L13 12L9.5 1H8.5L5 12L2 1H0Z" fill={C.white} />
                <line x1="17.5" y1="-1" x2="11.5" y2="19" stroke={C.blue} strokeWidth="4" strokeLinecap="round" />
              </svg>
              <span style={{ color: C.blue }}>.</span>STUDIO
            </span>
            <span style={{ color: C.label, fontSize: isMobile ? 10 : 12, fontWeight: 300, letterSpacing: "0.1em", paddingBottom: 2 }}>RECEIVE</span>
          </div>
          <div className="flex items-center gap-3" style={{ color: C.label }}>
            {!isMobile && (
              <button onPointerDown={(e) => { e.preventDefault(); toggleFullscreen(); }} className="hover:text-white" title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                {isFullscreen ? "⊡" : "⛶"}
              </button>
            )}
            <button className="hover:text-white">☰</button>
            <button onPointerDown={(e) => { e.preventDefault(); leaveSession(); }} className="hover:text-white">✕</button>
          </div>
        </div>

        {/* ─── MOBILE TAB BAR ─── */}
        {isMobile && (
          <div className="flex" style={{ borderBottom: `1px solid ${C.panelBorder}` }}>
            {([["video", "📹 Video"], ["controls", "🎛 Controls"], ["monitor", "🎧 Monitor"]] as const).map(([key, label]) => (
              <button key={key} onPointerDown={(e) => { e.preventDefault(); setMobileTab(key as any); }} className="flex-1 py-2 text-center text-[11px] font-bold uppercase tracking-wide" style={{
                color: mobileTab === key ? C.white : C.dim,
                borderBottom: mobileTab === key ? `2px solid ${C.blue}` : "2px solid transparent",
                background: mobileTab === key ? "rgba(59,157,255,0.08)" : "transparent",
              }}>{label}</button>
            ))}
          </div>
        )}

        {/* ─── MAIN GRID ─── */}
        <div className={`relative ${isMobile ? "flex flex-col gap-2 p-2 flex-1 overflow-y-auto" : `grid gap-2 p-2 ${isFullscreen ? "flex-1" : ""}`}`} style={isMobile ? {} : { gridTemplateColumns: "1fr 320px", gridTemplateRows: isFullscreen ? "1fr" : "auto" }}>
          {controlsLocked && <SessionControlsLockOverlay />}

          {/* ══════════ MOBILE LAYOUT ══════════ */}
          {isMobile ? (
            <>
              {/* Session status bar — always visible on mobile */}
              <Panel accent={C.acCyan} className="flex items-center justify-between px-3" style={{ height: 40 }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{sessionDisplayName || "Session: Live"}</span>
                  <span className="shrink-0 rounded px-2 py-0.5 text-[9px] font-bold uppercase" style={{
                    background: connected ? "linear-gradient(180deg, #4ade60 0%, #22a838 100%)" : C.panelDark,
                    color: connected ? C.white : C.dim,
                  }}>
                    {connected ? "CONNECTED" : connection.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button className="flex h-7 w-7 items-center justify-center rounded text-[13px]" style={{ background: C.panelDark, border: `1px solid ${C.panelBorder}`, color: C.label }}>🔊</button>
                  {isEngineer && (
                    <button onClick={() => {
                      if (!canScreenShare) { toast.error("Screen sharing is not supported on this device. Please use a desktop browser."); return; }
                      toggleScreenShare(); if (!screenSharing) setMobileTab("video");
                    }} className="flex h-7 items-center justify-center gap-1 rounded px-2 text-[11px] font-semibold" style={{ background: screenSharing ? "rgba(59,157,255,0.2)" : C.panelDark, border: `1px solid ${screenSharing ? C.blue : C.panelBorder}`, color: screenSharing ? C.blue : C.label }}>
                      🖥 {screenSharing ? "Stop" : "Share"}
                    </button>
                  )}
                </div>
              </Panel>

              {/* ── VIDEO TAB ── */}
              {mobileTab === "video" && (
                <div className="flex flex-col gap-2">
                  {/* Artist Video */}
                  <Panel accent={C.acMagenta} className="relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
                    {artistStream ? (
                      <VideoFeed stream={artistStream} mirrored={artistMirrored} muted={isArtist} volume={isEngineer ? remoteTileVolume : 1} />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: C.inset }}>
                        <span className="text-[20px] font-black tracking-tight" style={{ color: C.dim }}>W<span style={{ color: C.blue }}>.</span>STUDIO</span>
                        <span style={{ color: C.dim, fontSize: 10, letterSpacing: "0.14em", marginTop: 4 }}>WAITING FOR ARTIST</span>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 rounded px-2 py-0.5 text-[10px] font-medium" style={{ background: "rgba(0,0,0,0.6)", color: artistStream ? C.text : C.dim }}>{artistStream ? "Artist" : "No one connected"}</div>
                    <VideoTileActions hasSession={!!role} onJoin={goToJoin} onEnd={handleEndSession} expanded={expandedPanel === "artist"} onToggleExpand={() => setExpandedPanel(expandedPanel === "artist" ? null : "artist")} isMobile />
                    <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-md px-2 py-0.5" style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}>
                      <span className="font-mono text-[12px] font-bold tabular-nums" style={{ color: (hasBooking ? warningLevel : "ok") === "critical" ? C.red : (hasBooking ? warningLevel : "ok") === "warning" ? C.yellow : C.text }}>
                        {(() => { const rs = hasBooking ? bookingRemaining : demoClock.remainingSeconds; return `${String(Math.floor(rs / 60)).padStart(2, "0")}:${String(rs % 60).padStart(2, "0")}`; })()}
                      </span>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: (hasBooking ? phase : demoClock.phase) === "live" ? C.green : (hasBooking ? phase : demoClock.phase) === "ended" ? C.red : C.dim }} />
                    </div>
                  </Panel>

                  {/* Engineer Video */}
                  <Panel accent={C.acGreen} className="relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
                    {engineerStream ? (
                      <VideoFeed stream={engineerStream} mirrored={engineerMirrored} muted={isEngineer} />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: C.inset }}>
                        <span className="text-[20px] font-black tracking-tight" style={{ color: C.dim }}>W<span style={{ color: C.blue }}>.</span>STUDIO</span>
                        <span style={{ color: C.dim, fontSize: 10, letterSpacing: "0.14em", marginTop: 4 }}>WAITING FOR ENGINEER</span>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 z-[5] rounded px-2 py-0.5 text-[10px] font-medium" style={{ background: "rgba(0,0,0,0.6)", color: engineerStream ? C.text : C.dim }}>{engineerStream ? "Engineer" : "No one connected"}</div>
                    <VideoTileActions hasSession={!!role} onJoin={goToJoin} onEnd={handleEndSession} expanded={expandedPanel === "engineer"} onToggleExpand={() => setExpandedPanel(expandedPanel === "engineer" ? null : "engineer")} isMobile />
                    <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-md px-2 py-0.5" style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}>
                      <span className="font-mono text-[12px] font-bold tabular-nums" style={{ color: (hasBooking ? warningLevel : "ok") === "critical" ? C.red : (hasBooking ? warningLevel : "ok") === "warning" ? C.yellow : C.text }}>
                        {(() => { const rs = hasBooking ? bookingRemaining : demoClock.remainingSeconds; return `${String(Math.floor(rs / 60)).padStart(2, "0")}:${String(rs % 60).padStart(2, "0")}`; })()}
                      </span>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: (hasBooking ? phase : demoClock.phase) === "live" ? C.green : (hasBooking ? phase : demoClock.phase) === "ended" ? C.red : C.dim }} />
                    </div>
                    {isEngineer && (
                      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[5] rounded-md px-2 py-0.5" style={{ background: "rgba(0,0,0,0.72)" }}>
                        <span className="font-mono text-[11px] font-semibold" style={{ color: C.green }}>{formatCurrency(sessionValueTotal)}</span>
                      </div>
                    )}
                  </Panel>

                  {/* Mute / Talk / Settings row */}
                  <Panel accent={C.acOrange}>
                    <div className="grid grid-cols-3" style={{ borderTop: `1px solid ${C.panelBorder}` }}>
                      <button onPointerDown={(e) => { e.preventDefault(); toggleMute(); }} className="flex flex-col items-center justify-center gap-1 py-2.5">
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={muted ? C.red : C.label} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="22" />
                        </svg>
                        <span style={{ fontSize: 10, color: C.text }}>Mute</span>
                      </button>
                      <button
                        onPointerDown={(e) => { e.preventDefault(); beginTalkback(); }}
                        onPointerUp={(e) => { e.preventDefault(); endTalkback(); }}
                        onPointerLeave={endTalkback}
                        onTouchStart={(e) => { e.preventDefault(); beginTalkback(); }}
                        onTouchEnd={(e) => { e.preventDefault(); endTalkback(); }}
                        className="flex flex-col items-center justify-center gap-1 py-2.5"
                        style={{
                          borderLeft: `1px solid ${C.panelBorder}`,
                          borderRight: `1px solid ${C.panelBorder}`,
                          touchAction: "none",
                        }}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full transition-[box-shadow,transform] duration-100" style={{
                          background: talkbackHeld
                            ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.45), ${C.blue})`
                            : peerPtt
                              ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.22), #2563eb)`
                              : `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.25), ${C.blue})`,
                          boxShadow: talkbackHeld ? `0 0 20px ${C.blue}80, inset 0 0 12px rgba(255,255,255,0.15)` : peerPtt ? `0 0 12px rgba(37,99,235,0.45)` : "none",
                          transform: talkbackHeld ? "scale(1.06)" : "scale(1)",
                        }}>
                          <span style={{ color: C.white, fontSize: 12 }}>🎙</span>
                        </div>
                        <span style={{ fontSize: 10, color: talkbackHeld ? C.blue : C.text, fontWeight: talkbackHeld ? 700 : 400 }}>
                          {talkbackHeld ? "TALKING" : peerPtt ? "INCOMING" : "Talk"}
                        </span>
                      </button>
                      <button className="flex flex-col items-center justify-center gap-1 py-2.5">
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={C.label} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span style={{ fontSize: 10, color: C.text }}>Settings</span>
                      </button>
                    </div>
                  </Panel>

                  {/* Screen share view on mobile */}
                  {collaborationShareActive && (
                    <Panel accent={C.acCyan} className="relative flex flex-col overflow-hidden" style={{ minHeight: 160 }}>
                      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${C.panelBorder}` }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.label, letterSpacing: "0.12em", textTransform: "uppercase" }}>SCREEN SHARE</span>
                        <div className="flex items-center gap-1">
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.green }} />
                          <span style={{ fontSize: 10, color: C.green, fontWeight: 600 }}>LIVE</span>
                        </div>
                      </div>
                      <div className="relative flex-1" style={{ background: C.inset, minHeight: 120 }}>
                        {screenShareViewStream ? (
                          <VideoFeed stream={screenShareViewStream} />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <div className="flex flex-col items-center gap-1">
                              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.dim} strokeWidth={1.5}><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                              <span style={{ color: C.label, fontSize: 11, fontWeight: 500 }}>{isEngineer ? "Your screen is being shared" : "Engineer's DAW"}</span>
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-2 right-2 z-10">
                          <button onClick={() => setExpandedPanel(expandedPanel === "screen" ? null : "screen")} className="rounded px-1.5 py-1 text-[9px] font-bold" style={{ background: "rgba(0,0,0,0.7)", color: "#e8e8ea", border: "1px solid rgba(255,255,255,0.15)" }}>⛶</button>
                        </div>
                      </div>
                    </Panel>
                  )}

                  {/* ── Plugin Status + Session Info (side by side like reference) ── */}
                  {isEngineer && (
                    <div className="grid grid-cols-2 gap-2">
                      {/* Studio Session panel */}
                      <Panel accent={C.acCyan} className="p-3">
                        <div className="mb-1 flex items-center gap-1.5">
                          <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                            <path d="M4 8L10 24L16 12L22 24L28 8" stroke="hsl(270,60%,65%)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                            <line x1="14" y1="4" x2="20" y2="28" stroke="hsl(210,90%,60%)" strokeWidth="2.5" strokeLinecap="round"/>
                          </svg>
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.text, letterSpacing: "0.05em" }}>STUDIO SESSION</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{sessionDisplayName || "Session"}</span>
                          <span className="rounded-full" style={{ width: 8, height: 8, background: connected ? C.green : C.dim }} />
                        </div>
                        <span style={{ fontSize: 10, color: C.dim }}>Session Live</span>
                        <button onClick={handleEndSession} className="mt-2 w-full rounded-lg py-2 text-center text-[11px] font-bold uppercase" style={{
                          background: "linear-gradient(180deg, rgba(239,68,68,0.15) 0%, rgba(153,27,27,0.2) 100%)",
                          color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)",
                        }}>🔲 Disconnect</button>
                      </Panel>

                      {/* W.Studio Plugin Status panel */}
                      <Panel accent={C.acCyan} className="p-3">
                        <div className="mb-1 flex items-center gap-1.5">
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.text, letterSpacing: "0.05em" }}>W.STUDIO</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <span className="rounded-full" style={{ width: 6, height: 6, background: bridgeFeedActive ? C.green : C.dim }} />
                          <span style={{ fontSize: 10, fontWeight: 600, color: bridgeFeedActive ? C.green : C.dim }}>
                            {bridgeFeedActive ? "Connected" : "Waiting"}
                          </span>
                          <span style={{ fontSize: 10, color: C.dim }}> | Plugin {bridgeFeedActive ? "active" : "inactive"}</span>
                        </div>
                        <div className="mt-1.5 space-y-0.5" style={{ fontSize: 9, color: C.dim }}>
                          <div>Send Plugin | 48 kHz / WavesHQ</div>
                          <div>Feed <span style={{ color: bridgeFeedActive ? C.green : C.dim }}>{bridgeFeedActive ? "Active" : "Inactive"}</span> | {playing ? "Playing" : "Stopped"}</div>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 text-[9px] font-semibold" style={{ color: C.label }}>
                          TALKBACK
                          <span className="rounded-full" style={{ width: 5, height: 5, background: talkbackHeld ? C.blue : C.dim }} />
                          <HorizontalMeter level={talkbackHeld ? localTalkbackTxLevel : 0} />
                        </div>
                      </Panel>
                    </div>
                  )}

                  {isArtist && hasBooking && phase === "live" && (
                    <Panel accent={C.acOrange} className="p-3">
                      <div className="mb-2" style={{ fontSize: 11, fontWeight: 600, color: C.label, letterSpacing: "0.12em", textTransform: "uppercase" }}>REQUEST MORE TIME</div>
                      {booking?.pendingExtension ? (
                        <div className="text-center py-2" style={{ color: C.yellow, fontSize: 12 }}>
                          ⏳ Waiting for engineer to approve +{booking.pendingExtension.minutes} min...
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          {([15, 30, 60] as const).map((mins) => (
                            <button key={mins} onClick={() => requestExtension(mins)} className="flex-1 rounded-lg py-2 text-center text-[12px] font-bold" style={{
                              background: "linear-gradient(180deg, #f59e0b 0%, #b45309 100%)",
                              color: "#fff", border: "1px solid rgba(245,158,11,0.5)",
                            }}>+{mins} min</button>
                          ))}
                        </div>
                      )}
                    </Panel>
                  )}

                  {/* Session Complete Actions */}
                  {hasBooking && (
                    <Panel accent={C.acGreen} className="p-3">
                      <div className="flex gap-2">
                        {isEngineer && (
                          <button onClick={handleEngineerMarkComplete} className="flex-1 rounded-lg py-2.5 text-center text-[12px] font-bold" style={{
                            background: "linear-gradient(180deg, #4ade60 0%, #22a838 100%)",
                            color: "#fff", border: "1px solid rgba(74,222,96,0.5)",
                          }}>✅ Mark Complete</button>
                        )}
                        {isArtist && (
                          <button onClick={handleArtistConfirmComplete} className="flex-1 rounded-lg py-2.5 text-center text-[12px] font-bold" style={{
                            background: "linear-gradient(180deg, #4ade60 0%, #22a838 100%)",
                            color: "#fff", border: "1px solid rgba(74,222,96,0.5)",
                          }}>✅ Confirm Complete</button>
                        )}
                      </div>
                    </Panel>
                  )}
                </div>
              )}

              {/* ── CONTROLS TAB ── */}
              {mobileTab === "controls" && (
                <div className="flex flex-col gap-2">
                  {/* Sync Controls */}
                  <Panel accent={C.acPurple} className="p-3">
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.label, letterSpacing: "0.12em", textTransform: "uppercase" }}>SYNC CONTROLS</div>
                    <div className="my-2 text-center" style={{ fontSize: 14, fontWeight: 600, color: C.text }}>– SYNCED: 120 BPM –</div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button onPointerDown={isEngineer ? (e) => { e.preventDefault(); setSessionPlaying(true); } : undefined} className="flex items-center gap-1.5 rounded-[3px] px-4 py-2 text-[13px] font-semibold" style={{
                        background: playing ? `linear-gradient(180deg, #1a3a1a 0%, #0e2a0e 100%)` : `linear-gradient(180deg, ${C.panelLight} 0%, ${C.panelDark} 100%)`,
                        border: `1px solid ${playing ? "#2a6a2a" : C.panelBorder}`, color: C.text,
                        opacity: isEngineer ? 1 : 0.4, cursor: isEngineer ? "pointer" : "not-allowed",
                      }}>
                        <span style={{ color: playing ? C.green : C.text }}>▶</span> Play
                      </button>
                      <button onPointerDown={isEngineer ? (e) => { e.preventDefault(); setSessionPlaying(false); if (recording) setSessionRecording(false); } : undefined} className="flex items-center gap-1.5 rounded-[3px] px-4 py-2 text-[13px] font-semibold" style={{
                        background: `linear-gradient(180deg, ${C.panelLight} 0%, ${C.panelDark} 100%)`,
                        border: `1px solid ${C.panelBorder}`, color: C.text,
                        opacity: isEngineer ? 1 : 0.4, cursor: isEngineer ? "pointer" : "not-allowed",
                      }}>
                        <span style={{ color: C.red }}>■</span> Stop
                      </button>
                      <button onPointerDown={isEngineer ? (e) => { e.preventDefault(); handleTransportRecord(); } : undefined} className="flex items-center gap-1.5 rounded-[3px] px-4 py-2 text-[13px] font-semibold" style={{
                        background: recording ? `linear-gradient(180deg, #4a1a1a 0%, #2a0e0e 100%)` : `linear-gradient(180deg, ${C.panelLight} 0%, ${C.panelDark} 100%)`,
                        border: `1px solid ${recording ? "#6a2222" : C.panelBorder}`, color: C.text,
                        opacity: isEngineer ? (engineerRecordDimmed ? 0.45 : 1) : 0.4, cursor: isEngineer && !engineerRecordDimmed ? "pointer" : "not-allowed",
                      }}>
                        <span className={recording ? "animate-pulse" : ""} style={{ color: C.red }}>●</span> Record
                      </button>
                    </div>
                  </Panel>

                  {/* Vocal Input */}
                  <Panel accent={C.acPurple} className="p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.label, letterSpacing: "0.12em", textTransform: "uppercase" }}>VOCAL INPUT</span>
                    </div>
                    <Inset className="space-y-2 p-2">
                      <div>
                        <div className="mb-0.5 flex justify-between" style={{ fontSize: 9, fontWeight: 600, color: C.label, letterSpacing: "0.08em" }}>
                          <span>LOCAL MIC</span>
                        </div>
                        <HorizontalMeter level={meterDisplay(localMicLevel)} />
                      </div>
                      <div>
                        <div className="mb-0.5" style={{ fontSize: 9, fontWeight: 600, color: C.label, letterSpacing: "0.08em" }}>TALKBACK SEND</div>
                        <HorizontalMeter level={meterDisplay(localTalkbackTxLevel)} />
                      </div>
                      <div>
                        <div className="mb-0.5 flex justify-between" style={{ fontSize: 9, fontWeight: 600, color: C.label, letterSpacing: "0.08em" }}>
                          <span>REMOTE IN</span>
                          <span style={{ color: C.dim, fontWeight: 500 }}>{hasRemoteAudio ? "live" : "no stream"}</span>
                        </div>
                        <HorizontalMeter level={hasRemoteAudio ? meterDisplay(remoteMicLevel) : 0} />
                      </div>
                      {isEngineer ? (
                        <div>
                          <div className="mb-0.5 flex justify-between" style={{ fontSize: 9, fontWeight: 600, color: C.label, letterSpacing: "0.08em" }}>
                            <span>BRIDGE OUT (DAW FEED)</span>
                            <span style={{ color: C.dim, fontWeight: 500 }}>{bridgePathReady ? "routed" : "—"}</span>
                          </div>
                          <HorizontalMeter level={bridgePathReady ? meterDisplay(engineerBridgeVocalLevel) : 0} />
                        </div>
                      ) : null}
                      {isEngineer ? (
                        <div>
                          <div className="mb-0.5 flex justify-between" style={{ fontSize: 9, fontWeight: 600, color: C.label, letterSpacing: "0.08em" }}>
                            <span>RETURN FROM DAW</span>
                            <span style={{ color: dawReturnActive ? C.green : C.dim, fontWeight: 500 }}>{dawReturnActive ? "sending" : "—"}</span>
                          </div>
                          <HorizontalMeter level={dawReturnActive ? meterDisplay(engineerDawReturnLevel) : 0} />
                        </div>
                      ) : null}
                      <div className="mt-1"><SpectrumBars level={spectrumLevel} /></div>
                      <div className="mt-0.5"><FreqLabels /></div>
                    </Inset>
                    <div className="mt-3 flex justify-center">
                      <button onPointerDown={isEngineer && !recording ? (e) => { e.preventDefault(); handleArmRecordToggle(); } : undefined} className="rounded-[3px] px-6 py-2 text-[13px] font-bold uppercase tracking-wide" style={{
                        background: armed ? `linear-gradient(180deg, #4a1a1a 0%, #2a0e0e 100%)` : `linear-gradient(180deg, ${C.panelLight} 0%, ${C.panelDark} 100%)`,
                        border: `1px solid ${armed ? "#6a2222" : C.panelBorder}`, color: C.text,
                        opacity: isEngineer && !recording ? 1 : 0.4, cursor: isEngineer && !recording ? "pointer" : "not-allowed",
                      }}>ARM RECORD</button>
                    </div>
                  </Panel>

                  {/* Vocal Take Waveform */}
                  <Panel accent={C.acCyan} className="flex items-center gap-2 px-3 py-2">
                    <span className="truncate" style={{ fontSize: 12, fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>Vocal Take 4 — {vocalTakeTitle}</span>
                    <Inset className="flex-1 overflow-hidden rounded-[3px] p-0.5">
                      <Waveform recording={recording} takeCaptured={takeCaptured} />
                    </Inset>
                  </Panel>

                  {/* Transport Bar */}
                  <Panel accent={C.acPurple} className="flex flex-wrap items-center gap-1.5 px-2 py-2">
                    <button disabled={!isEngineer} className="flex items-center gap-1 rounded-[3px] px-3 py-1.5 text-[11px] font-semibold" style={{ background: `linear-gradient(180deg, ${C.panelLight} 0%, ${C.panelDark} 100%)`, border: `1px solid ${C.panelBorder}`, color: C.text, opacity: isEngineer ? 1 : 0.4 }}>▌▌ Punch</button>
                    <button disabled={!isEngineer} className="flex items-center gap-1 rounded-[3px] px-3 py-1.5 text-[11px] font-semibold" style={{ background: `linear-gradient(180deg, ${C.panelLight} 0%, ${C.panelDark} 100%)`, border: `1px solid ${C.panelBorder}`, color: C.text, opacity: isEngineer ? 1 : 0.4 }}>&lt;&lt; Rew</button>
                    <button disabled={!isEngineer} className="flex items-center gap-1 rounded-[3px] px-3 py-1.5 text-[11px] font-semibold" style={{ background: `linear-gradient(180deg, ${C.panelLight} 0%, ${C.panelDark} 100%)`, border: `1px solid ${C.panelBorder}`, color: C.text, opacity: isEngineer ? 1 : 0.4 }}>▶▶ Fwd</button>
                    <div className="flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-[12px] font-bold" style={{
                      background: recording ? `linear-gradient(180deg, #4a1a1a 0%, #2a0e0e 100%)` : armed ? `linear-gradient(180deg, #3a2a0a 0%, #2a1f08 100%)` : `linear-gradient(180deg, ${C.panelLight} 0%, ${C.panelDark} 100%)`,
                      border: `1px solid ${recording ? "#6a2222" : armed ? "#6a5a22" : C.panelBorder}`,
                    }}>
                      <span className={recording ? "animate-pulse" : ""} style={{ color: recording ? C.red : armed ? C.yellow : C.dim }}>●</span>
                      <span style={{ color: recording ? C.red : armed ? C.yellow : C.dim }}>REC</span>
                      {(recording || armed) && (
                        <span style={{ color: recording ? C.red : C.yellow, fontSize: 10 }}>{recording ? "RECORDING" : "ARMED"}</span>
                      )}
                    </div>
                  </Panel>
                </div>
              )}

              {/* ── MONITOR TAB ── */}
              {mobileTab === "monitor" && (
                <Panel accent={C.acLime} className="p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span title={isArtist ? "Engineer adjusts monitor mix; values sync here." : undefined} style={{ fontSize: 11, fontWeight: 600, color: C.label, letterSpacing: "0.12em", textTransform: "uppercase" }}>MONITORING</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4">
                    <div className="flex flex-col items-center gap-1">
                      <span style={{ fontSize: 10, fontWeight: 500, color: C.text }}>Vocal Level</span>
                      <div className="flex items-end gap-1.5">
                        <Knob value={vocalLevel} size={50} onChange={monitorAdjust ? (v) => monitorAdjust({ vocalLevel: v }) : undefined} accent={C.acLime} />
                        <ControlLevelLadder level={vocalLevel} height={60} accent={C.acLime} />
                        <Fader value={vocalLevel} height={60} onChange={monitorAdjust ? (v) => monitorAdjust({ vocalLevel: v }) : undefined} />
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span style={{ fontSize: 10, fontWeight: 500, color: C.text }}>Talkback Level</span>
                      <div className="flex items-end gap-1.5">
                        <Knob value={talkbackLevel} size={50} onChange={monitorAdjust ? (v) => monitorAdjust({ talkbackLevel: v }) : undefined} accent={C.acCyan} />
                        <ControlLevelLadder level={talkbackLevel} height={60} accent={C.acCyan} />
                        <Fader value={talkbackLevel} height={60} onChange={monitorAdjust ? (v) => monitorAdjust({ talkbackLevel: v }) : undefined} />
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span style={{ fontSize: 10, fontWeight: 500, color: C.text }}>Headphone</span>
                      <div className="flex items-end gap-1.5">
                        <Knob value={headphoneLevel} size={50} onChange={(v) => updateSessionHeadphoneLevel(v)} accent={C.acOrange} />
                        <ControlLevelLadder level={headphoneLevel} height={60} accent={C.acOrange} />
                        <Fader value={headphoneLevel} height={60} onChange={(v) => updateSessionHeadphoneLevel(v)} />
                      </div>
                      <span style={{ fontSize: 8, color: C.dim }}>🎧 HP OUT</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span style={{ fontSize: 10, fontWeight: 500, color: C.text }}>Cue Mix</span>
                      <Knob value={cueMix} size={50} onChange={monitorAdjust ? (v) => monitorAdjust({ cueMix: v }) : undefined} accent={C.acPurple} />
                      <div className="flex w-full items-center justify-between px-1" style={{ fontSize: 8, color: C.dim }}>
                        <span>VOX</span><span>BEAT</span>
                      </div>
                      <div className="mt-0.5 overflow-hidden rounded-sm" style={{ height: 4, width: "80%", background: C.track, border: `1px solid ${C.insetBorder}` }}>
                        <div className="h-full rounded-sm" style={{ width: `${cueMix * 100}%`, background: `linear-gradient(90deg, ${C.blue} 0%, ${C.green} 100%)` }} />
                      </div>
                    </div>
                  </div>
                  {isEngineer ? (
                    <div className="mt-4 border-t pt-3" style={{ borderColor: C.panelBorder }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.label, letterSpacing: "0.12em", textTransform: "uppercase" }}>W.STUDIO BRIDGE</div>
                      <div className="mt-2 space-y-1" style={{ fontSize: 10, color: C.text, lineHeight: 1.45 }}>
                        <div>
                          <span style={{ color: C.dim }}>Status: </span>
                          <span style={{ color: bridgeStatusColor, fontWeight: 600 }}>{bridgeStatusLabel}</span>
                        </div>
                        <div>
                          <span style={{ color: C.dim }}>Artist: </span>
                          <span style={{ fontWeight: 500 }}>{bridgeArtistLabel}</span>
                        </div>
                        <div>
                          <span style={{ color: C.dim }}>Feed: </span>
                          <span style={{ color: bridgeFeedActive ? C.green : C.dim, fontWeight: 600 }}>{bridgeFeedActive ? "Active" : "Inactive"}</span>
                        </div>
                        <div>
                          <span style={{ color: C.dim }}>Output: </span>
                          {bridgeRouted && bridgeFeedActive ? (
                            <span style={{ color: C.green, fontWeight: 600 }}>Default (use Multi-Output for DAW)</span>
                          ) : (
                            <span style={{ color: C.acCyan, fontWeight: 600 }}>Waiting for signal</span>
                          )}
                        </div>
                        <div className="mt-1.5">
                          <div className="flex items-center justify-between">
                            <span style={{ fontSize: 8, color: bridgeRouted ? C.green : C.dim }}>
                              {bridgeRouted ? "● Playing" : "○ Not playing"}
                            </span>
                          </div>
                          {bridgeRoutingError && <div style={{ fontSize: 8, color: C.red, marginTop: 2 }}>{bridgeRoutingError}</div>}
                        </div>
                      </div>
                      <div className="mt-2 border-t pt-2" style={{ borderColor: C.panelBorder, fontSize: 9, color: C.dim }}>
                        <span style={{ color: bridgeStatusColor }}>• {bridgeStatusLabel}</span>
                        <span style={{ color: C.dim }}> · Artist: </span>
                        <span style={{ color: C.text }}>{bridgeArtistLabel}</span>
                        <span style={{ color: C.dim }}> · Feed </span>
                        <span style={{ color: bridgeFeedActive ? C.green : C.dim }}>{bridgeFeedActive ? "Active" : "Inactive"}</span>
                      </div>
                    </div>
                  ) : null}
                </Panel>
              )}

            </>
          ) : (
            <>
          {/* ══════════ DESKTOP LAYOUT ══════════ */}
          {/* Simple 2-column: Communication (videos + controls) | Plugin */}

          {/* ── LEFT: Videos + Communication Controls ── */}
          <div className="row-span-4 flex flex-col gap-2" style={{ gridRow: "1 / -1" }}>
            {/* Artist Video */}
            <Panel accent={C.acMagenta} className="relative overflow-hidden flex-1" style={{ minHeight: 200 }}>
              {artistStream ? (
                <VideoFeed stream={artistStream} mirrored={artistMirrored} muted={isArtist} volume={isEngineer ? remoteTileVolume : 1} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: C.inset }}>
                  <span className="text-[24px] font-black tracking-tight" style={{ color: C.dim }}>W<span style={{ color: C.blue }}>.</span>STUDIO</span>
                  <span style={{ color: C.dim, fontSize: 10, letterSpacing: "0.14em", marginTop: 4 }}>WAITING FOR ARTIST</span>
                </div>
              )}
              {/* Role label + connection dot */}
              <div className="absolute bottom-2 left-2 z-[5] flex items-center gap-1.5 rounded px-2 py-1" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
                <span className="rounded-full" style={{ width: 6, height: 6, background: artistStream ? C.green : C.dim }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: artistStream ? C.text : C.dim }}>Artist</span>
              </div>
              <VideoTileActions hasSession={!!role} onJoin={goToJoin} onEnd={handleEndSession} expanded={expandedPanel === "artist"} onToggleExpand={() => setExpandedPanel(expandedPanel === "artist" ? null : "artist")} isMobile={false} />
              {/* Timer overlay */}
              <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-md px-2 py-1" style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}>
                <span className={`font-mono text-[14px] font-bold tabular-nums ${(hasBooking ? warningLevel : "ok") === "critical" ? "animate-pulse" : ""}`} style={{ color: (hasBooking ? warningLevel : "ok") === "critical" ? C.red : (hasBooking ? warningLevel : "ok") === "warning" ? C.yellow : C.text }}>
                  {(() => { const rs = hasBooking ? bookingRemaining : demoClock.remainingSeconds; return `${String(Math.floor(rs / 60)).padStart(2, "0")}:${String(rs % 60).padStart(2, "0")}`; })()}
                </span>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: (hasBooking ? phase : demoClock.phase) === "live" ? C.green : (hasBooking ? phase : demoClock.phase) === "ended" ? C.red : C.dim }} />
              </div>
            </Panel>

            {/* Engineer Video */}
            <Panel accent={C.acGreen} className="relative overflow-hidden flex-1" style={{ minHeight: 200 }}>
              {engineerStream ? (
                <VideoFeed stream={engineerStream} mirrored={engineerMirrored} muted={isEngineer} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: C.inset }}>
                  <span className="text-[24px] font-black tracking-tight" style={{ color: C.dim }}>W<span style={{ color: C.blue }}>.</span>STUDIO</span>
                  <span style={{ color: C.dim, fontSize: 10, letterSpacing: "0.14em", marginTop: 4 }}>WAITING FOR ENGINEER</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 z-[5] flex items-center gap-1.5 rounded px-2 py-1" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
                <span className="rounded-full" style={{ width: 6, height: 6, background: engineerStream ? C.green : C.dim }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: engineerStream ? C.text : C.dim }}>Engineer</span>
              </div>
              <VideoTileActions hasSession={!!role} onJoin={goToJoin} onEnd={handleEndSession} expanded={expandedPanel === "engineer"} onToggleExpand={() => setExpandedPanel(expandedPanel === "engineer" ? null : "engineer")} isMobile={false} />
              <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-md px-2 py-1" style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}>
                <span className={`font-mono text-[14px] font-bold tabular-nums`} style={{ color: C.text }}>
                  {(() => { const rs = hasBooking ? bookingRemaining : demoClock.remainingSeconds; return `${String(Math.floor(rs / 60)).padStart(2, "0")}:${String(rs % 60).padStart(2, "0")}`; })()}
                </span>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: (hasBooking ? phase : demoClock.phase) === "live" ? C.green : (hasBooking ? phase : demoClock.phase) === "ended" ? C.red : C.dim }} />
              </div>
              {isEngineer && (
                <div className="absolute bottom-10 right-2 z-[5] rounded-md px-2 py-1" style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}>
                  <span className="font-mono text-[12px] font-semibold" style={{ color: C.green }}>{formatCurrency(sessionValueTotal)}</span>
                </div>
              )}
            </Panel>

            {/* Communication Controls: Mute | Talk | End Session | Share Screen */}
            <Panel accent={C.acOrange}>
              <div className="flex" style={{ borderTop: `1px solid ${C.panelBorder}` }}>
                {/* Mute */}
                <button type="button" onPointerDown={(e) => { e.preventDefault(); toggleMute(); }} className="flex flex-1 flex-col items-center justify-center gap-1.5 py-3" style={{ borderRight: `1px solid ${C.panelBorder}` }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={muted ? C.red : C.label} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                  <span style={{ fontSize: 10, color: muted ? C.red : C.text }}>Mute</span>
                </button>
                {/* Talk */}
                <button
                  type="button"
                  onPointerDown={(e) => { e.preventDefault(); beginTalkback(); }}
                  onPointerUp={endTalkback}
                  onPointerLeave={endTalkback}
                  onTouchStart={(e) => { e.preventDefault(); beginTalkback(); }}
                  onTouchEnd={(e) => { e.preventDefault(); endTalkback(); }}
                  className="flex flex-1 flex-col items-center justify-center gap-1.5 py-3"
                  style={{ borderRight: `1px solid ${C.panelBorder}`, touchAction: "none" }}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-100"
                    style={{
                      background: talkbackHeld
                        ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.45), ${C.blue})`
                        : peerPtt
                          ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.22), #2563eb)`
                          : `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.25), ${C.blue})`,
                      boxShadow: talkbackHeld ? `0 0 16px ${C.blue}80` : peerPtt ? `0 0 10px rgba(37,99,235,0.45)` : "none",
                      transform: talkbackHeld ? "scale(1.06)" : "scale(1)",
                    }}
                  >
                    <span style={{ color: C.white, fontSize: 12 }}>{"\u25B6"}</span>
                  </div>
                  <span style={{ fontSize: 10, color: C.text }}>Talk</span>
                </button>
                {/* End Session */}
                <button type="button" onPointerDown={(e) => { e.preventDefault(); handleEndSession(); }} className="flex flex-1 flex-col items-center justify-center gap-1.5 py-3" style={{ borderRight: `1px solid ${C.panelBorder}` }}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "linear-gradient(180deg, #ef4444 0%, #991b1b 100%)" }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                  <span style={{ fontSize: 10, color: C.text }}>End</span>
                </button>
                {/* Share Screen */}
                {isEngineer && canScreenShare && (
                  <button type="button" onPointerDown={(e) => { e.preventDefault(); toggleScreenShare(); }} className="flex flex-1 flex-col items-center justify-center gap-1.5 py-3">
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={screenSharing ? C.blue : C.label} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    <span style={{ fontSize: 10, color: screenSharing ? C.blue : C.text }}>{screenSharing ? "Stop" : "Share"}</span>
                  </button>
                )}
              </div>
            </Panel>

            {/* Screen Share View (only when active) */}
            {collaborationShareActive && (
              <Panel accent={C.acCyan} className="relative overflow-hidden" style={{ minHeight: 140 }}>
                <div className="absolute inset-0">
                  {screenShareViewStream ? (
                    <VideoFeed stream={screenShareViewStream} />
                  ) : (
                    <div className="flex h-full items-center justify-center" style={{ background: C.inset }}>
                      <span style={{ color: C.dim, fontSize: 12 }}>{isEngineer ? "Your screen is being shared" : "Engineer's DAW"}</span>
                    </div>
                  )}
                </div>
                <div className="absolute bottom-2 right-2 z-10">
                  <button onClick={() => setExpandedPanel(expandedPanel === "screen" ? null : "screen")} className="rounded px-2 py-1 text-[10px] font-bold" style={{ background: "rgba(0,0,0,0.7)", color: "#e8e8ea", border: "1px solid rgba(255,255,255,0.15)" }}>⛶ Expand</button>
                </div>
              </Panel>
            )}

            {/* Extension / Complete actions */}
            {isArtist && hasBooking && phase === "live" && (
              <Panel accent={C.acOrange} className="flex items-center gap-3 px-3 py-2">
                <span style={{ fontSize: 11, fontWeight: 600, color: C.label, letterSpacing: "0.1em", textTransform: "uppercase" }}>MORE TIME</span>
                {booking?.pendingExtension ? (
                  <span style={{ color: C.yellow, fontSize: 11 }}>⏳ +{booking.pendingExtension.minutes} min pending...</span>
                ) : (
                  <div className="flex gap-1.5">
                    {([15, 30, 60] as const).map((mins) => (
                      <button key={mins} onClick={() => requestExtension(mins)} className="rounded px-3 py-1 text-[11px] font-bold" style={{
                        background: "linear-gradient(180deg, #f59e0b 0%, #b45309 100%)", color: "#fff", border: "1px solid rgba(245,158,11,0.5)",
                      }}>+{mins}m</button>
                    ))}
                  </div>
                )}
              </Panel>
            )}
            {hasBooking && (
              <Panel accent={C.acGreen} className="flex items-center justify-between px-3 py-2">
                {isEngineer && (
                  <button onClick={handleEngineerMarkComplete} className="flex-1 rounded py-2 text-center text-[11px] font-bold" style={{
                    background: "linear-gradient(180deg, #4ade60 0%, #22a838 100%)", color: "#fff", border: "1px solid rgba(74,222,96,0.5)",
                  }}>✅ Mark Complete</button>
                )}
                {isArtist && (
                  <button onClick={handleArtistConfirmComplete} className="flex-1 rounded py-2 text-center text-[11px] font-bold" style={{
                    background: "linear-gradient(180deg, #4ade60 0%, #22a838 100%)", color: "#fff", border: "1px solid rgba(74,222,96,0.5)",
                  }}>✅ Confirm Complete</button>
                )}
              </Panel>
            )}
          </div>

          {/* ── RIGHT: W.Studio Plugin Panel ── */}
          <div className="row-span-4 flex flex-col" style={{ gridRow: "1 / -1" }}>
            <PluginPanel
              sessionTitle={sessionDisplayName || "Session: Live"}
              connected={connected}
              talkbackActive={talkbackHeld}
              onTalkDown={beginTalkback}
              onTalkUp={endTalkback}
              sessionLink={sessionId.trim() ? `w.studio/${sessionId.trim()}` : "w.studio/—"}
              remoteMicLevel={remoteMicLevel}
              sendLevel={localMicLevel}
            />
          </div>
            </>
          )}
        </div>
      </div>

      <ExtensionApprovalDialog
        open={extensionModalOpen}
        onOpenChange={setExtensionModalOpen}
        pending={pendingExtension}
        rates={sessionRates}
        onApprove={approveExtension}
        onDecline={declineExtension}
      />

      {/* ─── Expanded video overlays ─── */}
      {expandedPanel === "artist" && (
        <ExpandedVideoOverlay
          stream={artistStream}
          mirrored={artistMirrored}
          label="Artist View"
          audioMuted={isArtist}
          volume={isEngineer ? remoteTileVolume : 1}
          onClose={() => setExpandedPanel(null)}
        />
      )}
      {expandedPanel === "engineer" && (
        <ExpandedVideoOverlay
          stream={engineerStream}
          mirrored={engineerMirrored}
          label="Engineer View"
          screenShareStream={collaborationShareActive ? screenShareViewStream : null}
          audioMuted={isEngineer}
          volume={isArtist ? 1 : remoteTileVolume}
          onClose={() => setExpandedPanel(null)}
        />
      )}
      {expandedPanel === "screen" && (
        <ExpandedVideoOverlay
          stream={screenShareViewStream}
          label="Screen Share — DAW View"
          audioMuted={isEngineer}
          volume={isArtist ? 1 : 1}
          onClose={() => setExpandedPanel(null)}
        />
      )}
    </div>
  );
}
