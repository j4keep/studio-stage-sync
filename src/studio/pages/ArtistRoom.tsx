import { useStudio } from "../state/StudioContext";
import VideoTile from "../components/VideoTile";
import SessionChat from "../components/SessionChat";
import FileTransfer from "../components/FileTransfer";
import { Camera, CameraOff, Mic, MicOff, Headphones } from "lucide-react";

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
          {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />} {micMuted ? "Muted" : "Mute"}
        </button>
        <button className="studio-btn" onClick={() => setCameraOn(!cameraOn)}>
          {cameraOn ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />} Camera
        </button>
        <div className="studio-btn">
          <Headphones className="w-4 h-4 text-[hsl(var(--studio-blue))]" />
          {checklist.artistHeadphones ? "Headphones OK" : "Headphones —"}
        </div>
      </div>

      <SessionChat author={session?.artistName ?? "Artist"} />
      <FileTransfer uploader={session?.artistName ?? "Artist"} />
    </div>
  );
}
