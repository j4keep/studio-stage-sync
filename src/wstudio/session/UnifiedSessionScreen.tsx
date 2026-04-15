import { useEffect, useRef, useState, useCallback } from "react";
import PluginPanel from "./PluginPanel";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSession } from "./SessionContext";
import { useStudioMedia } from "../media/StudioMediaContext";
import { useBookingTimer } from "../booking/BookingTimerContext";
import { SessionControlsLockOverlay } from "../booking/SessionControlsLockOverlay";
import { ExtensionApprovalDialog } from "../booking/ExtensionApprovalDialog";
import { formatCurrency } from "../booking/bookingTypes";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const canScreenShare = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

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
  text: "#e8e8ea",
  label: "#9a9ca2",
  dim: "#656770",
  green: "#4ade60",
  yellow: "#f5c842",
  red: "#ef4444",
  blue: "#3b9dff",
  white: "#ffffff",
  acMagenta: "#e040a0",
  acGreen: "#40e060",
  acOrange: "#f08030",
  acCyan: "#40d0e0",
};

/* ─── Panel wrapper ─── */
function Panel({ children, style, className = "", accent }: { children: React.ReactNode; style?: React.CSSProperties; className?: string; accent?: string }) {
  return (
    <div className={`overflow-hidden rounded-[4px] ${className}`} style={{
      background: `linear-gradient(180deg, ${C.panelLight} 0%, ${C.panelDark} 100%)`,
      border: accent ? `1.5px solid ${accent}` : `1px solid ${C.panelBorder}`,
      boxShadow: accent ? `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 12px ${accent}30` : `inset 0 1px 0 rgba(255,255,255,0.04)`,
      ...style,
    }}>{children}</div>
  );
}

/* ─── Live Video Feed ─── */
function VideoFeed({ stream, mirrored, muted = true, volume = 1 }: { stream: MediaStream | null; mirrored?: boolean; muted?: boolean; volume?: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream ?? null;
    el.volume = Math.min(1, Math.max(0, volume));
    if (stream) {
      el.play().catch(() => {
        const retry = () => { el.play().catch(() => {}); document.removeEventListener("click", retry); document.removeEventListener("touchstart", retry); };
        document.addEventListener("click", retry, { once: true });
        document.addEventListener("touchstart", retry, { once: true });
      });
    }
  }, [stream, volume]);
  if (!stream) return null;
  return <video ref={ref} autoPlay playsInline muted={muted} className="absolute inset-0 h-full w-full object-cover" style={mirrored ? { transform: "scaleX(-1)" } : undefined} />;
}

/* ─── Expanded video overlay ─── */
function ExpandedVideoOverlay({ stream, mirrored, label, screenShareStream, audioMuted = true, volume = 1, onClose }: {
  stream: MediaStream | null; mirrored?: boolean; label: string; screenShareStream?: MediaStream | null; audioMuted?: boolean; volume?: number; onClose: () => void;
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
        <span style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{label}</span>
        <button onClick={onClose} className="rounded px-3 py-1 text-[11px] font-bold uppercase" style={{ background: "rgba(255,255,255,0.1)", color: C.text, border: "1px solid rgba(255,255,255,0.2)" }}>✕ Close</button>
      </div>
      <div className="relative flex-1">
        {activeStream ? (
          <video ref={vidRef} autoPlay playsInline muted={audioMuted} className="absolute inset-0 h-full w-full object-contain" style={isMirrored ? { transform: "scaleX(-1)" } : undefined} />
        ) : (
          <div className="flex h-full items-center justify-center" style={{ color: C.dim }}>No stream available</div>
        )}
      </div>
    </div>
  );
}

/* ─── Video tile action buttons ─── */
function VideoTileActions({ hasSession, onJoin, onEnd, expanded, onToggleExpand }: {
  hasSession: boolean; onJoin: () => void; onEnd: () => void; expanded: boolean; onToggleExpand: () => void;
}) {
  return (
    <>
      <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
        {!hasSession && (
          <button onClick={onJoin} className="rounded px-2 py-1 text-[9px] font-bold uppercase tracking-wide" style={{ background: "linear-gradient(180deg, #f59e0b 0%, #b45309 100%)", color: "#fff", border: "1px solid rgba(245,158,11,0.5)" }}>Join</button>
        )}
        {hasSession && (
          <button onClick={onEnd} className="rounded px-2 py-1 text-[9px] font-bold uppercase tracking-wide" style={{ background: "linear-gradient(180deg, #ef4444 0%, #991b1b 100%)", color: "#fff", border: "1px solid rgba(239,68,68,0.5)" }}>End</button>
        )}
      </div>
      <div className="absolute bottom-2 right-2 z-10">
        <button onClick={onToggleExpand} className="rounded px-1.5 py-1 text-[9px] font-bold" style={{ background: "rgba(0,0,0,0.7)", color: C.text, border: "1px solid rgba(255,255,255,0.15)" }}>{expanded ? "▾" : "⛶"}</button>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   UNIFIED SESSION SCREEN — Live Session Dashboard
   ═══════════════════════════════════════════════════════════ */
export default function UnifiedSessionScreen() {
  const navigate = useNavigate();
  const {
    role, connection, sessionDisplayName, muted, toggleMute, talkbackHeld, beginTalkback, endTalkback,
    live, demoClock, leaveSession, screenSharing, toggleScreenShare, collaborationShareActive, sessionId,
  } = useSession();
  const {
    localStream, remoteStream, remoteStreamForPlayback, localScreenPreview,
    localTalkbackTxLevel, remoteMicLevel, hasRemoteAudio,
  } = useStudioMedia();
  const {
    booking, totalBookedMinutes, remainingSeconds: bookingRemaining, warningLevel, timerRunning, phase, pendingExtension,
    sessionValueTotal, startSessionTimer, requestExtension, approveExtension, declineExtension, engineerContinueSession,
    extensionModalOpen, setExtensionModalOpen, controlsLocked, sessionRates,
  } = useBookingTimer();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const isEngineer = role === "engineer";
  const isArtist = role === "artist";
  const hasBooking = !!booking && booking.bookedMinutes > 0;
  const connected = connection === "connected";

  const artistStream = isArtist ? localStream : remoteStreamForPlayback;
  const engineerStream = isEngineer ? localStream : remoteStreamForPlayback;
  const artistMirrored = isArtist;
  const engineerMirrored = isEngineer;
  const screenShareViewStream = isEngineer ? localScreenPreview : (collaborationShareActive ? remoteStreamForPlayback : null);
  const peerPtt = isEngineer ? live.artistPtt : live.engineerPtt;

  const [expandedPanel, setExpandedPanel] = useState<"artist" | "engineer" | "screen" | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const [mobileTab, setMobileTab] = useState<"video" | "status">("video");

  const goToJoin = useCallback(() => navigate("/wstudio/session/join"), [navigate]);
  const handleEndSession = useCallback(() => { leaveSession(); navigate("/wstudio/session/join"); }, [leaveSession, navigate]);

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

  // Timer values
  const timerSeconds = hasBooking ? bookingRemaining : demoClock.remainingSeconds;
  const timerWarning = hasBooking ? warningLevel : "ok";
  const timerPhase = hasBooking ? phase : demoClock.phase;
  const timerDisplay = `${String(Math.floor(timerSeconds / 60)).padStart(2, "0")}:${String(timerSeconds % 60).padStart(2, "0")}`;

  // Engineer marks session complete
  const handleEngineerMarkComplete = useCallback(async () => {
    if (!sessionId.trim() || !user) return;
    try {
      const { data: bookingData } = await (supabase as any).from("studio_bookings").select("id, user_id, studio_id, session_code").eq("session_code", sessionId.trim().toUpperCase()).single();
      if (bookingData) {
        await (supabase as any).from("studio_bookings").update({ engineer_completed_at: new Date().toISOString(), session_status: "awaiting_confirmation" }).eq("id", bookingData.id);
        await (supabase as any).from("notifications").insert({ user_id: bookingData.user_id, type: "booking", title: "✅ Session Complete — Please Verify", body: `Your engineer has marked the session (code: ${bookingData.session_code}) as complete. Please confirm or dispute within 48 hours.`, reference_id: bookingData.id, reference_type: "booking" });
        toast.success("Session marked complete. Awaiting artist confirmation.");
      }
    } catch (err) { console.error(err); toast.error("Failed to mark session complete"); }
    leaveSession(); navigate("/wstudio/session/join");
  }, [sessionId, user, leaveSession, navigate]);

  // Artist confirms session completion
  const handleArtistConfirmComplete = useCallback(async () => {
    if (!sessionId.trim() || !user) return;
    try {
      const { data: bookingData } = await (supabase as any).from("studio_bookings").select("id, studio_id").eq("session_code", sessionId.trim().toUpperCase()).single();
      if (bookingData) {
        await (supabase as any).from("studio_bookings").update({ artist_confirmed: true, artist_responded_at: new Date().toISOString(), session_status: "completed", payout_status: "released" }).eq("id", bookingData.id);
        toast.success("Session confirmed! Payment released.");
      }
    } catch (err) { console.error(err); toast.error("Failed to confirm session"); }
    leaveSession(); navigate("/bookings");
  }, [sessionId, user, leaveSession, navigate]);

  // Plugin status
  const pluginConnected = connected && hasRemoteAudio;

  return (
    <div ref={shellRef} className={`flex select-none overflow-hidden ${isMobile ? "flex-col overflow-y-auto" : "min-h-screen items-center justify-center"}`} style={{ background: "#111214", padding: isFullscreen ? 0 : isMobile ? 0 : 16 }}>
      <div className="w-full overflow-hidden flex flex-col" style={{
        maxWidth: isFullscreen ? "100%" : isMobile ? "100%" : 1200,
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
            <span style={{ color: C.label, fontSize: isMobile ? 10 : 12, fontWeight: 300, letterSpacing: "0.1em", paddingBottom: 2 }}>SESSION</span>
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
        {isMobile && !isArtist && (
          <div className="flex" style={{ borderBottom: `1px solid ${C.panelBorder}` }}>
            {([["video", "📹 Session"], ["status", "📊 Status"]] as const).map(([key, label]) => (
              <button key={key} onPointerDown={(e) => { e.preventDefault(); setMobileTab(key as any); }} className="flex-1 py-2 text-center text-[11px] font-bold uppercase tracking-wide" style={{
                color: mobileTab === key ? C.white : C.dim,
                borderBottom: mobileTab === key ? `2px solid ${C.blue}` : "2px solid transparent",
                background: mobileTab === key ? "rgba(59,157,255,0.08)" : "transparent",
              }}>{label}</button>
            ))}
          </div>
        )}

        {/* ─── MAIN CONTENT ─── */}
        <div className={`relative flex-1 ${isMobile ? "flex flex-col gap-2 p-2 overflow-y-auto" : "grid gap-2 p-3"}`} style={isMobile ? {} : {
          gridTemplateColumns: "280px 1fr 1fr 280px",
          gridTemplateRows: "auto 1fr auto",
        }}>
          {controlsLocked && <SessionControlsLockOverlay />}

          {isMobile && isArtist ? (
            /* ══════════ ARTIST MOBILE: HOLD TO TALK ══════════ */
            <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4" style={{ minHeight: "60vh" }}>
              {/* Connected indicator */}
              <div className="flex items-center gap-2">
                <span className="rounded-full" style={{ width: 10, height: 10, background: connected ? C.green : C.dim, boxShadow: connected ? "0 0 8px rgba(74,222,96,0.5)" : "none" }} />
                <span className="text-[13px] font-semibold" style={{ color: connected ? C.green : C.dim }}>
                  {connected ? "Connected" : "Offline"}
                </span>
              </div>

              {/* Session name */}
              <span className="text-[14px] font-medium" style={{ color: C.label }}>{sessionDisplayName || "Session"}</span>

              {/* Big hold-to-talk button */}
              <button
                onPointerDown={(e) => { e.preventDefault(); beginTalkback(); }}
                onPointerUp={endTalkback}
                onPointerLeave={endTalkback}
                onTouchStart={(e) => { e.preventDefault(); beginTalkback(); }}
                onTouchEnd={(e) => { e.preventDefault(); endTalkback(); }}
                className="flex flex-col items-center justify-center rounded-full transition-all duration-200 select-none"
                style={{
                  width: 160, height: 160,
                  background: talkbackHeld
                    ? "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.3), #0ea5e9, #0369a1)"
                    : "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.15), #3b82f6, #1e40af)",
                  border: `3px solid ${talkbackHeld ? "rgba(14,165,233,0.7)" : "rgba(59,130,246,0.4)"}`,
                  boxShadow: talkbackHeld
                    ? "0 0 60px rgba(14,165,233,0.5), 0 0 120px rgba(14,165,233,0.2)"
                    : "0 0 30px rgba(59,130,246,0.2)",
                  transform: talkbackHeld ? "scale(1.05)" : "scale(1)",
                  touchAction: "none",
                }}
              >
                <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
                <span className="mt-2 text-[14px] font-bold tracking-wider" style={{ color: C.white }}>
                  {talkbackHeld ? "TALKING" : "HOLD TO TALK"}
                </span>
              </button>

              {/* Small level indicator */}
              {talkbackHeld && (
                <div className="flex items-center gap-2">
                  <div className="overflow-hidden rounded-full" style={{ width: 80, height: 4, background: "#222" }}>
                    <div className="h-full rounded-full transition-all duration-100" style={{
                      width: `${Math.min(100, (localTalkbackTxLevel || 0) * 200)}%`,
                      background: C.blue,
                    }} />
                  </div>
                </div>
              )}

              {/* End session */}
              <button
                onPointerDown={(e) => { e.preventDefault(); handleEndSession(); }}
                className="mt-8 rounded-lg px-6 py-2 text-[12px] font-bold uppercase tracking-wide"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: C.red,
                }}
              >
                End Session
              </button>
            </div>
          ) : isMobile ? (
            <>
              {mobileTab === "video" && (
                <div className="flex flex-col gap-2">
                  {/* Session Status */}
                  <Panel accent={C.acCyan} className="flex items-center justify-between px-3" style={{ height: 40 }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{sessionDisplayName || "Session: Live"}</span>
                      <span className="shrink-0 rounded px-2 py-0.5 text-[9px] font-bold uppercase" style={{
                        background: connected ? "linear-gradient(180deg, #4ade60 0%, #22a838 100%)" : C.panelDark,
                        color: connected ? C.white : C.dim,
                      }}>{connected ? "CONNECTED" : connection.toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isEngineer && (
                        <button onClick={() => {
                          if (!canScreenShare) { toast.error("Screen sharing not supported. Use a desktop browser."); return; }
                          toggleScreenShare();
                        }} className="flex h-7 items-center gap-1 rounded px-2 text-[11px] font-semibold" style={{
                          background: screenSharing ? "rgba(59,157,255,0.2)" : C.panelDark,
                          border: `1px solid ${screenSharing ? C.blue : C.panelBorder}`,
                          color: screenSharing ? C.blue : C.label,
                        }}>🖥 {screenSharing ? "Stop" : "Share"}</button>
                      )}
                    </div>
                  </Panel>

                  {/* Artist Video */}
                  <Panel accent={C.acMagenta} className="relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
                    {artistStream ? (
                      <VideoFeed stream={artistStream} mirrored={artistMirrored} muted={isArtist} volume={isEngineer ? 1 : 1} />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: C.inset }}>
                        <span className="text-[20px] font-black tracking-tight" style={{ color: C.dim }}>W<span style={{ color: C.blue }}>.</span>STUDIO</span>
                        <span style={{ color: C.dim, fontSize: 10, letterSpacing: "0.14em", marginTop: 4 }}>WAITING FOR ARTIST</span>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 rounded px-2 py-0.5 text-[10px] font-medium" style={{ background: "rgba(0,0,0,0.6)", color: artistStream ? C.text : C.dim }}>{artistStream ? "Artist" : "No one connected"}</div>
                    <VideoTileActions hasSession={!!role} onJoin={goToJoin} onEnd={handleEndSession} expanded={expandedPanel === "artist"} onToggleExpand={() => setExpandedPanel(expandedPanel === "artist" ? null : "artist")} />
                    <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-md px-2 py-0.5" style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}>
                      <span className={`font-mono text-[12px] font-bold tabular-nums ${timerWarning === "critical" ? "animate-pulse" : ""}`} style={{ color: timerWarning === "critical" ? C.red : timerWarning === "warning" ? C.yellow : C.text }}>{timerDisplay}</span>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: timerPhase === "live" ? C.green : timerPhase === "ended" ? C.red : C.dim }} />
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
                    <div className="absolute bottom-2 left-2 rounded px-2 py-0.5 text-[10px] font-medium" style={{ background: "rgba(0,0,0,0.6)", color: engineerStream ? C.text : C.dim }}>{engineerStream ? "Engineer" : "No one connected"}</div>
                    <VideoTileActions hasSession={!!role} onJoin={goToJoin} onEnd={handleEndSession} expanded={expandedPanel === "engineer"} onToggleExpand={() => setExpandedPanel(expandedPanel === "engineer" ? null : "engineer")} />
                    {isEngineer && (
                      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[5] rounded-md px-2 py-0.5" style={{ background: "rgba(0,0,0,0.72)" }}>
                        <span className="font-mono text-[11px] font-semibold" style={{ color: C.green }}>{formatCurrency(sessionValueTotal)}</span>
                      </div>
                    )}
                  </Panel>

                  {/* Bottom Controls: Mute / Talk / End / Settings */}
                  <Panel accent={C.acOrange}>
                    <div className="grid grid-cols-4" style={{ borderTop: `1px solid ${C.panelBorder}` }}>
                      <button onPointerDown={(e) => { e.preventDefault(); toggleMute(); }} className="flex flex-col items-center justify-center gap-1 py-2.5">
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={muted ? C.red : C.label} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" />
                        </svg>
                        <span style={{ fontSize: 10, color: muted ? C.red : C.text }}>{muted ? "Unmute" : "Mute"}</span>
                      </button>
                      <button
                        onPointerDown={(e) => { e.preventDefault(); beginTalkback(); }}
                        onPointerUp={endTalkback}
                        onPointerLeave={endTalkback}
                        onTouchStart={(e) => { e.preventDefault(); beginTalkback(); }}
                        onTouchEnd={(e) => { e.preventDefault(); endTalkback(); }}
                        className="flex flex-col items-center justify-center gap-1 py-2.5"
                        style={{ borderLeft: `1px solid ${C.panelBorder}`, borderRight: `1px solid ${C.panelBorder}`, touchAction: "none" }}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-100" style={{
                          background: talkbackHeld ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.45), ${C.blue})` : peerPtt ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.22), #2563eb)` : `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.25), ${C.blue})`,
                          boxShadow: talkbackHeld ? `0 0 20px ${C.blue}80` : peerPtt ? `0 0 12px rgba(37,99,235,0.45)` : "none",
                          transform: talkbackHeld ? "scale(1.06)" : "scale(1)",
                        }}>
                          <span style={{ color: C.white, fontSize: 12 }}>🎙</span>
                        </div>
                        <span style={{ fontSize: 10, color: talkbackHeld ? C.blue : C.text, fontWeight: talkbackHeld ? 700 : 400 }}>
                          {talkbackHeld ? "TALKING" : peerPtt ? "INCOMING" : "Talk"}
                        </span>
                      </button>
                      <button onPointerDown={(e) => { e.preventDefault(); handleEndSession(); }} className="flex flex-col items-center justify-center gap-1 py-2.5" style={{ borderRight: `1px solid ${C.panelBorder}` }}>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
                          <span style={{ color: C.red, fontSize: 14 }}>■</span>
                        </div>
                        <span style={{ fontSize: 10, color: C.red }}>End</span>
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

                  {/* Screen share (if active) */}
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
                        {screenShareViewStream ? <VideoFeed stream={screenShareViewStream} /> : (
                          <div className="flex h-full items-center justify-center">
                            <span style={{ color: C.label, fontSize: 11 }}>{isEngineer ? "Your screen is being shared" : "Engineer's DAW"}</span>
                          </div>
                        )}
                        <div className="absolute bottom-2 right-2 z-10">
                          <button onClick={() => setExpandedPanel(expandedPanel === "screen" ? null : "screen")} className="rounded px-1.5 py-1 text-[9px] font-bold" style={{ background: "rgba(0,0,0,0.7)", color: C.text, border: "1px solid rgba(255,255,255,0.15)" }}>⛶</button>
                        </div>
                      </div>
                    </Panel>
                  )}

                  {/* Session complete actions */}
                  {hasBooking && (
                    <Panel accent={C.acGreen} className="p-3">
                      <div className="flex gap-2">
                        {isEngineer && <button onClick={handleEngineerMarkComplete} className="flex-1 rounded-lg py-2.5 text-center text-[12px] font-bold" style={{ background: "linear-gradient(180deg, #4ade60 0%, #22a838 100%)", color: "#fff", border: "1px solid rgba(74,222,96,0.5)" }}>✅ Mark Complete</button>}
                        {isArtist && <button onClick={handleArtistConfirmComplete} className="flex-1 rounded-lg py-2.5 text-center text-[12px] font-bold" style={{ background: "linear-gradient(180deg, #4ade60 0%, #22a838 100%)", color: "#fff", border: "1px solid rgba(74,222,96,0.5)" }}>✅ Confirm Complete</button>}
                      </div>
                    </Panel>
                  )}

                  {/* Extension request (artist) */}
                  {isArtist && hasBooking && phase === "live" && (
                    <Panel accent={C.acOrange} className="p-3">
                      <div className="mb-2" style={{ fontSize: 11, fontWeight: 600, color: C.label, letterSpacing: "0.12em", textTransform: "uppercase" }}>REQUEST MORE TIME</div>
                      {booking?.pendingExtension ? (
                        <div className="text-center py-2" style={{ color: C.yellow, fontSize: 12 }}>⏳ Waiting for engineer to approve +{booking.pendingExtension.minutes} min...</div>
                      ) : (
                        <div className="flex gap-2">
                          {([15, 30, 60] as const).map((mins) => (
                            <button key={mins} onClick={() => requestExtension(mins)} className="flex-1 rounded-lg py-2 text-center text-[12px] font-bold" style={{ background: "linear-gradient(180deg, #f59e0b 0%, #b45309 100%)", color: "#fff", border: "1px solid rgba(245,158,11,0.5)" }}>+{mins} min</button>
                          ))}
                        </div>
                      )}
                    </Panel>
                  )}
                </div>
              )}

              {/* ── MOBILE: STATUS TAB ── */}
              {mobileTab === "status" && (
                <div className="flex flex-col gap-2">
                  {/* Plugin Status */}
                  <Panel accent={C.acCyan} className="p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
                        <path d="M4 8L10 24L16 12L22 24L28 8" stroke="hsl(270,60%,65%)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="14" y1="4" x2="20" y2="28" stroke="hsl(210,90%,60%)" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: "0.05em" }}>PLUGIN STATUS</span>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span style={{ fontSize: 11, color: C.label }}>Plugin</span>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full" style={{ width: 8, height: 8, background: pluginConnected ? C.green : C.dim, boxShadow: pluginConnected ? `0 0 6px rgba(74,222,96,0.5)` : "none" }} />
                          <span style={{ fontSize: 11, fontWeight: 600, color: pluginConnected ? C.green : C.dim }}>{pluginConnected ? "Connected" : "Not Connected"}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span style={{ fontSize: 11, color: C.label }}>DAW</span>
                        <span style={{ fontSize: 11, color: C.text }}>—</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span style={{ fontSize: 11, color: C.label }}>Feed</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: pluginConnected ? C.green : C.dim }}>{pluginConnected ? "Active" : "Inactive"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span style={{ fontSize: 11, color: C.label }}>Talkback</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: talkbackHeld ? C.blue : C.dim }}>{talkbackHeld ? "Active" : "Inactive"}</span>
                      </div>
                    </div>
                  </Panel>

                  {/* Session Info */}
                  <Panel accent={C.acCyan} className="p-4">
                    <div className="mb-3" style={{ fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: "0.05em" }}>SESSION INFO</div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span style={{ fontSize: 11, color: C.label }}>Session</span>
                        <span style={{ fontSize: 11, color: C.text }}>{sessionDisplayName || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span style={{ fontSize: 11, color: C.label }}>Status</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: connected ? C.green : C.dim }}>{connected ? "Live" : "Offline"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span style={{ fontSize: 11, color: C.label }}>Timer</span>
                        <span className="font-mono text-[13px] font-bold" style={{ color: timerWarning === "critical" ? C.red : timerWarning === "warning" ? C.yellow : C.text }}>{timerDisplay}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span style={{ fontSize: 11, color: C.label }}>Code</span>
                        <span className="font-mono text-[11px]" style={{ color: C.label }}>{sessionId || "—"}</span>
                      </div>
                      {isEngineer && (
                        <div className="flex items-center justify-between">
                          <span style={{ fontSize: 11, color: C.label }}>Value</span>
                          <span className="font-mono text-[11px]" style={{ color: C.green }}>{formatCurrency(sessionValueTotal)}</span>
                        </div>
                      )}
                    </div>
                  </Panel>
                </div>
              )}
            </>
          ) : (
            /* ══════════ DESKTOP LAYOUT ══════════ */
            <>
              {/* ── SESSION STATUS BAR (spans full width) ── */}
              <Panel accent={C.acCyan} className="col-span-4 flex items-center justify-between px-4" style={{ height: 48 }}>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 16, fontWeight: 500, color: C.text }}>{sessionDisplayName || "Session: Live"}</span>
                  <span className="rounded px-2.5 py-1 text-[11px] font-bold uppercase" style={{
                    background: connected ? "linear-gradient(180deg, #4ade60 0%, #22a838 100%)" : C.panelDark,
                    color: connected ? C.white : C.dim, letterSpacing: "0.06em",
                  }}>{connected ? "CONNECTED" : connection.toUpperCase()}</span>
                  <span className={`font-mono text-[14px] font-bold tabular-nums ${timerWarning === "critical" ? "animate-pulse" : ""}`} style={{ color: timerWarning === "critical" ? C.red : timerWarning === "warning" ? C.yellow : C.text }}>{timerDisplay}</span>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: timerPhase === "live" ? C.green : timerPhase === "ended" ? C.red : C.dim }} />
                </div>
                <div className="flex items-center gap-2">
                  {isEngineer && (
                    <button onPointerDown={(e) => { e.preventDefault(); if (!canScreenShare) { toast.error("Screen sharing not supported."); return; } toggleScreenShare(); }} className="flex h-9 items-center gap-1.5 rounded px-3 text-[11px] font-semibold" style={{
                      background: screenSharing ? "rgba(59,157,255,0.2)" : `linear-gradient(180deg, ${C.panelLight} 0%, ${C.panelDark} 100%)`,
                      border: `1px solid ${screenSharing ? C.blue : C.panelBorder}`, color: screenSharing ? C.blue : C.label,
                    }}>🖥 {screenSharing ? "Stop Share" : "Share Screen"}</button>
                  )}
                  {isEngineer && <span className="font-mono text-[12px]" style={{ color: C.green }}>{formatCurrency(sessionValueTotal)}</span>}
                </div>
              </Panel>

              {/* ── LEFT: PLUGIN PANEL ── */}
              <PluginPanel
                sessionTitle={sessionDisplayName || "Session"}
                connected={connected}
                sendLevel={remoteMicLevel}
              />

              {/* ── ARTIST VIDEO ── */}
              <Panel accent={C.acMagenta} className="relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
                {artistStream ? (
                  <VideoFeed stream={artistStream} mirrored={artistMirrored} muted={isArtist} volume={1} />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: C.inset }}>
                    <span className="text-[28px] font-black tracking-tight" style={{ color: C.dim }}>W<span style={{ color: C.blue }}>.</span>STUDIO</span>
                    <span style={{ color: C.dim, fontSize: 11, letterSpacing: "0.14em", marginTop: 4 }}>WAITING FOR ARTIST</span>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 z-[5] rounded px-2 py-1 text-[12px] font-medium" style={{ background: "rgba(0,0,0,0.6)", color: artistStream ? C.text : C.dim }}>{artistStream ? "Artist" : "No one connected"}</div>
                <VideoTileActions hasSession={!!role} onJoin={goToJoin} onEnd={handleEndSession} expanded={expandedPanel === "artist"} onToggleExpand={() => setExpandedPanel(expandedPanel === "artist" ? null : "artist")} />
              </Panel>

              {/* ── CENTER: ENGINEER VIDEO or SCREEN SHARE ── */}
              {collaborationShareActive ? (
                <Panel accent={C.acCyan} className="relative flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: `1px solid ${C.panelBorder}` }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.label, letterSpacing: "0.12em", textTransform: "uppercase" }}>SCREEN SHARE — DAW VIEW</span>
                    <div className="flex items-center gap-2">
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />
                      <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>LIVE</span>
                    </div>
                  </div>
                  <div className="relative flex-1" style={{ background: C.inset, minHeight: 180 }}>
                    {screenShareViewStream ? <VideoFeed stream={screenShareViewStream} /> : (
                      <div className="flex h-full items-center justify-center">
                        <span style={{ color: C.label, fontSize: 13 }}>{isEngineer ? "Your screen is being shared" : "Engineer's DAW"}</span>
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 z-10">
                      <button onClick={() => setExpandedPanel(expandedPanel === "screen" ? null : "screen")} className="rounded px-2 py-1 text-[10px] font-bold" style={{ background: "rgba(0,0,0,0.7)", color: C.text, border: "1px solid rgba(255,255,255,0.15)" }}>⛶ Expand</button>
                    </div>
                  </div>
                </Panel>
              ) : (
                <Panel accent={C.acGreen} className="relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
                  {engineerStream ? (
                    <VideoFeed stream={engineerStream} mirrored={engineerMirrored} muted={isEngineer} />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: C.inset }}>
                      <span className="text-[28px] font-black tracking-tight" style={{ color: C.dim }}>W<span style={{ color: C.blue }}>.</span>STUDIO</span>
                      <span style={{ color: C.dim, fontSize: 11, letterSpacing: "0.14em", marginTop: 4 }}>WAITING FOR ENGINEER</span>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 z-[5] rounded px-2 py-1 text-[12px] font-medium" style={{ background: "rgba(0,0,0,0.6)", color: engineerStream ? C.text : C.dim }}>{engineerStream ? "Engineer" : "No one connected"}</div>
                  <VideoTileActions hasSession={!!role} onJoin={goToJoin} onEnd={handleEndSession} expanded={expandedPanel === "engineer"} onToggleExpand={() => setExpandedPanel(expandedPanel === "engineer" ? null : "engineer")} />
                </Panel>
              )}

              {/* ── RIGHT: PLUGIN STATUS PANEL ── */}
              <Panel accent={C.acCyan} className="p-4 flex flex-col gap-4">
                {/* Plugin Status */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
                      <path d="M4 8L10 24L16 12L22 24L28 8" stroke="hsl(270,60%,65%)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="14" y1="4" x2="20" y2="28" stroke="hsl(210,90%,60%)" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: "0.05em" }}>PLUGIN STATUS</span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 11, color: C.label }}>Plugin</span>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full" style={{ width: 8, height: 8, background: pluginConnected ? C.green : C.dim, boxShadow: pluginConnected ? `0 0 6px rgba(74,222,96,0.5)` : "none" }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: pluginConnected ? C.green : C.dim }}>{pluginConnected ? "Connected" : "Not Connected"}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 11, color: C.label }}>DAW</span>
                      <span style={{ fontSize: 11, color: C.text }}>—</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 11, color: C.label }}>Feed</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: pluginConnected ? C.green : C.dim }}>{pluginConnected ? "Active" : "Inactive"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 11, color: C.label }}>Talkback</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: talkbackHeld ? C.blue : C.dim }}>{talkbackHeld ? "Active" : "Inactive"}</span>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: `1px solid ${C.panelBorder}`, paddingTop: 16 }}>
                  <div className="mb-2" style={{ fontSize: 11, fontWeight: 600, color: C.label, letterSpacing: "0.1em" }}>SESSION</div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between" style={{ fontSize: 11 }}>
                      <span style={{ color: C.dim }}>Code</span>
                      <span className="font-mono" style={{ color: C.label }}>{sessionId || "—"}</span>
                    </div>
                    <div className="flex justify-between" style={{ fontSize: 11 }}>
                      <span style={{ color: C.dim }}>Role</span>
                      <span style={{ color: C.text, textTransform: "capitalize" }}>{role || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="mt-auto space-y-2">
                  {hasBooking && isEngineer && (
                    <button onClick={handleEngineerMarkComplete} className="w-full rounded-lg py-2 text-center text-[11px] font-bold" style={{ background: "linear-gradient(180deg, #4ade60 0%, #22a838 100%)", color: "#fff", border: "1px solid rgba(74,222,96,0.5)" }}>✅ Mark Complete</button>
                  )}
                  {hasBooking && isArtist && (
                    <button onClick={handleArtistConfirmComplete} className="w-full rounded-lg py-2 text-center text-[11px] font-bold" style={{ background: "linear-gradient(180deg, #4ade60 0%, #22a838 100%)", color: "#fff", border: "1px solid rgba(74,222,96,0.5)" }}>✅ Confirm Complete</button>
                  )}
                  <button onClick={handleEndSession} className="w-full rounded-lg py-2 text-center text-[11px] font-bold uppercase" style={{ background: "linear-gradient(180deg, rgba(239,68,68,0.15) 0%, rgba(153,27,27,0.2) 100%)", color: C.red, border: "1px solid rgba(239,68,68,0.3)" }}>🔲 End Session</button>
                </div>
              </Panel>

              {/* ── BOTTOM CONTROLS (full width) ── */}
              <Panel accent={C.acOrange} className="col-span-4 flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-3">
                  {/* Mute */}
                  <button type="button" onPointerDown={(e) => { e.preventDefault(); toggleMute(); }} className="flex items-center gap-2 rounded-[3px] px-4 py-2 text-[13px] font-semibold" style={{
                    background: muted ? "rgba(239,68,68,0.15)" : `linear-gradient(180deg, ${C.panelLight} 0%, ${C.panelDark} 100%)`,
                    border: `1px solid ${muted ? "rgba(239,68,68,0.4)" : C.panelBorder}`, color: muted ? C.red : C.text,
                  }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" />
                    </svg>
                    {muted ? "Unmute" : "Mute"}
                  </button>

                  {/* Talk */}
                  <button
                    type="button"
                    onPointerDown={(e) => { e.preventDefault(); beginTalkback(); }}
                    onPointerUp={endTalkback}
                    onPointerLeave={endTalkback}
                    onTouchStart={(e) => { e.preventDefault(); beginTalkback(); }}
                    onTouchEnd={(e) => { e.preventDefault(); endTalkback(); }}
                    className="flex items-center gap-2 rounded-[3px] px-4 py-2 text-[13px] font-semibold"
                    style={{
                      background: talkbackHeld ? "rgba(59,157,255,0.2)" : `linear-gradient(180deg, ${C.panelLight} 0%, ${C.panelDark} 100%)`,
                      border: `1px solid ${talkbackHeld ? "rgba(59,157,255,0.5)" : C.panelBorder}`,
                      color: talkbackHeld ? C.blue : C.text,
                      touchAction: "none",
                    }}
                  >
                    🎙 {talkbackHeld ? "TALKING" : peerPtt ? "INCOMING" : "Talk"}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {/* Extension request for artist */}
                  {isArtist && hasBooking && phase === "live" && !booking?.pendingExtension && (
                    <div className="flex gap-1.5">
                      {([15, 30, 60] as const).map((mins) => (
                        <button key={mins} onClick={() => requestExtension(mins)} className="rounded px-3 py-1.5 text-[11px] font-bold" style={{ background: "linear-gradient(180deg, #f59e0b 0%, #b45309 100%)", color: "#fff", border: "1px solid rgba(245,158,11,0.5)" }}>+{mins}m</button>
                      ))}
                    </div>
                  )}
                  {isArtist && booking?.pendingExtension && (
                    <span style={{ color: C.yellow, fontSize: 11 }}>⏳ Extension pending...</span>
                  )}

                  {/* End Session */}
                  <button type="button" onPointerDown={(e) => { e.preventDefault(); handleEndSession(); }} className="flex items-center gap-2 rounded-[3px] px-4 py-2 text-[13px] font-semibold" style={{
                    background: "linear-gradient(180deg, rgba(239,68,68,0.15) 0%, rgba(153,27,27,0.2) 100%)",
                    border: "1px solid rgba(239,68,68,0.4)", color: C.red,
                  }}>■ End Session</button>
                </div>
              </Panel>
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

      {/* Expanded video overlays */}
      {expandedPanel === "artist" && (
        <ExpandedVideoOverlay stream={artistStream} mirrored={artistMirrored} label="Artist View" audioMuted={isArtist} volume={1} onClose={() => setExpandedPanel(null)} />
      )}
      {expandedPanel === "engineer" && (
        <ExpandedVideoOverlay stream={engineerStream} mirrored={engineerMirrored} label="Engineer View" screenShareStream={collaborationShareActive ? screenShareViewStream : null} audioMuted={isEngineer} volume={1} onClose={() => setExpandedPanel(null)} />
      )}
      {expandedPanel === "screen" && (
        <ExpandedVideoOverlay stream={screenShareViewStream} label="Screen Share — DAW View" audioMuted={isEngineer} volume={1} onClose={() => setExpandedPanel(null)} />
      )}
    </div>
  );
}
