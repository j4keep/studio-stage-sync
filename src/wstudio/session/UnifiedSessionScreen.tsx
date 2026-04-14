import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
import { useBridgeOutputDevice } from "../bridge/useBridgeOutputDevice";

/* ─── STYLE PALETTE ─── */
const S = {
  bg: "#0a0b0e",
  surface: "#111318",
  card: "#161920",
  cardBorder: "#1e2230",
  cardHover: "#1a1e2a",
  accent: "#3b82f6",
  accentDim: "#2563eb",
  green: "#22c55e",
  greenDim: "#16a34a",
  red: "#ef4444",
  yellow: "#eab308",
  purple: "#a855f7",
  cyan: "#06b6d4",
  text: "#e4e4e7",
  textDim: "#a1a1aa",
  textMuted: "#52525b",
  glow: (color: string, intensity = 0.15) => `0 0 20px ${color}${Math.round(intensity * 255).toString(16).padStart(2, "0")}`,
};

/* ─── Video Feed ─── */
function VideoFeed({
  stream, mirrored, muted: audioMuted = true, volume = 1,
}: {
  stream: MediaStream | null; mirrored?: boolean; muted?: boolean; volume?: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream ?? null;
    el.volume = Math.min(1, Math.max(0, volume));
    if (stream) {
      el.play().catch(() => {
        const retry = () => { el.play().catch(() => {}); document.removeEventListener("click", retry); };
        document.addEventListener("click", retry, { once: true });
      });
    }
  }, [stream, volume]);
  if (!stream) return null;
  return (
    <video ref={ref} autoPlay playsInline muted={audioMuted}
      className="absolute inset-0 h-full w-full object-cover"
      style={mirrored ? { transform: "scaleX(-1)" } : undefined}
    />
  );
}

/* ─── Horizontal Meter ─── */
function HMeter({ level, color = S.green }: { level: number; color?: string }) {
  return (
    <div className="h-[5px] w-full overflow-hidden rounded-full" style={{ background: "#1a1d25" }}>
      <div className="h-full rounded-full transition-[width] duration-75"
        style={{
          width: `${Math.min(100, level * 100)}%`,
          background: `linear-gradient(90deg, ${color} 0%, ${level > 0.7 ? S.yellow : color} 70%, ${level > 0.9 ? S.red : color} 100%)`,
          boxShadow: level > 0.3 ? S.glow(color, 0.2) : "none",
        }}
      />
    </div>
  );
}

/* ─── Expanded Video Overlay ─── */
function ExpandedVideoOverlay({
  stream, mirrored, label, screenShareStream, audioMuted = true, volume = 1, onClose,
}: {
  stream: MediaStream | null; mirrored?: boolean; label: string;
  screenShareStream?: MediaStream | null; audioMuted?: boolean; volume?: number; onClose: () => void;
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
        <span style={{ color: S.text, fontSize: 14, fontWeight: 600 }}>{label}</span>
        <button onClick={onClose} className="rounded px-3 py-1 text-[11px] font-bold uppercase"
          style={{ background: "rgba(255,255,255,0.1)", color: S.text, border: "1px solid rgba(255,255,255,0.2)" }}>
          ✕ Close
        </button>
      </div>
      <div className="relative flex-1">
        {activeStream ? (
          <video ref={vidRef} autoPlay playsInline muted={audioMuted}
            className="absolute inset-0 h-full w-full object-contain"
            style={isMirrored ? { transform: "scaleX(-1)" } : undefined}
          />
        ) : (
          <div className="flex h-full items-center justify-center" style={{ color: S.textMuted }}>No stream</div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   UNIFIED SESSION SCREEN — Redesigned
   ═══════════════════════════════════════════════════════════ */
export default function UnifiedSessionScreen() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    role, connection, sessionDisplayName, muted, toggleMute, talkbackHeld, beginTalkback, endTalkback,
    live, setSessionRecording, setSessionPlaying, setSessionRecordArmed, updateSessionMonitorLevels, updateSessionHeadphoneLevel,
    demoClock, leaveSession, screenSharing, toggleScreenShare, collaborationShareActive, sessionId, demoMode,
  } = useSession();
  const {
    localStream, remoteStream, remoteStreamForPlayback, localScreenPreview,
    localMicLevel, localTalkbackTxLevel, remoteMicLevel, hasRemoteAudio,
    engineerDawVocalIn1, engineerBridgeVocalLevel, engineerDawReturnLevel, dawReturnActive,
  } = useStudioMedia();
  const { routingError: bridgeRoutingError, routed: bridgeRouted } = useBridgeOutputDevice(role === "engineer" ? engineerDawVocalIn1 ?? null : null);
  const {
    booking, totalBookedMinutes, remainingSeconds: bookingRemaining, warningLevel, timerRunning, phase, pendingExtension,
    sessionValueTotal, startSessionTimer, requestExtension, approveExtension, declineExtension, engineerContinueSession,
    extensionModalOpen, setExtensionModalOpen, controlsLocked, sessionRates,
  } = useBookingTimer();
  const { user } = useAuth();

  const isEngineer = role === "engineer";
  const isArtist = role === "artist";
  const recording = live.recording;
  const playing = live.playing;
  const armed = live.recordArmed;
  const connected = connection === "connected";
  const hasBooking = !!booking && booking.bookedMinutes > 0;
  const peerPtt = isEngineer ? live.artistPtt : live.engineerPtt;

  const artistStream = isArtist ? localStream : remoteStreamForPlayback;
  const engineerStream = isEngineer ? localStream : remoteStreamForPlayback;
  const artistMirrored = isArtist;
  const engineerMirrored = isEngineer;
  const screenShareViewStream = isEngineer ? localScreenPreview : (collaborationShareActive ? remoteStreamForPlayback : null);

  const meterDisplay = (x: number) => (x < 0.04 ? 0 : x);

  const bridgePathReady = isEngineer && !!engineerDawVocalIn1 && hasRemoteAudio;
  const bridgeStatusLabel = !isEngineer ? "" : bridgePathReady ? "Connected" : sessionId.trim() ? "Connecting" : "Offline";
  const bridgeFeedActive = isEngineer && bridgePathReady;

  const [expandedPanel, setExpandedPanel] = useState<"artist" | "engineer" | "screen" | null>(null);

  // Timer
  const remainingSec = hasBooking ? bookingRemaining : demoClock.remainingSeconds;
  const currentPhase = hasBooking ? phase : demoClock.phase;
  const currentWarning = hasBooking ? warningLevel : "ok";
  const timerStr = `${String(Math.floor(remainingSec / 60)).padStart(2, "0")}:${String(remainingSec % 60).padStart(2, "0")}`;

  const handleTransportRecord = useCallback(() => {
    if (!isEngineer) return;
    if (recording) { setSessionRecording(false); return; }
    if (!armed) return;
    setSessionRecording(true);
    if (!playing) setSessionPlaying(true);
  }, [isEngineer, recording, armed, playing, setSessionRecording, setSessionPlaying]);

  const handleEndSession = useCallback(() => {
    leaveSession();
    navigate("/wstudio/session/join");
  }, [leaveSession, navigate]);

  const handleEngineerMarkComplete = useCallback(async () => {
    if (!sessionId.trim() || !user) return;
    try {
      const { data: bookingData } = await (supabase as any).from("studio_bookings").select("id, user_id, studio_id, session_code").eq("session_code", sessionId.trim().toUpperCase()).single();
      if (bookingData) {
        await (supabase as any).from("studio_bookings").update({ engineer_completed_at: new Date().toISOString(), session_status: "awaiting_confirmation" }).eq("id", bookingData.id);
        await (supabase as any).from("notifications").insert({ user_id: bookingData.user_id, type: "booking", title: "✅ Session Complete — Please Verify", body: `Your engineer has marked the session (code: ${bookingData.session_code}) as complete. Please confirm or dispute within 48 hours.`, reference_id: bookingData.id, reference_type: "booking" });
        toast.success("Session marked complete. Awaiting artist confirmation.");
      }
    } catch { toast.error("Failed to mark session complete"); }
    leaveSession(); navigate("/wstudio/session/join");
  }, [sessionId, user, leaveSession, navigate]);

  const handleArtistConfirmComplete = useCallback(async () => {
    if (!sessionId.trim() || !user) return;
    try {
      const { data: bookingData } = await (supabase as any).from("studio_bookings").select("id, studio_id").eq("session_code", sessionId.trim().toUpperCase()).single();
      if (bookingData) {
        await (supabase as any).from("studio_bookings").update({ artist_confirmed: true, artist_responded_at: new Date().toISOString(), session_status: "completed", payout_status: "released" }).eq("id", bookingData.id);
        toast.success("Session confirmed! Payment released.");
      }
    } catch { toast.error("Failed to confirm session"); }
    leaveSession(); navigate("/bookings");
  }, [sessionId, user, leaveSession, navigate]);

  const onStartClock = () => {
    if (hasBooking) startSessionTimer();
    else {
      // reset demo
      toast.message("Demo timer reset");
    }
  };

  // Mobile tab
  const [mobileTab, setMobileTab] = useState<"session" | "controls" | "monitor">("session");

  const canScreenShare = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

  return (
    <div className="flex min-h-screen w-full flex-col select-none overflow-hidden" style={{ background: S.bg, color: S.text }}>
      <ExtensionApprovalDialog open={extensionModalOpen} onOpenChange={setExtensionModalOpen} pending={pendingExtension} rates={sessionRates} onApprove={approveExtension} onDecline={declineExtension} />

      {/* ═══ TOP BAR ═══ */}
      <header className="flex shrink-0 items-center justify-between px-4" style={{ height: isMobile ? 48 : 56, borderBottom: `1px solid ${S.cardBorder}`, background: S.surface }}>
        <div className="flex items-center gap-2.5">
          <svg width={isMobile ? 20 : 26} height={isMobile ? 16 : 20} viewBox="0 0 24 18" fill="none">
            <path d="M0 1L4 17H5L9 5L13 17H14L18 1H16L13 12L9.5 1H8.5L5 12L2 1H0Z" fill="#fff" />
            <line x1="17.5" y1="-1" x2="11.5" y2="19" stroke={S.accent} strokeWidth="4" strokeLinecap="round" />
          </svg>
          <span className="font-black tracking-tight" style={{ fontSize: isMobile ? 15 : 18 }}>
            <span style={{ color: S.accent }}>.</span>STUDIO
          </span>
          {demoMode && <span className="rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide" style={{ background: "rgba(168,85,247,0.15)", color: S.purple, border: `1px solid rgba(168,85,247,0.3)` }}>Demo</span>}
        </div>

        <div className="flex items-center gap-3 text-center">
          <span className="hidden truncate text-xs font-medium sm:block" style={{ color: S.textDim, maxWidth: 220 }}>
            {sessionDisplayName || "W.Studio Session"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Timer */}
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: S.card, border: `1px solid ${S.cardBorder}` }}>
            <span className={`font-mono text-sm font-bold tabular-nums ${currentWarning === "critical" ? "animate-pulse" : ""}`}
              style={{ color: currentWarning === "critical" ? S.red : currentWarning === "warning" ? S.yellow : S.text }}>
              {timerStr}
            </span>
          </div>
          {/* LIVE indicator */}
          <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{
            background: currentPhase === "live" ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${currentPhase === "live" ? "rgba(34,197,94,0.3)" : S.cardBorder}`,
          }}>
            <div className={`h-2 w-2 rounded-full ${currentPhase === "live" ? "animate-pulse" : ""}`}
              style={{ background: currentPhase === "live" ? S.green : currentPhase === "ended" ? S.red : S.textMuted }} />
            <span className="text-[10px] font-bold uppercase tracking-wide"
              style={{ color: currentPhase === "live" ? S.green : S.textMuted }}>
              {currentPhase === "live" ? "LIVE" : currentPhase === "ended" ? "ENDED" : "STANDBY"}
            </span>
          </div>
          {/* Close */}
          <button onClick={handleEndSession} className="flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors hover:bg-white/10" style={{ color: S.textDim }}>✕</button>
        </div>
      </header>

      {/* ═══ MOBILE TABS ═══ */}
      {isMobile && (
        <div className="flex" style={{ borderBottom: `1px solid ${S.cardBorder}`, background: S.surface }}>
          {(["session", "controls", "monitor"] as const).map((tab) => (
            <button key={tab} onClick={() => setMobileTab(tab)} className="flex-1 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider"
              style={{ color: mobileTab === tab ? S.accent : S.textMuted, borderBottom: mobileTab === tab ? `2px solid ${S.accent}` : "2px solid transparent" }}>
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* ═══ MAIN CONTENT ═══ */}
      <div className={`flex-1 overflow-y-auto ${isMobile ? "p-3" : "p-4"}`}>
        {controlsLocked && <SessionControlsLockOverlay />}

        {/* ── Mobile: Session Tab ── */}
        {isMobile && mobileTab === "session" && (
          <div className="flex flex-col gap-3">
            {/* Session name on mobile */}
            <div className="text-center">
              <p className="truncate text-sm font-medium" style={{ color: S.textDim }}>{sessionDisplayName || "W.Studio Session"}</p>
            </div>

            {/* Artist Video */}
            <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: "16/9", background: S.card, border: `1px solid ${S.cardBorder}`, boxShadow: S.glow(S.accent, 0.08) }}>
              {artistStream ? (
                <VideoFeed stream={artistStream} mirrored={artistMirrored} muted={isArtist} volume={isEngineer ? 1 : 1} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "rgba(59,130,246,0.1)", border: `1px solid rgba(59,130,246,0.2)` }}>
                    <span className="text-lg">🎤</span>
                  </div>
                  <span className="text-xs font-medium" style={{ color: S.textMuted }}>Waiting for artist…</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", color: S.text }}>
                {artistStream ? "Artist" : "No artist"}
              </div>
              <button onClick={() => setExpandedPanel(expandedPanel === "artist" ? null : "artist")}
                className="absolute bottom-2 right-2 rounded-md px-1.5 py-0.5 text-[9px] font-bold"
                style={{ background: "rgba(0,0,0,0.7)", color: S.text, border: "1px solid rgba(255,255,255,0.1)" }}>⛶</button>
            </div>

            {/* Engineer Video */}
            <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: "16/9", background: S.card, border: `1px solid ${S.cardBorder}` }}>
              {engineerStream ? (
                <VideoFeed stream={engineerStream} mirrored={engineerMirrored} muted={isEngineer} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.1)", border: `1px solid rgba(34,197,94,0.2)` }}>
                    <span className="text-lg">🎧</span>
                  </div>
                  <span className="text-xs font-medium" style={{ color: S.textMuted }}>Waiting for engineer…</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", color: S.text }}>
                {engineerStream ? "Engineer" : "No engineer"}
              </div>
            </div>

            {/* Connection + Pricing */}
            <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: S.card, border: `1px solid ${S.cardBorder}` }}>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: connected ? S.green : S.textMuted, boxShadow: connected ? S.glow(S.green, 0.4) : "none" }} />
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: connected ? S.green : S.textMuted }}>{connected ? "Connected" : "Disconnected"}</span>
              </div>
              {isEngineer && <span className="font-mono text-sm font-bold" style={{ color: S.green }}>{formatCurrency(sessionValueTotal)}</span>}
            </div>

            {/* Quick controls */}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={toggleMute} className="flex flex-col items-center gap-1.5 rounded-xl py-3 transition-colors"
                style={{ background: muted ? "rgba(239,68,68,0.12)" : S.card, border: `1px solid ${muted ? "rgba(239,68,68,0.3)" : S.cardBorder}` }}>
                <span className="text-lg">{muted ? "🔇" : "🎤"}</span>
                <span className="text-[10px] font-semibold" style={{ color: muted ? S.red : S.textDim }}>Mute</span>
              </button>
              <button
                onPointerDown={(e) => { e.preventDefault(); beginTalkback(); }}
                onPointerUp={endTalkback}
                onPointerLeave={endTalkback}
                onTouchStart={(e) => { e.preventDefault(); beginTalkback(); }}
                onTouchEnd={(e) => { e.preventDefault(); endTalkback(); }}
                className="flex flex-col items-center gap-1.5 rounded-xl py-3 transition-all"
                style={{
                  background: talkbackHeld ? "rgba(59,130,246,0.2)" : peerPtt ? "rgba(6,182,212,0.12)" : S.card,
                  border: `1px solid ${talkbackHeld ? "rgba(59,130,246,0.5)" : peerPtt ? "rgba(6,182,212,0.3)" : S.cardBorder}`,
                  boxShadow: talkbackHeld ? S.glow(S.accent, 0.3) : "none",
                  touchAction: "none",
                }}>
                <span className="text-lg">🎙</span>
                <span className="text-[10px] font-semibold" style={{ color: talkbackHeld ? S.accent : peerPtt ? S.cyan : S.textDim }}>
                  {talkbackHeld ? "TALKING" : peerPtt ? "INCOMING" : "Talk"}
                </span>
              </button>
              <button className="flex flex-col items-center gap-1.5 rounded-xl py-3" style={{ background: S.card, border: `1px solid ${S.cardBorder}` }}>
                <span className="text-lg">⚙</span>
                <span className="text-[10px] font-semibold" style={{ color: S.textDim }}>Settings</span>
              </button>
            </div>

            {/* Screen share on mobile */}
            {collaborationShareActive && (
              <div className="overflow-hidden rounded-xl" style={{ border: `1px solid rgba(6,182,212,0.3)`, background: S.card }}>
                <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${S.cardBorder}` }}>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.cyan }}>Screen Share</span>
                  <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: S.green }} /><span className="text-[9px] font-bold" style={{ color: S.green }}>LIVE</span></div>
                </div>
                <div className="relative" style={{ aspectRatio: "16/9", background: S.bg }}>
                  {screenShareViewStream ? <VideoFeed stream={screenShareViewStream} /> : (
                    <div className="flex h-full items-center justify-center"><span className="text-xs" style={{ color: S.textMuted }}>Starting screen capture…</span></div>
                  )}
                </div>
              </div>
            )}

            {/* Extension requests */}
            {isArtist && hasBooking && currentPhase === "live" && (
              <div className="rounded-xl p-3" style={{ background: S.card, border: `1px solid rgba(245,158,11,0.2)` }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.yellow }}>Request More Time</span>
                <div className="mt-2 flex gap-2">
                  {([15, 30, 60] as const).map((m) => (
                    <button key={m} onClick={() => requestExtension(m)} disabled={!!pendingExtension}
                      className="flex-1 rounded-lg py-2 text-xs font-bold transition-colors disabled:opacity-40"
                      style={{ background: "rgba(245,158,11,0.15)", color: S.yellow, border: "1px solid rgba(245,158,11,0.3)" }}>
                      +{m}m
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Session complete actions */}
            {hasBooking && (
              <div className="flex gap-2">
                {isEngineer && (
                  <button onClick={handleEngineerMarkComplete} className="flex-1 rounded-xl py-3 text-xs font-bold"
                    style={{ background: "rgba(34,197,94,0.15)", color: S.green, border: "1px solid rgba(34,197,94,0.3)" }}>
                    ✅ Mark Complete
                  </button>
                )}
                {isArtist && (
                  <button onClick={handleArtistConfirmComplete} className="flex-1 rounded-xl py-3 text-xs font-bold"
                    style={{ background: "rgba(34,197,94,0.15)", color: S.green, border: "1px solid rgba(34,197,94,0.3)" }}>
                    ✅ Confirm Complete
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Mobile: Controls Tab ── */}
        {isMobile && mobileTab === "controls" && (
          <div className="flex flex-col gap-3">
            {/* Transport Controls */}
            <div className="rounded-xl p-4" style={{ background: S.card, border: `1px solid ${S.cardBorder}` }}>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.textMuted }}>Transport</span>
              <div className="mt-1 text-center text-xs font-semibold" style={{ color: S.textDim }}>SYNCED · 120 BPM</div>
              <div className="mt-3 flex items-center justify-center gap-3">
                <TransportBtn icon="▶" label="Play" active={playing}
                  onClick={isEngineer ? () => setSessionPlaying(true) : undefined} color={S.green} disabled={!isEngineer} />
                <TransportBtn icon="■" label="Stop" active={false}
                  onClick={isEngineer ? () => { setSessionPlaying(false); if (recording) setSessionRecording(false); } : undefined} color={S.red} disabled={!isEngineer} />
                <TransportBtn icon="●" label="Rec" active={recording}
                  onClick={isEngineer ? handleTransportRecord : undefined} color={S.red} disabled={!isEngineer || (!armed && !recording)} pulse={recording} />
              </div>
              {isEngineer && (
                <div className="mt-3 flex justify-center">
                  <button onClick={() => { if (!recording) setSessionRecordArmed(!armed); }}
                    className="rounded-lg px-5 py-2 text-[11px] font-bold uppercase tracking-wide transition-all"
                    style={{
                      background: armed ? "rgba(239,68,68,0.15)" : S.bg,
                      color: armed ? S.red : S.textMuted,
                      border: `1px solid ${armed ? "rgba(239,68,68,0.4)" : S.cardBorder}`,
                      boxShadow: armed ? S.glow(S.red, 0.15) : "none",
                    }}>
                    {armed ? "● Armed" : "Arm Record"}
                  </button>
                </div>
              )}
            </div>

            {/* Audio Meters */}
            <div className="rounded-xl p-4" style={{ background: S.card, border: `1px solid ${S.cardBorder}` }}>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.textMuted }}>Audio Levels</span>
              <div className="mt-3 space-y-3">
                <MeterRow label="Local Mic" level={meterDisplay(localMicLevel)} />
                <MeterRow label="Talkback Send" level={meterDisplay(localTalkbackTxLevel)} />
                <MeterRow label="Remote In" level={hasRemoteAudio ? meterDisplay(remoteMicLevel) : 0} status={hasRemoteAudio ? "live" : undefined} />
                {isEngineer && <MeterRow label="Bridge Out" level={bridgePathReady ? meterDisplay(engineerBridgeVocalLevel) : 0} status={bridgePathReady ? "routed" : undefined} />}
                {isEngineer && <MeterRow label="DAW Return" level={dawReturnActive ? meterDisplay(engineerDawReturnLevel) : 0} status={dawReturnActive ? "sending" : undefined} color={S.cyan} />}
              </div>
            </div>

            {/* Screen Share Control */}
            {isEngineer && (
              <button onClick={() => {
                if (!canScreenShare) { toast.error("Screen sharing not supported on this device."); return; }
                toggleScreenShare();
              }} className="flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold uppercase tracking-wide transition-all"
                style={{
                  background: screenSharing ? "rgba(59,130,246,0.15)" : S.card,
                  color: screenSharing ? S.accent : S.textDim,
                  border: `1px solid ${screenSharing ? "rgba(59,130,246,0.4)" : S.cardBorder}`,
                }}>
                🖥 {screenSharing ? "Stop Sharing" : "Share Screen"}
              </button>
            )}
          </div>
        )}

        {/* ── Mobile: Monitor Tab ── */}
        {isMobile && mobileTab === "monitor" && (
          <div className="flex flex-col gap-3">
            {/* Monitoring knobs simplified as sliders */}
            <div className="rounded-xl p-4" style={{ background: S.card, border: `1px solid ${S.cardBorder}` }}>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.textMuted }}>
                Monitor Mix {isArtist && <span className="normal-case font-normal text-[9px]">(engineer controls)</span>}
              </span>
              <div className="mt-3 space-y-4">
                <MonitorSlider label="Vocal" value={live.vocalLevel} color={S.green}
                  onChange={isEngineer ? (v) => updateSessionMonitorLevels({ vocalLevel: v }) : undefined} />
                <MonitorSlider label="Talkback" value={live.talkbackLevel} color={S.cyan}
                  onChange={isEngineer ? (v) => updateSessionMonitorLevels({ talkbackLevel: v }) : undefined} />
                <MonitorSlider label="Headphone" value={isEngineer ? live.headphoneLevelEngineer : live.headphoneLevelArtist} color={S.yellow}
                  onChange={(v) => updateSessionHeadphoneLevel(v)} />
                <MonitorSlider label="Cue Mix" value={live.cueMix} color={S.purple}
                  onChange={isEngineer ? (v) => updateSessionMonitorLevels({ cueMix: v }) : undefined}
                  leftLabel="Vox" rightLabel="Beat" />
              </div>
            </div>

            {/* Plugin Status */}
            {isEngineer && (
              <div className="rounded-xl p-4" style={{ background: S.card, border: `1px solid ${S.cardBorder}` }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.textMuted }}>Plugin Status</span>
                <div className="mt-2 space-y-1.5">
                  <StatusRow label="Status" value={bridgeStatusLabel} color={bridgePathReady ? S.green : S.yellow} />
                  <StatusRow label="Artist" value={live.remoteArtistLabel.trim() || (hasRemoteAudio ? "Connected" : "—")} />
                  <StatusRow label="Feed" value={bridgeFeedActive ? "Active" : "Inactive"} color={bridgeFeedActive ? S.green : S.textMuted} />
                  <div className="pt-1.5 text-[9px]" style={{ color: S.textMuted }}>Send Plugin · 48kHz · Low Latency</div>
                  {bridgeRoutingError && <div className="text-[9px]" style={{ color: S.red }}>{bridgeRoutingError}</div>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ DESKTOP LAYOUT ═══ */}
        {!isMobile && (
          <div className="flex flex-col gap-3">
            {/* ── VIDEO AREA ── */}
            <div className="grid gap-3" style={{ gridTemplateColumns: collaborationShareActive ? "1fr 1fr 1fr" : "3fr 2fr" }}>
              {/* Artist Video */}
              <div className="relative overflow-hidden rounded-xl" style={{
                aspectRatio: "16/9", background: S.card, border: `1px solid ${S.cardBorder}`,
                boxShadow: `${S.glow(S.accent, 0.06)}, inset 0 1px 0 rgba(255,255,255,0.03)`,
              }}>
                {artistStream ? (
                  <VideoFeed stream={artistStream} mirrored={artistMirrored} muted={isArtist} volume={1} />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ background: "rgba(59,130,246,0.08)", border: `1px solid rgba(59,130,246,0.15)` }}>
                      <span className="text-2xl">🎤</span>
                    </div>
                    <span className="text-sm font-medium" style={{ color: S.textMuted }}>Waiting for artist…</span>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 rounded-lg px-2.5 py-1 text-[11px] font-semibold" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)", color: S.text }}>
                  {artistStream ? "Artist" : "No artist connected"}
                </div>
                <button onClick={() => setExpandedPanel(expandedPanel === "artist" ? null : "artist")}
                  className="absolute bottom-3 right-3 rounded-lg px-2 py-1 text-[9px] font-bold"
                  style={{ background: "rgba(0,0,0,0.7)", color: S.text, border: "1px solid rgba(255,255,255,0.1)" }}>⛶</button>
                {/* Timer overlay on artist tile */}
                <div className="absolute top-3 right-3 flex items-center gap-2 rounded-lg px-2.5 py-1" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}>
                  <span className={`font-mono text-xs font-bold tabular-nums ${currentWarning === "critical" ? "animate-pulse" : ""}`}
                    style={{ color: currentWarning === "critical" ? S.red : currentWarning === "warning" ? S.yellow : S.text }}>{timerStr}</span>
                  <div className={`h-2 w-2 rounded-full ${currentPhase === "live" ? "animate-pulse" : ""}`}
                    style={{ background: currentPhase === "live" ? S.green : currentPhase === "ended" ? S.red : S.textMuted }} />
                </div>
              </div>

              {/* Engineer Video */}
              <div className="relative overflow-hidden rounded-xl" style={{
                aspectRatio: "16/9", background: S.card, border: `1px solid ${S.cardBorder}`,
              }}>
                {engineerStream ? (
                  <VideoFeed stream={engineerStream} mirrored={engineerMirrored} muted={isEngineer} />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.08)", border: `1px solid rgba(34,197,94,0.15)` }}>
                      <span className="text-2xl">🎧</span>
                    </div>
                    <span className="text-sm font-medium" style={{ color: S.textMuted }}>Waiting for engineer…</span>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 rounded-lg px-2.5 py-1 text-[11px] font-semibold" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)", color: S.text }}>
                  {engineerStream ? "Engineer" : "No engineer connected"}
                </div>
                {isEngineer && (
                  <div className="absolute bottom-3 right-3 rounded-lg px-2.5 py-1" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}>
                    <span className="font-mono text-xs font-bold" style={{ color: S.green }}>{formatCurrency(sessionValueTotal)}</span>
                  </div>
                )}
              </div>

              {/* Screen Share (only when active) */}
              {collaborationShareActive && (
                <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: "16/9", background: S.card, border: `1px solid rgba(6,182,212,0.25)` }}>
                  <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 py-1.5 z-10" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.cyan }}>Screen Share</span>
                    <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: S.green }} /><span className="text-[9px] font-bold" style={{ color: S.green }}>LIVE</span></div>
                  </div>
                  {screenShareViewStream ? <VideoFeed stream={screenShareViewStream} /> : (
                    <div className="flex h-full items-center justify-center"><span className="text-xs" style={{ color: S.textMuted }}>Connecting…</span></div>
                  )}
                  <button onClick={() => setExpandedPanel(expandedPanel === "screen" ? null : "screen")}
                    className="absolute bottom-3 right-3 rounded-lg px-2 py-1 text-[9px] font-bold z-10"
                    style={{ background: "rgba(0,0,0,0.7)", color: S.text, border: "1px solid rgba(255,255,255,0.1)" }}>⛶ Expand</button>
                </div>
              )}
            </div>

            {/* ── CONTROL STRIP ── */}
            <div className="flex items-center justify-between rounded-xl px-5 py-3" style={{ background: S.card, border: `1px solid ${S.cardBorder}` }}>
              <div className="flex items-center gap-3">
                {/* Connection */}
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: connected ? S.green : S.textMuted, boxShadow: connected ? S.glow(S.green, 0.5) : "none" }} />
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: connected ? S.green : S.textMuted }}>{connected ? "Connected" : connection}</span>
                </div>
                <div className="h-5 w-px" style={{ background: S.cardBorder }} />
                <span className="text-xs font-medium" style={{ color: S.textDim }}>120 BPM</span>
              </div>

              {/* Transport */}
              <div className="flex items-center gap-2">
                <TransportBtn icon="▶" label="Play" active={playing}
                  onClick={isEngineer ? () => setSessionPlaying(true) : undefined} color={S.green} disabled={!isEngineer} />
                <TransportBtn icon="■" label="Stop" active={false}
                  onClick={isEngineer ? () => { setSessionPlaying(false); if (recording) setSessionRecording(false); } : undefined} color={S.red} disabled={!isEngineer} />
                <TransportBtn icon="●" label="Rec" active={recording}
                  onClick={isEngineer ? handleTransportRecord : undefined} color={S.red} disabled={!isEngineer || (!armed && !recording)} pulse={recording} />
                {isEngineer && (
                  <button onClick={() => { if (!recording) setSessionRecordArmed(!armed); }}
                    className="ml-1 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all"
                    style={{
                      background: armed ? "rgba(239,68,68,0.12)" : "transparent",
                      color: armed ? S.red : S.textMuted,
                      border: `1px solid ${armed ? "rgba(239,68,68,0.35)" : S.cardBorder}`,
                    }}>
                    {armed ? "● Armed" : "Arm"}
                  </button>
                )}
              </div>

              {/* Right side controls */}
              <div className="flex items-center gap-2">
                {/* Talkback */}
                <button
                  onPointerDown={(e) => { e.preventDefault(); beginTalkback(); }}
                  onPointerUp={endTalkback}
                  onPointerLeave={endTalkback}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all select-none"
                  style={{
                    background: talkbackHeld ? "rgba(59,130,246,0.2)" : peerPtt ? "rgba(6,182,212,0.12)" : "transparent",
                    color: talkbackHeld ? S.accent : peerPtt ? S.cyan : S.textDim,
                    border: `1px solid ${talkbackHeld ? "rgba(59,130,246,0.5)" : peerPtt ? "rgba(6,182,212,0.3)" : S.cardBorder}`,
                    boxShadow: talkbackHeld ? S.glow(S.accent, 0.25) : "none",
                    touchAction: "none",
                  }}>
                  🎙 {talkbackHeld ? "Talking" : peerPtt ? "Incoming" : "Talk"}
                </button>
                {/* Mute */}
                <button onClick={toggleMute} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all"
                  style={{
                    background: muted ? "rgba(239,68,68,0.12)" : "transparent",
                    color: muted ? S.red : S.textDim,
                    border: `1px solid ${muted ? "rgba(239,68,68,0.35)" : S.cardBorder}`,
                  }}>
                  {muted ? "🔇" : "🎤"} {muted ? "Muted" : "Mute"}
                </button>
                {/* Screen share */}
                {isEngineer && (
                  <button onClick={() => {
                    if (!canScreenShare) { toast.error("Screen sharing not supported."); return; }
                    toggleScreenShare();
                  }} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all"
                    style={{
                      background: screenSharing ? "rgba(59,130,246,0.12)" : "transparent",
                      color: screenSharing ? S.accent : S.textDim,
                      border: `1px solid ${screenSharing ? "rgba(59,130,246,0.35)" : S.cardBorder}`,
                    }}>
                    🖥 {screenSharing ? "Sharing" : "Share"}
                  </button>
                )}
              </div>
            </div>

            {/* ── BOTTOM PANELS ── */}
            <div className={`grid gap-3 ${isEngineer ? "grid-cols-3" : "grid-cols-2"}`}>
              {/* SESSION PANEL */}
              <div className="rounded-xl p-4" style={{ background: S.card, border: `1px solid ${S.cardBorder}` }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.textMuted }}>Session</span>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium" style={{ color: S.text }}>{sessionDisplayName || "W.Studio Session"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ background: connected ? S.green : S.textMuted }} />
                    <span className="text-xs" style={{ color: connected ? S.green : S.textMuted }}>{connected ? "Connected" : "Disconnected"}</span>
                  </div>
                  {recording && <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full animate-pulse" style={{ background: S.red }} /><span className="text-xs" style={{ color: S.red }}>Recording…</span></div>}

                  {/* Activity Log */}
                  <div className="mt-2 space-y-1 border-t pt-2" style={{ borderColor: S.cardBorder }}>
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: S.textMuted }}>Activity</span>
                    <div className="text-[10px] space-y-0.5" style={{ color: S.textDim }}>
                      <p>• {connected ? "Session connected" : "Waiting for connection"}</p>
                      {live.artistJoined && <p>• Artist joined</p>}
                      {live.engineerJoined && <p>• Engineer joined</p>}
                      {bridgeFeedActive && <p>• Plugin connected</p>}
                    </div>
                  </div>

                  <button onClick={handleEndSession} className="mt-2 w-full rounded-lg py-2 text-[11px] font-bold uppercase tracking-wide"
                    style={{ background: "rgba(239,68,68,0.1)", color: S.red, border: "1px solid rgba(239,68,68,0.25)" }}>
                    Disconnect
                  </button>

                  {/* Extension + Complete */}
                  {isArtist && hasBooking && currentPhase === "live" && (
                    <div className="mt-2 flex gap-1.5">
                      {([15, 30, 60] as const).map((m) => (
                        <button key={m} onClick={() => requestExtension(m)} disabled={!!pendingExtension}
                          className="flex-1 rounded-lg py-1.5 text-[10px] font-bold disabled:opacity-40"
                          style={{ background: "rgba(245,158,11,0.12)", color: S.yellow, border: "1px solid rgba(245,158,11,0.25)" }}>+{m}m</button>
                      ))}
                    </div>
                  )}
                  {hasBooking && isEngineer && (
                    <button onClick={handleEngineerMarkComplete} className="mt-1 w-full rounded-lg py-2 text-[11px] font-bold"
                      style={{ background: "rgba(34,197,94,0.12)", color: S.green, border: "1px solid rgba(34,197,94,0.25)" }}>✅ Mark Complete</button>
                  )}
                  {hasBooking && isArtist && (
                    <button onClick={handleArtistConfirmComplete} className="mt-1 w-full rounded-lg py-2 text-[11px] font-bold"
                      style={{ background: "rgba(34,197,94,0.12)", color: S.green, border: "1px solid rgba(34,197,94,0.25)" }}>✅ Confirm Complete</button>
                  )}
                </div>
              </div>

              {/* PLUGIN STATUS (engineer only) */}
              {isEngineer && (
                <div className="rounded-xl p-4" style={{ background: S.card, border: `1px solid ${S.cardBorder}` }}>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.textMuted }}>Plugin Status</span>
                  <div className="mt-3 space-y-2">
                    <StatusRow label="Plugin" value={bridgePathReady ? "Connected" : "Waiting…"} color={bridgePathReady ? S.green : S.yellow} />
                    <StatusRow label="DAW" value={bridgePathReady ? "Logic Pro" : "—"} />
                    <StatusRow label="Feed" value={bridgeFeedActive ? "Active" : "Inactive"} color={bridgeFeedActive ? S.green : S.textMuted} />
                    <StatusRow label="Artist" value={live.remoteArtistLabel.trim() || (hasRemoteAudio ? "Connected" : "Waiting…")} />
                    {/* Talkback meter */}
                    <div className="mt-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: S.textMuted }}>Talkback</span>
                      <div className="mt-1"><HMeter level={meterDisplay(localTalkbackTxLevel)} color={S.cyan} /></div>
                    </div>
                    <div className="mt-2 pt-2 border-t text-[9px]" style={{ borderColor: S.cardBorder, color: S.textMuted }}>
                      Send Plugin · 48kHz · Low Latency
                    </div>
                    {bridgeRoutingError && <div className="text-[9px]" style={{ color: S.red }}>{bridgeRoutingError}</div>}
                  </div>
                </div>
              )}

              {/* AUDIO PANEL */}
              <div className="rounded-xl p-4" style={{ background: S.card, border: `1px solid ${S.cardBorder}` }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.textMuted }}>Audio</span>
                <div className="mt-3 space-y-2.5">
                  <MeterRow label="Local Mic" level={meterDisplay(localMicLevel)} />
                  <MeterRow label="Remote In" level={hasRemoteAudio ? meterDisplay(remoteMicLevel) : 0} status={hasRemoteAudio ? "live" : undefined} />
                  {isEngineer && <MeterRow label="Bridge Out" level={bridgePathReady ? meterDisplay(engineerBridgeVocalLevel) : 0} color={S.accent} />}
                  {isEngineer && <MeterRow label="DAW Return" level={dawReturnActive ? meterDisplay(engineerDawReturnLevel) : 0} color={S.cyan} status={dawReturnActive ? "sending" : undefined} />}
                  <MeterRow label="Talkback" level={meterDisplay(localTalkbackTxLevel)} color={S.purple} />

                  {/* Monitor levels */}
                  <div className="mt-2 pt-2 border-t" style={{ borderColor: S.cardBorder }}>
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: S.textMuted }}>
                      Monitor {isArtist && "(read-only)"}
                    </span>
                    <div className="mt-2 space-y-2.5">
                      <MonitorSlider label="Vocal" value={live.vocalLevel} color={S.green} onChange={isEngineer ? (v) => updateSessionMonitorLevels({ vocalLevel: v }) : undefined} compact />
                      <MonitorSlider label="HP Out" value={isEngineer ? live.headphoneLevelEngineer : live.headphoneLevelArtist} color={S.yellow} onChange={(v) => updateSessionHeadphoneLevel(v)} compact />
                      <MonitorSlider label="Cue Mix" value={live.cueMix} color={S.purple} onChange={isEngineer ? (v) => updateSessionMonitorLevels({ cueMix: v }) : undefined} compact leftLabel="Vox" rightLabel="Beat" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Expanded video overlays ── */}
      {expandedPanel === "artist" && (
        <ExpandedVideoOverlay stream={artistStream} mirrored={artistMirrored} label="Artist View" audioMuted={isArtist} volume={1} onClose={() => setExpandedPanel(null)} />
      )}
      {expandedPanel === "engineer" && (
        <ExpandedVideoOverlay stream={engineerStream} mirrored={engineerMirrored} label="Engineer View" screenShareStream={collaborationShareActive ? screenShareViewStream : null} audioMuted={isEngineer} volume={1} onClose={() => setExpandedPanel(null)} />
      )}
      {expandedPanel === "screen" && (
        <ExpandedVideoOverlay stream={screenShareViewStream} label="Screen Share" audioMuted={isEngineer} volume={1} onClose={() => setExpandedPanel(null)} />
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function TransportBtn({ icon, label, active, onClick, color, disabled, pulse }: {
  icon: string; label: string; active: boolean; onClick?: () => void; color: string; disabled?: boolean; pulse?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[11px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        background: active ? `${color}18` : "transparent",
        color: active ? color : S.textDim,
        border: `1px solid ${active ? `${color}50` : S.cardBorder}`,
        boxShadow: active ? S.glow(color, 0.2) : "none",
      }}>
      <span className={pulse ? "animate-pulse" : ""} style={{ color }}>{icon}</span>
      {label}
    </button>
  );
}

function MeterRow({ label, level, color = S.green, status }: { label: string; level: number; color?: string; status?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: S.textMuted }}>{label}</span>
        {status && <span className="text-[8px] font-semibold uppercase" style={{ color: S.textDim }}>{status}</span>}
      </div>
      <HMeter level={level} color={color} />
    </div>
  );
}

function StatusRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px]" style={{ color: S.textMuted }}>{label}</span>
      <span className="text-[11px] font-semibold" style={{ color: color || S.text }}>{value}</span>
    </div>
  );
}

function MonitorSlider({ label, value, color, onChange, leftLabel, rightLabel, compact }: {
  label: string; value: number; color: string; onChange?: (v: number) => void; leftLabel?: string; rightLabel?: string; compact?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const handlePointer = (e: React.PointerEvent) => {
    if (!onChange || !trackRef.current) return;
    e.preventDefault();
    const rect = trackRef.current.getBoundingClientRect();
    const update = (ev: PointerEvent) => {
      const x = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      onChange(x);
    };
    update(e.nativeEvent);
    const onMove = (ev: PointerEvent) => update(ev);
    const onUp = () => { document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp); };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className={`font-semibold uppercase tracking-wider ${compact ? "text-[8px]" : "text-[10px]"}`} style={{ color: S.textMuted }}>{label}</span>
        <span className="font-mono text-[9px]" style={{ color: S.textDim }}>{Math.round(value * 100)}%</span>
      </div>
      <div ref={trackRef} onPointerDown={handlePointer}
        className={`relative w-full rounded-full cursor-pointer ${compact ? "h-[6px]" : "h-[8px]"}`}
        style={{ background: "#1a1d25", touchAction: "none" }}>
        <div className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-75"
          style={{ width: `${value * 100}%`, background: color, boxShadow: S.glow(color, 0.2) }} />
        <div className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 transition-[left] duration-75"
          style={{ left: `calc(${value * 100}% - 6px)`, background: "#fff", borderColor: color, boxShadow: S.glow(color, 0.3) }} />
      </div>
      {(leftLabel || rightLabel) && (
        <div className="mt-0.5 flex justify-between text-[8px]" style={{ color: S.textMuted }}>
          <span>{leftLabel}</span><span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}
