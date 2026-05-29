import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStudio } from "../state/StudioContext";
import { useArtistSessionSync } from "../state/sessionSync";
import { useStudioPeerVideo } from "../state/usePeerVideo";
import TopBar from "../components/TopBar";
import VideoTile from "../components/VideoTile";
import HQAudioPanel from "../components/HQAudioPanel";
import TransportBar from "../components/TransportBar";
import PluginStatusPanel from "../components/PluginStatusPanel";
import SessionChat from "../components/SessionChat";
import FileTransfer from "../components/FileTransfer";
import TransportDebugPanel from "../components/TransportDebugPanel";
import { useStudioEngineerRelay, useStudioPluginStatus } from "../audio/useStudioTransport";
import { Camera, CameraOff, Mic, MicOff, ScreenShare, Maximize2 } from "lucide-react";

export default function EngineerRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { session, micMuted, setMicMuted, cameraOn, setCameraOn, plugin, notes, setNotes, createSession,
    toggleCheck, setArtist } = useStudio();

  const pluginStatus = useStudioPluginStatus(true);
  const relayStats = useStudioEngineerRelay(null, 0, false);
  const { status: artistStatus } = useArtistSessionSync(sessionId);

  // Local A/V capture for the engineer side.
  const [camStream, setCamStream] = useState<MediaStream | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const acquiredMicRef = useRef(false);

  useEffect(() => {
    if (acquiredMicRef.current) return;
    acquiredMicRef.current = true;
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(setMicStream).catch(() => setMicStream(null));
  }, []);
  useEffect(() => {
    if (!cameraOn) {
      setCamStream((prev) => { prev?.getTracks().forEach((t) => t.stop()); return null; });
      return;
    }
    let cancelled = false; let acquired: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: true }).then((s) => {
      if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
      acquired = s; setCamStream(s);
    }).catch(() => setCamStream(null));
    return () => { cancelled = true; acquired?.getTracks().forEach((t) => t.stop()); };
  }, [cameraOn]);
  useEffect(() => {
    micStream?.getAudioTracks().forEach((t) => (t.enabled = !micMuted));
  }, [micStream, micMuted]);

  const localStream = useMemo(() => {
    const tracks = [
      ...(camStream?.getVideoTracks() ?? []),
      ...(micStream?.getAudioTracks() ?? []),
    ];
    return tracks.length ? new MediaStream(tracks) : null;
  }, [camStream, micStream]);
  const selfPreview = useMemo(() => {
    const t = camStream?.getVideoTracks() ?? [];
    return t.length ? new MediaStream(t) : null;
  }, [camStream]);

  const { remoteStream, connState } = useStudioPeerVideo(sessionId, "engineer", localStream);
  const remoteConnected = connState === "connected";

  useEffect(() => {
    if (!session && sessionId) {
      createSession({ name: "Live Session", artistName: "Artist", type: "Vocal Recording", engineerName: "Engineer" });
    }
  }, [session, sessionId, createSession]);

  // Mirror artist sync state into checklist + artist status.
  useEffect(() => {
    toggleCheck("artistMic", artistStatus.micLive);
  }, [artistStatus.micLive, toggleCheck]);
  useEffect(() => {
    toggleCheck("artistHeadphones", artistStatus.headphonesOk);
  }, [artistStatus.headphonesOk, toggleCheck]);
  useEffect(() => {
    toggleCheck("artistHearsBeat", artistStatus.artistCanHearBeat);
  }, [artistStatus.artistCanHearBeat, toggleCheck]);
  useEffect(() => {
    if (artistStatus.artistReady) setArtist("ready");
    else if (artistStatus.joinedAt) setArtist("connected");
  }, [artistStatus.artistReady, artistStatus.joinedAt, setArtist]);

  const pluginSignalAt = pluginStatus.state === "LIVE" ? Date.now() : null;
  const fs = () => document.documentElement.requestFullscreen?.().catch(() => {});

  return (
    <div className="min-h-screen p-3 sm:p-5 space-y-4">
      <TopBar />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(320px,420px)_320px] gap-4">
        {/* LEFT — video */}
        <div className="space-y-3">
          <div className={`studio-card px-3 py-2 flex items-center gap-3 text-xs ${
            artistStatus.artistReady ? "studio-glow-green" : ""
          }`}>
            <span className={`studio-status-dot ${artistStatus.joinedAt ? (artistStatus.artistReady ? "live" : "warn") : ""}`} />
            <span className="font-semibold tracking-wide">
              {artistStatus.artistReady
                ? "ARTIST READY"
                : artistStatus.joinedAt
                ? "Artist connected"
                : "Waiting for artist…"}
            </span>
            <span className="ml-auto flex items-center gap-3 text-[hsl(var(--studio-text-dim))]">
              <span>Mic: <b className={artistStatus.micLive ? "text-[hsl(var(--studio-green))]" : "text-[hsl(var(--studio-text-dim))]"}>{artistStatus.micLive ? "live" : "—"}</b></span>
              <span>Cam: <b className={(artistStatus.cameraOn || !!remoteStream?.getVideoTracks().length) ? "text-[hsl(var(--studio-green))]" : "text-[hsl(var(--studio-text-dim))]"}>{
                (artistStatus.cameraOn || !!remoteStream?.getVideoTracks().length)
                  ? (remoteConnected ? "on" : "on — local preview only")
                  : "off"
              }</b></span>
              <span>HP: <b className={artistStatus.headphonesOk ? "text-[hsl(var(--studio-green))]" : "text-[hsl(var(--studio-text-dim))]"}>{artistStatus.headphonesOk ? "ok" : "—"}</b></span>
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <VideoTile
              name={session?.artistName ?? "Artist"}
              quality={remoteConnected ? "good" : artistStatus.joinedAt ? "ok" : "poor"}
              primary
              stream={remoteStream}
              cameraOn={!!remoteStream?.getVideoTracks().length || artistStatus.cameraOn}
              micMuted={!artistStatus.micLive}
            />
            <VideoTile
              name={session?.engineerName ?? "Engineer"}
              isSelf
              cameraOn={cameraOn}
              micMuted={micMuted}
              quality="good"
              stream={selfPreview}
            />
          </div>
          {!remoteConnected && (
            <div className="text-[11px] text-center text-[hsl(var(--studio-amber))] bg-[hsl(var(--studio-amber)/0.08)] border border-[hsl(var(--studio-amber)/0.25)] rounded-md px-3 py-1.5">
              Local preview only — remote WebRTC not connected ({connState})
            </div>
          )}
          <div className="studio-card p-3 flex flex-wrap gap-2">
            <button className="studio-btn" onClick={() => setCameraOn(!cameraOn)}>
              {cameraOn ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />} {cameraOn ? "Camera On" : "Camera Off"}
            </button>
            <button className={`studio-btn ${micMuted ? "studio-btn-danger" : ""}`} onClick={() => setMicMuted(!micMuted)}>
              {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />} {micMuted ? "Unmute" : "Mute"}
            </button>
            <button className="studio-btn"><ScreenShare className="w-4 h-4" /> Share Screen</button>
            <button className="studio-btn ml-auto" onClick={fs}><Maximize2 className="w-4 h-4" /> Fullscreen</button>
          </div>

          <TransportBar />
          <TransportDebugPanel
            role="engineer"
            engineerStats={{
              packetsPosted: relayStats.packetsPosted,
              packetsFailed: relayStats.packetsFailed,
              packetsDropped: relayStats.packetsDropped,
              state: relayStats.state,
              lastError: relayStats.lastError,
              targetUrl: relayStats.targetUrl,
            }}
          />
        </div>

        {/* CENTER — HQ + plugin */}
        <div className="space-y-4">
          <HQAudioPanel />
          <PluginStatusPanel status={plugin} lastSignalMs={pluginSignalAt} />
        </div>

        {/* RIGHT — chat / files / notes */}
        <div className="space-y-4 flex flex-col">
          <SessionChat author={session?.engineerName ?? "Engineer"} />
          <FileTransfer uploader={session?.engineerName ?? "Engineer"} />
          <div className="studio-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--studio-text-muted))] mb-2">Session Notes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Take notes during the session…"
              className="w-full studio-card-inset px-3 py-2 text-sm resize-none focus:outline-none focus:border-[hsl(var(--studio-blue))]"
            />
          </div>
        </div>
      </div>

      <div className="text-center pt-2">
        <button onClick={() => navigate("/studio")} className="text-xs text-[hsl(var(--studio-text-muted))] hover:text-[hsl(var(--studio-blue))]">
          End session
        </button>
      </div>
    </div>
  );
}
