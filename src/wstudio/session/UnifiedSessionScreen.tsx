/**
 * W.STUDIO Live Session Screen — minimal plugin-inspired UI.
 *
 * Lovable UI shows ONLY status and the LIVE button. No fake plugin controls
 * (Gain / Mute / Listen / Talk / Stereo) — those belong to the AU plugin in
 * Logic. No mic-input dropdown — the browser uses the system default mic.
 *
 * Audio routing:
 *  - Artist: captures mic and sends it through the existing session/WebRTC
 *    transport to the engineer browser.
 *  - Engineer: receives the artist mic over the session and forwards PCM to
 *    the helper at http://127.0.0.1:48000/artist-audio?slot=0. The engineer
 *    page shows packet count from the inbound-WebRTC relay
 *    (StudioMediaContext + useEngineerBridgeRelay).
 *
 * Booking, session join, and navigation are untouched.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Power, Radio, LogOut, Mic, MicOff, Activity, Video as VideoIcon, Maximize2, Minimize2, Monitor, X } from "lucide-react";
import { useSession } from "./SessionContext";
import { useStudioMedia } from "../media/StudioMediaContext";
import { useBookingTimer } from "../booking/BookingTimerContext";
import { SessionTimerBar } from "../booking/SessionTimerBar";
import { VideoPanel } from "../video/VideoPanel";
import { useArtistBridgePost } from "../bridge/useArtistBridgePost";

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
const ENGINEER_HOST_KEY = "wstudio.artist.engineerHost";

function LiveOrb({
  live,
  size = 168,
  onClick,
  disabled,
  label,
}: {
  live: boolean;
  size?: number;
  onClick?: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="relative flex items-center justify-center rounded-full transition active:scale-95"
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
        cursor: onClick && !disabled ? "pointer" : "default",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div
        className="absolute inset-3 rounded-full pointer-events-none"
        style={{ border: `1px solid ${live ? "rgba(46,224,216,0.4)" : "#1a2028"}` }}
      />
      <span
        className="select-none font-black tracking-widest"
        style={{
          color: live ? "#eafffd" : C.dim,
          fontSize: size * 0.16,
          letterSpacing: "0.18em",
          textShadow: live ? `0 0 12px ${C.cyanGlow}` : "none",
        }}
      >
        {label ?? (live ? "LIVE" : "CONNECT")}
      </span>
    </button>
  );
}

function MeterBar({ level }: { level: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, level)) * 100);
  return (
    <div
      className="h-2 w-full overflow-hidden rounded"
      style={{ background: C.inset, border: `1px solid ${C.insetEdge}` }}
    >
      <div
        className="h-full rounded transition-[width] duration-75"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${C.green}, ${C.yellow} 70%, ${C.red})`,
          boxShadow: pct > 0 ? `0 0 6px ${C.cyanGlow}` : "none",
        }}
      />
    </div>
  );
}

export default function UnifiedSessionScreen() {
  const navigate = useNavigate();
  const {
    sessionId,
    sessionDisplayName,
    role,
    connection,
    leaveSession,
    muted,
    screenSharing,
    toggleScreenShare,
  } = useSession();

  const {
    localStream,
    localMicMonitorStream,
    localMicLevel,
    hasRemoteAudio,
    engineerRelayStats,
    audioInputDevices,
    selectedMicDeviceId,
    setSelectedMicDeviceId,
    remoteStream,
    remoteStreamForPlayback,
    localScreenPreview,
  } = useStudioMedia();

  const {
    totalBookedMinutes,
    remainingSeconds,
    warningLevel,
    phase,
    timerRunning,
  } = useBookingTimer();

  const [artistSlot, setArtistSlot] = useState(1);
  const [engineerHost, setEngineerHost] = useState<string>(() => {
    if (typeof window === "undefined") return "192.168.12.155";
    return window.localStorage.getItem(ENGINEER_HOST_KEY) ?? "192.168.12.155";
  });
  const [armed, setArmed] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoExpanded, setVideoExpanded] = useState(false);

  useEffect(() => {
    if (!sessionId || !role) {
      navigate("/wstudio/session/join", { replace: true });
    }
  }, [sessionId, role, navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ENGINEER_HOST_KEY, engineerHost);
  }, [engineerHost]);

  const isArtist = role === "artist";
  const isEngineer = role === "engineer";

  // Use the RAW mic monitor stream (same source as the local meter) so the
  // posted PCM samples are guaranteed to be the real microphone — not the
  // cloned/gated WebRTC send track which can emit silence in some browsers.
  const bridgeSourceStream = isArtist ? localMicMonitorStream ?? localStream : null;

  const artistBridgeStats = useArtistBridgePost(
    bridgeSourceStream,
    engineerHost,
    artistSlot - 1,
    isArtist && armed,
  );

  // Connected indicator semantics:
  //  - Artist: mic is live AND POST relay reports CONNECTED (or armed locally if no host set).
  //  - Engineer: AU plugin relay reports CONNECTED.
  const micLive = !!bridgeSourceStream && bridgeSourceStream.getAudioTracks().some((t) => t.readyState === "live");
  const connected = isEngineer
    ? armed || engineerRelayStats?.state === "CONNECTED"
    : isArtist
      ? armed && micLive && (engineerHost.trim() === "" ? true : artistBridgeStats.state === "CONNECTED")
      : connection === "connected" && hasRemoteAudio;

  const statusLabel = useMemo(() => {
    if (isEngineer) {
      if (!armed) return "Tap to go LIVE";
      if (engineerRelayStats?.state === "CONNECTED") return "Plugin Connected";
      if (engineerRelayStats?.state === "CONNECTING") return "Connecting to Plugin…";
      return "Live — waiting for plugin packets";
    }
    if (isArtist) {
      if (!armed) return "Tap CONNECT to go LIVE";
      if (!micLive) return "Waiting for Mic…";
      if (engineerHost.trim() === "") return "Live (no engineer host set)";
      if (artistBridgeStats.state === "CONNECTED") return "Live → Engineer Bridge";
      if (artistBridgeStats.state === "CONNECTING") return "Connecting to Engineer Bridge…";
      return artistBridgeStats.lastError ?? "Bridge unreachable";
    }
    return connection === "connected" ? "Session Connected" : "Connecting…";
  }, [
    isArtist,
    isEngineer,
    armed,
    micLive,
    engineerHost,
    artistBridgeStats.state,
    artistBridgeStats.lastError,
    engineerRelayStats?.state,
    connection,
  ]);

  const handleEnd = () => {
    setArmed(false);
    leaveSession();
    navigate("/wstudio/session/join", { replace: true });
  };

  const handleLiveTap = () => {
    if (!isArtist && !isEngineer) return;
    setArmed((a) => !a);
  };

  const meterLevel = isArtist ? localMicLevel : engineerRelayStats?.remoteLevel ?? 0;

  return (
    <div
      className="flex min-h-[100dvh] w-full flex-col items-center px-3 pb-6 pt-3"
      style={{ background: `linear-gradient(180deg, ${C.shellTop} 0%, ${C.shellBot} 100%)` }}
    >
      {totalBookedMinutes > 0 && (
        <div className="mb-3 w-full max-w-[560px]">
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

      <div
        className="w-full max-w-[560px] overflow-hidden rounded-[10px]"
        style={{
          background: `linear-gradient(180deg, #0e1218 0%, #05080c 100%)`,
          border: `1px solid ${C.panelEdge}`,
          boxShadow: `0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{
            background: `linear-gradient(180deg, ${C.panel} 0%, #0a0e14 100%)`,
            borderBottom: `1px solid ${C.panelEdge}`,
          }}
        >
          <div className="flex items-center">
            <span className="text-[20px] font-black italic" style={{ color: C.text }}>W</span>
            <span
              className="mx-0.5 text-[20px] font-black"
              style={{
                color: C.cyan,
                transform: "skewX(-20deg)",
                display: "inline-block",
                textShadow: `0 0 6px ${C.cyanGlow}`,
              }}
            >/</span>
            <span className="text-[20px] font-black tracking-[0.22em]" style={{ color: C.text }}>_STUDIO</span>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setVideoOpen((v) => !v)}
            title="Toggle video"
            className="flex items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider mr-1.5"
            style={{
              background: videoOpen ? "#0e2a2a" : "#0e1218",
              color: videoOpen ? C.cyan : C.text,
              border: `1px solid ${videoOpen ? C.cyan : C.panelEdge}`,
            }}
          >
            <VideoIcon className="h-3.5 w-3.5" /> Video
          </button>
          <button
            onClick={handleEnd}
            className="flex items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider"
            style={{ background: "#2a0e0e", color: "#fca5a5", border: "1px solid #4a1818" }}
          >
            <LogOut className="h-3.5 w-3.5" /> End
          </button>
        </div>

        {/* Status bar */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ background: "#0c1117", borderBottom: `1px solid ${C.panelEdge}` }}
        >
          <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: C.text }}>
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
            <span style={{ color: connected ? C.green : C.dim }}>
              {connected ? "CONNECTED" : "OFFLINE"}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-6" style={{ background: "#0a0e14" }}>
          <div className="flex flex-col items-center gap-5">
            <LiveOrb
              live={connected}
              size={150}
              onClick={isArtist || isEngineer ? handleLiveTap : undefined}
              disabled={false}
              label={
                armed
                  ? connected
                    ? "LIVE"
                    : isArtist
                      ? "ARMED"
                      : "LIVE"
                  : isArtist
                    ? "CONNECT"
                    : "OFF"
              }
            />

            {/* Mic / level row */}
            <div className="w-full max-w-[360px]">
              <div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-wider" style={{ color: C.dim }}>
                <span className="flex items-center gap-1.5">
                  {isArtist ? (
                    micLive && !muted ? <Mic className="h-3 w-3" style={{ color: C.green }} /> : <MicOff className="h-3 w-3" />
                  ) : (
                    <Activity className="h-3 w-3" />
                  )}
                  {isArtist ? (micLive ? "Mic ready" : "Mic permission needed") : "Remote artist"}
                </span>
                <span>Slot {artistSlot - 1}</span>
              </div>
              <MeterBar level={meterLevel} />
            </div>

            {/* Artist slot + engineer-host inputs */}
            {isArtist && (
              <div className="grid w-full max-w-[360px] grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider" style={{ color: C.dim }}>
                  Artist slot
                  <select
                    value={artistSlot}
                    onChange={(e) => setArtistSlot(Number(e.target.value))}
                    className="rounded-[4px] px-2 py-1.5 text-[12px] font-semibold focus:outline-none"
                    style={{ background: C.inset, color: C.text, border: `1px solid ${C.insetEdge}` }}
                  >
                    {ARTIST_SLOTS.map((n) => (
                      <option key={n} value={n}>Artist {n}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider" style={{ color: C.dim }}>
                  Engineer host (LAN IP)
                  <input
                    type="text"
                    value={engineerHost}
                    onChange={(e) => setEngineerHost(e.target.value)}
                    placeholder="192.168.12.155"
                    className="rounded-[4px] px-2 py-1.5 text-[12px] font-semibold focus:outline-none"
                    style={{ background: C.inset, color: C.text, border: `1px solid ${C.insetEdge}` }}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider sm:col-span-2" style={{ color: C.dim }}>
                  Mic input
                  <select
                    value={selectedMicDeviceId}
                    onChange={(e) => setSelectedMicDeviceId(e.target.value)}
                    className="rounded-[4px] px-2 py-1.5 text-[12px] font-semibold focus:outline-none"
                    style={{ background: C.inset, color: C.text, border: `1px solid ${C.insetEdge}` }}
                  >
                    <option value="default">System default</option>
                    {audioInputDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Mic ${d.deviceId.slice(0, 6)}`}
                      </option>
                    ))}
                  </select>
                  {audioInputDevices.length === 0 && (
                    <span className="text-[10px] normal-case" style={{ color: C.dim }}>
                      Tap CONNECT once to grant mic access — devices will populate.
                    </span>
                  )}
                </label>
              </div>
            )}

            {/* Engineer slot selector */}
            {isEngineer && (
              <div className="w-full max-w-[360px]">
                <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider" style={{ color: C.dim }}>
                  Active artist slot (display)
                  <select
                    value={artistSlot}
                    onChange={(e) => setArtistSlot(Number(e.target.value))}
                    className="rounded-[4px] px-2 py-1.5 text-[12px] font-semibold focus:outline-none"
                    style={{ background: C.inset, color: C.text, border: `1px solid ${C.insetEdge}` }}
                  >
                    {ARTIST_SLOTS.map((n) => (
                      <option key={n} value={n}>Artist {n}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {/* Packet stats */}
            <div
              className="grid w-full max-w-[360px] grid-cols-2 gap-2 rounded-[4px] px-3 py-2 text-[11px]"
              style={{ background: C.inset, border: `1px solid ${C.insetEdge}`, color: C.text }}
            >
              {isArtist ? (
                <>
                  <div>
                    <div style={{ color: C.dim }}>Packets sent</div>
                    <div className="font-bold" style={{ color: C.green }}>{artistBridgeStats.packetsPosted}</div>
                  </div>
                  <div>
                    <div style={{ color: C.dim }}>Failed</div>
                    <div className="font-bold" style={{ color: artistBridgeStats.packetsFailed ? C.red : C.dim }}>
                      {artistBridgeStats.packetsFailed}
                    </div>
                  </div>
                  <div className="col-span-2 truncate" style={{ color: C.dim }}>
                    → {artistBridgeStats.targetUrl || "set engineer host to begin"}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div style={{ color: C.dim }}>Packets sent</div>
                    <div className="font-bold" style={{ color: C.green }}>
                      {engineerRelayStats?.packetsPosted ?? 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: C.dim }}>Failed</div>
                    <div
                      className="font-bold"
                      style={{ color: (engineerRelayStats?.packetsFailed ?? 0) ? C.red : C.dim }}
                    >
                      {engineerRelayStats?.packetsFailed ?? 0}
                    </div>
                  </div>
                  <div className="col-span-2 truncate" style={{ color: C.dim }}>
                    → {engineerRelayStats?.targetUrl ?? "127.0.0.1:48000"}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-center py-2 text-[11px] font-semibold tracking-[0.2em]"
          style={{ background: "#06090d", color: C.dim, borderTop: `1px solid ${C.panelEdge}` }}
        >
          {isArtist ? "ARTIST" : isEngineer ? "ENGINEER" : ""} · SLOT {artistSlot - 1}
        </div>
      </div>

      {isEngineer && (
        <p className="mt-3 max-w-[560px] text-center text-[11px]" style={{ color: C.dim }}>
          Browser is silent. Artist audio reaches the W.STUDIO AU plugin on this Mac at 127.0.0.1:47999.
          Use Logic + the plugin for all monitoring and controls.
        </p>
      )}
      {isArtist && (
        <p className="mt-3 max-w-[560px] text-center text-[11px]" style={{ color: C.dim }}>
          Tap CONNECT to capture your mic and stream it to the engineer's bridge. Default system mic is used.
          If your browser blocks the request (Mixed Content over HTTPS), open this page over HTTP on the
          engineer's LAN, or have the engineer terminate TLS on the bridge.
        </p>
      )}

      {videoOpen && (
        <VideoOverlay
          expanded={videoExpanded}
          onToggleExpand={() => setVideoExpanded((v) => !v)}
          onClose={() => {
            setVideoOpen(false);
            setVideoExpanded(false);
          }}
          localStream={localStream}
          remoteStream={remoteStreamForPlayback ?? remoteStream}
          localScreenPreview={localScreenPreview}
          screenSharing={screenSharing}
          onToggleScreenShare={toggleScreenShare}
          
          isArtist={isArtist}
          isEngineer={isEngineer}
        />
      )}
    </div>
  );
}

function VideoOverlay({
  expanded,
  onToggleExpand,
  onClose,
  localStream,
  remoteStream,
  localScreenPreview,
  screenSharing,
  onToggleScreenShare,
  isArtist,
  isEngineer,
}: {
  expanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  localScreenPreview: MediaStream | null;
  screenSharing: boolean;
  onToggleScreenShare: () => void;
  
  isArtist: boolean;
  isEngineer: boolean;
}) {
  // Engineer is the HOST and does NOT count against the 12-artist capacity.
  const ARTIST_CAPACITY = 12;
  type Tile = { key: string; title: string; subtitle: string; stream: MediaStream | null; mirrored?: boolean; muted: boolean; isHost?: boolean; isArtistSeat?: boolean };
  const tiles: Tile[] = [];
  const selfTile: Tile = {
    key: "self",
    title: isArtist ? "You (Artist)" : isEngineer ? "You (Engineer · Host)" : "You",
    subtitle: "Local camera",
    stream: localStream,
    mirrored: true,
    muted: true,
    isHost: isEngineer,
    isArtistSeat: isArtist,
  };
  const remoteTile: Tile = {
    key: "remote",
    title: isArtist ? "Engineer · Host" : "Artist",
    subtitle: "Remote camera",
    stream: remoteStream,
    muted: true,
    isHost: isArtist,
    isArtistSeat: isEngineer,
  };
  // Engineer (host) always shown first.
  if (isArtist) {
    tiles.push(remoteTile, selfTile);
  } else {
    tiles.push(selfTile, remoteTile);
  }
  if (localScreenPreview) {
    tiles.push({
      key: "screen",
      title: "Your screen share",
      subtitle: "Screen preview",
      stream: localScreenPreview,
      muted: true,
    });
  }

  const artistCount = tiles.filter((t) => t.isArtistSeat).length;
  const placeholderCount = expanded ? Math.max(0, ARTIST_CAPACITY - artistCount) : 0;
  // Collapsed nav box shows up to 3 tiles side-by-side at the same size.
  const cols = expanded ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4" : "grid-cols-3";

  // --- Draggable floating box (only when collapsed) ---
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);

  useEffect(() => {
    if (expanded) return;
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const { ox, oy, sx, sy } = dragRef.current;
      const nx = Math.max(8, Math.min(window.innerWidth - 100, ox + (e.clientX - sx)));
      const ny = Math.max(8, Math.min(window.innerHeight - 60, oy + (e.clientY - sy)));
      setPos({ x: nx, y: ny });
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [expanded]);

  const startDrag = (e: React.PointerEvent) => {
    if (expanded) return;
    const rect = (e.currentTarget.closest("[data-video-overlay]") as HTMLElement)?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { ox: rect.left, oy: rect.top, sx: e.clientX, sy: e.clientY };
    if (!pos) setPos({ x: rect.left, y: rect.top });
  };

  const floatStyle: React.CSSProperties = expanded
    ? {}
    : pos
      ? { position: "fixed", left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
      : { position: "fixed", right: 16, bottom: 16 };

  return (
    <div
      data-video-overlay
      style={floatStyle}
      className={
        expanded
          ? "fixed inset-0 z-[120] flex flex-col bg-black/95 p-4"
          : "z-[120] flex w-[440px] max-w-[94vw] flex-col rounded-xl border border-zinc-700 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur"
      }
    >
      <div
        className={`mb-2 flex items-center gap-2 ${expanded ? "" : "cursor-move select-none"}`}
        onPointerDown={startDrag}
      >
        <VideoIcon className="h-3.5 w-3.5 text-cyan-300" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-200">
          Video {expanded ? "· Expanded" : ""}
        </span>
        <span className="text-[10px] text-zinc-500">
          ({artistCount}/{ARTIST_CAPACITY} artists · host separate)
        </span>
        <div className="flex-1" />
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleScreenShare}
          title={screenSharing ? "Stop screen share" : "Share screen"}
          className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: screenSharing ? "#0e2a2a" : "#1a1f26",
            color: screenSharing ? "#67e8f9" : "#d4d4d8",
            border: `1px solid ${screenSharing ? "#22d3ee" : "#3f3f46"}`,
          }}
        >
          <Monitor className="h-3 w-3" />
          {screenSharing ? "Stop share" : "Share"}
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleExpand}
          title={expanded ? "Collapse" : "Expand"}
          className="flex items-center justify-center rounded p-1 text-zinc-300 hover:bg-zinc-800"
        >
          {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          title="Close"
          className="flex items-center justify-center rounded p-1 text-zinc-300 hover:bg-zinc-800"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className={`grid flex-1 gap-2 overflow-auto ${cols}`}>
        {tiles.map((t) => (
          <div key={t.key} className="relative aspect-video">
            <VideoPanel
              title={t.title}
              subtitle={t.subtitle}
              stream={t.stream}
              mirrored={t.mirrored}
              videoMuted={t.muted}
              className="absolute inset-0 h-full w-full min-h-0"
            />
            {t.isHost && (
              <span className="absolute left-1 top-1 z-10 rounded bg-cyan-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black">
                Host
              </span>
            )}
          </div>
        ))}
        {Array.from({ length: placeholderCount }).map((_, i) => (
          <div
            key={`ph-${i}`}
            className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 text-[10px] uppercase tracking-wider text-zinc-600"
          >
            Artist {artistCount + i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}
