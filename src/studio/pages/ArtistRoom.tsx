import { useEffect, useRef, useState } from "react";
import { useStudio } from "../state/StudioContext";
import VideoTile from "../components/VideoTile";
import SessionChat from "../components/SessionChat";
import FileTransfer from "../components/FileTransfer";
import TransportDebugPanel from "../components/TransportDebugPanel";
import { useStudioArtistSender, useStudioPluginStatus } from "../audio/useStudioTransport";
import { Camera, CameraOff, Mic, MicOff, Headphones, Radio } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  waiting_for_artist: "Waiting for engineer",
  artist_joined: "Connected — testing audio",
  testing_audio: "Testing audio",
  plugin_connected: "Plugin connected",
  ready_to_record: "Ready to record",
  recording: "● Recording",
  paused: "Paused",
  ended: "Session ended",
};

export default function ArtistRoom() {
  const { session, sessionState, isLive, micMuted, setMicMuted, cameraOn, setCameraOn, checklist } = useStudio();
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const acquiredRef = useRef(false);

  // Acquire local mic for the active transport (only after the artist is
  // already in the room — the join page handled permissions).
  useEffect(() => {
    if (acquiredRef.current) return;
    acquiredRef.current = true;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(setMicStream)
      .catch(() => setMicStream(null));
    return () => {
      micStream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Artist HQ audio is sent to the engineer via the active transport.
  // For the /studio prototype we don't yet have a confirmed engineer
  // target URL, so we keep sending disabled but still surface status.
  const senderStats = useStudioArtistSender(micStream, "", 0, false);
  const pluginStatus = useStudioPluginStatus(false);
  const transportLive = pluginStatus.state === "LIVE";

  const label = isLive ? "● Recording" : (STATUS_LABEL[sessionState] ?? "Connected");
  const tone =
    isLive ? "bg-[hsl(var(--studio-red)/0.12)] text-[hsl(var(--studio-red))]"
    : sessionState === "ready_to_record" ? "studio-glow-green bg-[hsl(var(--studio-green)/0.08)] text-[hsl(var(--studio-green))]"
    : "studio-card-inset text-[hsl(var(--studio-text-dim))]";

  return (
    <div className="min-h-screen p-4 space-y-4 max-w-2xl mx-auto">
      <div className="studio-card px-4 py-3 flex items-center gap-3">
        <span className="studio-status-dot live" />
        <div className="font-bold tracking-wider">W.STUDIO</div>
        <div className="ml-auto text-xs text-[hsl(var(--studio-text-dim))]">{session?.name ?? "Live Session"}</div>
      </div>

      <div className={`rounded-xl p-4 text-center font-semibold tracking-wide ${tone}`}>{label}</div>

      <div className="grid grid-cols-2 gap-3">
        <VideoTile name={session?.engineerName ?? "Engineer"} primary quality="good" />
        <VideoTile name="You" isSelf cameraOn={cameraOn} micMuted={micMuted} />
      </div>

      <div className="studio-card p-3 flex flex-wrap gap-2 justify-center">
        <button className={`studio-btn ${micMuted ? "studio-btn-danger" : ""}`} onClick={() => setMicMuted(!micMuted)}>
          {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          {micStream ? (micMuted ? "Muted" : "Mic Live") : "Mic —"}
        </button>
        <button className="studio-btn" onClick={() => setCameraOn(!cameraOn)}>
          {cameraOn ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />} Camera
        </button>
        <div className="studio-btn">
          <Headphones className="w-4 h-4 text-[hsl(var(--studio-blue))]" />
          {checklist.artistHeadphones ? "Headphones OK" : "Headphones —"}
        </div>
        <div className="studio-btn">
          <Radio className={`w-4 h-4 ${transportLive ? "text-[hsl(var(--studio-green))]" : "text-[hsl(var(--studio-text-dim))]"}`} />
          HQ {transportLive ? "Live" : "Standby"}
        </div>
      </div>

      <TransportDebugPanel
        role="artist"
        artistStats={{
          packetsPosted: senderStats.packetsPosted,
          packetsFailed: senderStats.packetsFailed,
          packetsDropped: senderStats.packetsDropped,
          state: senderStats.state,
          lastError: senderStats.lastError,
          targetUrl: senderStats.targetUrl,
          level: senderStats.level,
        }}
      />

      <SessionChat author={session?.artistName ?? "Artist"} />
      <FileTransfer uploader={session?.artistName ?? "Artist"} />
    </div>
  );
}
