import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSession } from "./SessionContext";
import { useBookingTimer } from "../booking/BookingTimerContext";
import { SessionTimerBar } from "../booking/SessionTimerBar";
import { SessionControlsLockOverlay } from "../booking/SessionControlsLockOverlay";
import { ExtensionApprovalDialog } from "../booking/ExtensionApprovalDialog";
import { formatCurrency } from "../booking/bookingTypes";

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

function LedMeter({ level = 0.5, height = 90 }: { level?: number; height?: number }) {
  const segs = 16;
  return (
    <div className="flex flex-col-reverse gap-[2px]" style={{ height, width: 10 }}>
      {Array.from({ length: segs }).map((_, i) => {
        const pct = (i + 1) / segs;
        const on = pct <= level;
        let color = C.green;
        if (pct > 0.6) color = C.yellow;
        if (pct > 0.82) color = C.red;
        return (<div key={i} className="flex-1 rounded-[1px]" style={{ backgroundColor: on ? color : "#1a1b1e" }} />);
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

function Waveform({ recording }: { recording: boolean }) {
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
      ctx.strokeStyle = recording ? "#8a8c92" : "#3a3c41";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const spd = recording ? t * 0.003 : 0;
        const amp = Math.sin(x * 0.028 + spd) * 14 + Math.sin(x * 0.065 + spd * 0.7) * 9 + Math.sin(x * 0.14 + spd * 1.4) * 4;
        const taper = 0.4 + 0.6 * Math.sin((x / w) * Math.PI);
        ctx.lineTo(x, h / 2 + amp * taper);
      }
      ctx.stroke();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [recording]);
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

/* ═══════════════════════════════════════════════════════════
   UNIFIED SESSION SCREEN
   ═══════════════════════════════════════════════════════════ */
export default function UnifiedSessionScreen() {
  const {
    role, connection, sessionDisplayName, muted, toggleMute, talkbackHeld, beginTalkback, endTalkback,
    remoteVocalLevel, live, setSessionRecording, demoClock, leaveSession, screenSharing, toggleScreenShare, collaborationShareActive,
  } = useSession();

  const {
    booking, totalBookedMinutes, remainingSeconds: bookingRemaining, warningLevel, timerRunning, phase, pendingExtension,
    sessionValueTotal, startSessionTimer, requestExtension, approveExtension, declineExtension, engineerContinueSession,
    extensionModalOpen, setExtensionModalOpen, controlsLocked, sessionRates,
  } = useBookingTimer();

  const isEngineer = role === "engineer";
  const isArtist = role === "artist";
  const recording = live.recording;
  const hasBooking = !!booking && booking.bookedMinutes > 0;
  const isMobile = useIsMobile();
  const [armed, setArmed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [vocalLevel, setVocalLevel] = useState(0.55);
  const [talkbackLevel, setTalkbackLevel] = useState(0.45);
  const [headphoneLevel, setHeadphoneLevel] = useState(0.7);
  const [cueMix, setCueMix] = useState(0.5);
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

  return (
    <div ref={shellRef} className={`flex select-none overflow-hidden ${isMobile ? "flex-col overflow-y-auto" : "min-h-screen items-center justify-center"}`} style={{ background: "#111214", padding: isFullscreen ? 0 : isMobile ? 0 : 16 }}>
      <div className="w-full overflow-hidden flex flex-col" style={{
        maxWidth: isFullscreen ? "100%" : isMobile ? "100%" : 1100,
        height: isFullscreen ? "100vh" : "auto",
        borderRadius: isFullscreen || isMobile ? 0 : 8,
        background: `linear-gradient(180deg, ${C.shell} 0%, ${C.shellDark} 100%)`,
        border: isFullscreen || isMobile ? "none" : `1px solid ${C.shellEdge}`,
        boxShadow: isFullscreen || isMobile ? "none" : `0 24px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)`,
        color: C.text,
      }}>
        {/* ─── TITLE BAR ─── */}
        <div className="flex items-center justify-between px-5" style={{ height: 48, borderBottom: `1px solid ${C.panelBorder}` }}>
          <div className="flex items-end gap-2">
            <span className="text-[20px] font-black tracking-tight" style={{ display: "inline-flex", alignItems: "baseline" }}>
              <svg width="24" height="18" viewBox="0 0 24 18" fill="none" style={{ marginRight: 1, position: "relative", top: 1 }}>
                <path d="M0 1L4 17H5L9 5L13 17H14L18 1H16L13 12L9.5 1H8.5L5 12L2 1H0Z" fill={C.white} />
                <line x1="17.5" y1="-1" x2="11.5" y2="19" stroke={C.blue} strokeWidth="4" strokeLinecap="round" />
              </svg>
              <span style={{ color: C.blue }}>.</span>STUDIO
            </span>
            <span style={{ color: C.label, fontSize: 12, fontWeight: 300, letterSpacing: "0.1em", paddingBottom: 2 }}>RECEIVE</span>
          </div>
          <div className="flex items-center gap-3" style={{ color: C.label }}>
            <button onPointerDown={(e) => { e.preventDefault(); toggleFullscreen(); }} className="hover:text-white" title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
              {isFullscreen ? "⊡" : "⛶"}
            </button>
            <button className="hover:text-white">☰</button>
            <button onPointerDown={(e) => { e.preventDefault(); leaveSession(); }} className="hover:text-white">✕</button>
          </div>
        </div>

        {/* ─── MAIN GRID ─── */}
        <div className={`relative grid gap-2 p-2 ${isFullscreen ? "flex-1" : ""}`} style={{ gridTemplateColumns: isMobile ? "1fr" : "280px 1fr 260px", gridTemplateRows: isFullscreen ? "auto 1fr auto auto" : "auto auto auto auto" }}>
          {controlsLocked && <SessionControlsLockOverlay />}

          {/* ── LEFT COLUMN: Videos + Controls (spans all content rows) ── */}
          <div className={`${isMobile ? "" : "row-span-3"} flex flex-col gap-2`}>
            {/* Artist Video */}
            <Panel accent={C.acMagenta} className="relative" style={{ aspectRatio: "4/3" }}>
              <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: C.inset }}>
                <span className="text-[28px] font-black tracking-tight" style={{ color: C.dim }}>W<span style={{ color: C.blue }}>.</span>STUDIO</span>
                <span style={{ color: C.dim, fontSize: 11, letterSpacing: "0.14em", marginTop: 4 }}>WAITING FOR ARTIST</span>
              </div>
              <div className="absolute bottom-2 left-2 rounded px-2 py-1 text-[12px] font-medium" style={{ background: "rgba(0,0,0,0.6)", color: C.dim }}>No one connected</div>
              <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-md px-2 py-1" style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", border: `1px solid ${(hasBooking ? warningLevel : "ok") === "critical" ? "rgba(239,68,68,0.5)" : (hasBooking ? warningLevel : "ok") === "warning" ? "rgba(245,200,66,0.4)" : "rgba(255,255,255,0.1)"}` }}>
                <span className={`font-mono text-[14px] font-bold tabular-nums ${(hasBooking ? warningLevel : "ok") === "critical" ? "animate-pulse" : ""}`} style={{ color: (hasBooking ? warningLevel : "ok") === "critical" ? C.red : (hasBooking ? warningLevel : "ok") === "warning" ? C.yellow : C.text }}>
                  {(() => { const rs = hasBooking ? bookingRemaining : demoClock.remainingSeconds; return `${String(Math.floor(rs / 60)).padStart(2, "0")}:${String(rs % 60).padStart(2, "0")}`; })()}
                </span>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: (hasBooking ? phase : demoClock.phase) === "live" ? C.green : (hasBooking ? phase : demoClock.phase) === "ended" ? C.red : C.dim }} />
              </div>
            </Panel>

            {/* Engineer Video */}
            <Panel accent={C.acGreen} className="relative" style={{ aspectRatio: "4/3" }}>
              <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: C.inset }}>
                <span className="text-[28px] font-black tracking-tight" style={{ color: C.dim }}>W<span style={{ color: C.blue }}>.</span>STUDIO</span>
                <span style={{ color: C.dim, fontSize: 11, letterSpacing: "0.14em", marginTop: 4 }}>WAITING FOR ENGINEER</span>
              </div>
              <div className="absolute bottom-2 left-2 rounded px-2 py-1 text-[12px] font-medium" style={{ background: "rgba(0,0,0,0.6)", color: C.dim }}>No one connected</div>
              <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-md px-2 py-1" style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", border: `1px solid ${(hasBooking ? warningLevel : "ok") === "critical" ? "rgba(239,68,68,0.5)" : (hasBooking ? warningLevel : "ok") === "warning" ? "rgba(245,200,66,0.4)" : "rgba(255,255,255,0.1)"}` }}>
                <span className={`font-mono text-[14px] font-bold tabular-nums ${(hasBooking ? warningLevel : "ok") === "critical" ? "animate-pulse" : ""}`} style={{ color: (hasBooking ? warningLevel : "ok") === "critical" ? C.red : (hasBooking ? warningLevel : "ok") === "warning" ? C.yellow : C.text }}>
                  {(() => { const rs = hasBooking ? bookingRemaining : demoClock.remainingSeconds; return `${String(Math.floor(rs / 60)).padStart(2, "0")}:${String(rs % 60).padStart(2, "0")}`; })()}
                </span>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: (hasBooking ? phase : demoClock.phase) === "live" ? C.green : (hasBooking ? phase : demoClock.phase) === "ended" ? C.red : C.dim }} />
              </div>
              {isEngineer && (
                <div className="absolute bottom-2 right-2 rounded-md px-2 py-1" style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}>
                  <span className="font-mono text-[12px] font-semibold" style={{ color: C.green }}>{formatCurrency(sessionValueTotal)}</span>
                </div>
              )}
            </Panel>

            {/* Mute / Talk / Settings */}
            <Panel accent={C.acOrange}>
              <div className="grid grid-cols-3" style={{ borderTop: `1px solid ${C.panelBorder}` }}>
                <button onPointerDown={(e) => { e.preventDefault(); toggleMute(); }} className="flex flex-col items-center justify-center gap-1.5 py-3">
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={muted ? C.red : C.label} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                  <span style={{ fontSize: 11, color: C.text }}>Mute</span>
                </button>
                <button onPointerDown={beginTalkback} onPointerUp={endTalkback} onPointerLeave={endTalkback} className="flex flex-col items-center justify-center gap-1.5 py-3" style={{ borderLeft: `1px solid ${C.panelBorder}`, borderRight: `1px solid ${C.panelBorder}` }}>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{
                    background: talkbackHeld ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.3), ${C.blue})` : `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.25), ${C.blue})`,
                    boxShadow: talkbackHeld ? `0 0 16px ${C.blue}40` : "none",
                  }}>
                    <span style={{ color: C.white, fontSize: 14 }}>▶</span>
                  </div>
                  <span style={{ fontSize: 11, color: C.text }}>Talk</span>
                </button>
                <button className="flex flex-col items-center justify-center gap-1.5 py-3">
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={C.label} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span style={{ fontSize: 11, color: C.text }}>Settings</span>
                </button>
              </div>
            </Panel>
          </div>

          {/* ── SESSION STATUS BAR (top, spans center + right) ── */}
          <Panel accent={C.acCyan} className="col-span-2 flex items-center justify-between px-4" style={{ height: 48 }}>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 16, fontWeight: 500, color: C.text }}>{sessionDisplayName || "Session: Live with Jay - Florida"}</span>
              <span className="rounded px-2.5 py-1 text-[11px] font-bold uppercase" style={{
                background: connected ? "linear-gradient(180deg, #4ade60 0%, #22a838 100%)" : C.panelDark,
                color: connected ? C.white : C.dim, letterSpacing: "0.06em",
                boxShadow: connected ? "inset 0 1px 0 rgba(255,255,255,0.2)" : "none",
              }}>
                {connected ? "CONNECTED" : connection.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {[
                { icon: "🔊", handler: undefined },
                { icon: "🖥", handler: isEngineer ? toggleScreenShare : undefined },
                { icon: "✕", handler: undefined },
                { icon: "⚙", handler: undefined },
              ].map((btn, i) => (
                <button key={i} onPointerDown={btn.handler ? (e) => { e.preventDefault(); btn.handler!(); } : undefined} className="flex h-9 w-9 items-center justify-center rounded" style={{
                  background: `linear-gradient(180deg, ${C.panelLight} 0%, ${C.panelDark} 100%)`,
                  border: `1px solid ${C.panelBorder}`, color: C.label, fontSize: 15,
                  cursor: btn.handler ? "pointer" : "default",
                }}>{btn.icon}</button>
              ))}
            </div>
          </Panel>

          {/* ── CENTER: SYNC CONTROLS + VOCAL INPUT (merged card) ── */}
          {collaborationShareActive ? (
            <Panel accent={C.acCyan} className="relative flex flex-col">
              <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: `1px solid ${C.panelBorder}` }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.label, letterSpacing: "0.12em", textTransform: "uppercase" }}>SCREEN SHARE — DAW VIEW</span>
                <div className="flex items-center gap-2">
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />
                  <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>LIVE</span>
                </div>
              </div>
              <div className="flex flex-1 items-center justify-center" style={{ background: C.inset, minHeight: 180 }}>
                <div className="flex flex-col items-center gap-2">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={C.dim} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  <span style={{ color: C.label, fontSize: 13, fontWeight: 500 }}>{isEngineer ? "Your screen is being shared" : "Engineer's DAW"}</span>
                  <span style={{ color: C.dim, fontSize: 11 }}>Pro Tools / Logic Pro</span>
                </div>
              </div>
            </Panel>
          ) : (
            <Panel accent={C.acPurple} className="p-4">
              {/* Sync Controls */}
              <div style={{ fontSize: 12, fontWeight: 600, color: C.label, letterSpacing: "0.12em", textTransform: "uppercase" }}>SYNC CONTROLS</div>
              <div className="my-3 text-center" style={{ fontSize: 16, fontWeight: 600, color: C.text }}>– SYNCED: 120 BPM –</div>
              <div className="flex items-center justify-center gap-2">
                <button onPointerDown={isEngineer ? (e) => { e.preventDefault(); setPlaying(true); } : undefined} className="flex items-center gap-2 rounded-[3px] px-5 py-2.5 text-[15px] font-semibold" style={{
                  background: playing ? `linear-gradient(180deg, #1a3a1a 0%, #0e2a0e 100%)` : `linear-gradient(180deg, ${C.panelLight} 0%, ${C.panelDark} 100%)`,
                  border: `1px solid ${playing ? "#2a6a2a" : C.panelBorder}`, color: C.text,
                  boxShadow: playing ? `0 0 14px rgba(74,222,96,0.15)` : `inset 0 1px 0 rgba(255,255,255,0.05)`,
                  opacity: isEngineer ? 1 : 0.4, cursor: isEngineer ? "pointer" : "not-allowed", minWidth: 110,
                }}>
                  <span style={{ color: playing ? C.green : C.text }}>▶</span> Play
                </button>
                <button onPointerDown={isEngineer ? (e) => { e.preventDefault(); setPlaying(false); if (recording) setSessionRecording(false); } : undefined} className="flex items-center gap-2 rounded-[3px] px-5 py-2.5 text-[15px] font-semibold" style={{
                  background: `linear-gradient(180deg, ${C.panelLight} 0%, ${C.panelDark} 100%)`,
                  border: `1px solid ${C.panelBorder}`, color: C.text,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05)`,
                  opacity: isEngineer ? 1 : 0.4, cursor: isEngineer ? "pointer" : "not-allowed", minWidth: 110,
                }}>
                  <span style={{ color: C.red }}>■</span> Stop
                </button>
                <button onPointerDown={isEngineer ? (e) => { e.preventDefault(); setSessionRecording(!recording); if (!playing) setPlaying(true); } : undefined} className="flex items-center gap-2 rounded-[3px] px-5 py-2.5 text-[15px] font-semibold" style={{
                  background: recording ? `linear-gradient(180deg, #4a1a1a 0%, #2a0e0e 100%)` : `linear-gradient(180deg, ${C.panelLight} 0%, ${C.panelDark} 100%)`,
                  border: `1px solid ${recording ? "#6a2222" : C.panelBorder}`, color: C.text,
                  boxShadow: recording ? `0 0 14px rgba(239,68,68,0.15)` : `inset 0 1px 0 rgba(255,255,255,0.05)`,
                  opacity: isEngineer ? 1 : 0.4, cursor: isEngineer ? "pointer" : "not-allowed", minWidth: 110,
                }}>
                  <span className={recording ? "animate-pulse" : ""} style={{ color: C.red }}>●</span> Record
                </button>
              </div>

              {/* Vocal Input (merged) */}
              <div className="mt-4" style={{ borderTop: `1px solid ${C.panelBorder}`, paddingTop: 12 }}>
                <div className="mb-2 flex items-center justify-between">
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.label, letterSpacing: "0.12em", textTransform: "uppercase" }}>VOCAL INPUT</span>
                  <div className="flex items-center gap-1 rounded-[3px] px-1.5 py-0.5" style={{ background: C.inset, border: `1px solid ${C.insetBorder}` }}>
                    <div className="h-2.5 w-1.5 rounded-sm" style={{ background: C.blue }} />
                    <div className="h-2.5 w-1.5 rounded-sm" style={{ background: C.yellow }} />
                  </div>
                </div>
                <div className="mb-3 text-center" style={{ fontSize: 16, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: "0.04em" }}>REMOTE VOCAL</div>
                <Inset className="p-3">
                  <HorizontalMeter level={0} />
                  <div className="mt-2"><SpectrumBars level={0} /></div>
                  <div className="mt-1"><FreqLabels /></div>
                </Inset>
                <div className="mt-4 flex justify-center">
                  <button onPointerDown={isEngineer ? (e) => { e.preventDefault(); setArmed(!armed); } : undefined} className="rounded-[3px] px-8 py-2.5 text-[15px] font-bold uppercase tracking-wide" style={{
                    background: armed ? `linear-gradient(180deg, #4a1a1a 0%, #2a0e0e 100%)` : `linear-gradient(180deg, ${C.panelLight} 0%, ${C.panelDark} 100%)`,
                    border: `1px solid ${armed ? "#6a2222" : C.panelBorder}`, color: C.text,
                    boxShadow: armed ? `0 0 14px rgba(239,68,68,0.15)` : `inset 0 1px 0 rgba(255,255,255,0.05)`,
                    opacity: isEngineer ? 1 : 0.4, cursor: isEngineer ? "pointer" : "not-allowed",
                  }}>ARM RECORD</button>
                </div>
              </div>
            </Panel>
          )}

          {/* ── RIGHT: MONITORING (spans 2 rows beside center cards) ── */}
          <Panel accent={C.acLime} className="p-4">
            <div className="mb-1 flex items-center justify-between">
              <span style={{ fontSize: 12, fontWeight: 600, color: C.label, letterSpacing: "0.12em", textTransform: "uppercase" }}>MONITORING</span>
              <div className="flex gap-[2px]">
                {[3, 5, 4, 6, 3, 2].map((h, i) => (<div key={i} className="rounded-full" style={{ width: 3, height: h * 2, background: C.label }} />))}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4">
              <div className="flex flex-col items-center gap-1">
                <span style={{ fontSize: 11, fontWeight: 500, color: C.text }}>Vocal Level</span>
                <div className="flex items-end gap-2">
                  <Knob value={vocalLevel} size={58} onChange={setVocalLevel} accent={C.acLime} />
                  <LedMeter level={0} height={72} />
                  <Fader value={vocalLevel} height={72} onChange={setVocalLevel} />
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span style={{ fontSize: 11, fontWeight: 500, color: C.text }}>Talkback Level</span>
                <div className="flex items-end gap-2">
                  <Knob value={talkbackLevel} size={58} onChange={setTalkbackLevel} accent={C.acCyan} />
                  <LedMeter level={0} height={72} />
                  <Fader value={talkbackLevel} height={72} onChange={setTalkbackLevel} />
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span style={{ fontSize: 11, fontWeight: 500, color: C.text }}>Headphone</span>
                <div className="flex items-end gap-2">
                  <Knob value={headphoneLevel} size={58} onChange={setHeadphoneLevel} accent={C.acOrange} />
                  <LedMeter level={0} height={72} />
                  <Fader value={headphoneLevel} height={72} onChange={setHeadphoneLevel} />
                </div>
                <span style={{ fontSize: 8, color: C.dim, letterSpacing: "0.08em" }}>🎧 HP OUT</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span style={{ fontSize: 11, fontWeight: 500, color: C.text }}>Cue Mix</span>
                <Knob value={cueMix} size={58} onChange={setCueMix} accent={C.acPurple} />
                <div className="flex w-full items-center justify-between px-1" style={{ fontSize: 8, color: C.dim }}>
                  <span>VOX</span><span>BEAT</span>
                </div>
                <div className="mt-0.5 overflow-hidden rounded-sm" style={{ height: 4, width: "80%", background: C.track, border: `1px solid ${C.insetBorder}` }}>
                  <div className="h-full rounded-sm" style={{ width: `${cueMix * 100}%`, background: `linear-gradient(90deg, ${C.blue} 0%, ${C.green} 100%)` }} />
                </div>
              </div>
            </div>
          </Panel>

          {/* ── VOCAL TAKE WAVEFORM (compact, same height as mute/talk/settings) ── */}
          <Panel accent={C.acCyan} className="col-span-2 flex items-center gap-3 px-3 py-2">
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>Jay's Vocal Take 4 - {recording ? "Recording..." : "Ready"}</span>
            <Inset className="flex-1 overflow-hidden rounded-[3px] p-0.5">
              <Waveform recording={recording} />
            </Inset>
            <span style={{ color: C.dim, fontSize: 13 }}>▐▐</span>
          </Panel>

          {/* ── BOTTOM: TRANSPORT BAR (full width, single long card) ── */}
          <Panel accent={C.acPurple} className="col-span-3 flex items-center gap-2 px-3 py-2">
            <TBtn sym="▌▌" label="Punch In" disabled={!isEngineer} />
            <TBtn sym="<<" label="Rewind" disabled={!isEngineer} />
            <TBtn sym="▶▶" label="Forward" disabled={!isEngineer} />
            <div className="ml-2 flex items-center gap-2 rounded-[3px] px-5 py-2 text-[15px] font-bold" style={{
              background: recording ? `linear-gradient(180deg, #4a1a1a 0%, #2a0e0e 100%)` : `linear-gradient(180deg, ${C.panelLight} 0%, ${C.panelDark} 100%)`,
              border: `1px solid ${recording ? "#6a2222" : C.panelBorder}`, minWidth: 240, justifyContent: "center",
            }}>
              <span className={recording ? "animate-pulse" : ""} style={{ color: C.red }}>●</span>
              <span style={{ color: C.red }}>REC</span>
              <span style={{ color: recording ? C.red : C.dim }}>{recording ? "● RECORDING..." : ""}</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex gap-[3px] rounded-[3px] px-1.5 py-1" style={{ background: C.inset, border: `1px solid ${C.insetBorder}` }}>
                <span className="rounded-[1px]" style={{ width: 8, height: 12, background: autoUpload ? C.green : C.dim }} />
                <span className="rounded-[1px]" style={{ width: 8, height: 12, background: autoUpload ? C.green : C.dim }} />
                <span className="rounded-[1px]" style={{ width: 8, height: 12, background: autoUpload ? C.yellow : C.dim }} />
                <span className="rounded-[1px]" style={{ width: 8, height: 12, background: C.dim }} />
              </div>
              <span style={{ fontSize: 11, color: C.label, letterSpacing: "0.06em", textTransform: "uppercase" }}>AUTO UPLOAD:</span>
              <button onPointerDown={(e) => { e.preventDefault(); setAutoUpload(!autoUpload); }} style={{ fontSize: 11, fontWeight: 700, color: autoUpload ? C.green : C.red, cursor: "pointer", background: "none", border: "none" }}>
                {autoUpload ? "ON ▶" : "OFF ■"}
              </button>
            </div>
          </Panel>
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
    </div>
  );
}
