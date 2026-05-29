import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useStudio } from "../state/StudioContext";
import { useArtistSessionSync } from "../state/sessionSync";
import { useStudioPeerVideo } from "../state/usePeerVideo";
import VideoTile from "../components/VideoTile";
import MicLevelMeter from "../components/MicLevelMeter";
import SessionChat from "../components/SessionChat";
import FileTransfer from "../components/FileTransfer";
import TransportDebugPanel from "../components/TransportDebugPanel";
import { useStudioArtistSender, useStudioPluginStatus } from "../audio/useStudioTransport";
import { Camera, CameraOff, Mic, MicOff, Headphones, Radio, CheckCircle2, Music2 } from "lucide-react";

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
  const { sessionId } = useParams();
  const { session, sessionState, isLive, micMuted, setMicMuted, cameraOn, setCameraOn } = useStudio();
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [camStream, setCamStream] = useState<MediaStream | null>(null);
  const acquiredMicRef = useRef(false);

  const { status, update } = useArtistSessionSync(sessionId);

  // Mic acquired once.
  useEffect(() => {
    if (acquiredMicRef.current) return;
    acquiredMicRef.current = true;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        setMicStream(s);
        update({ joinedAt: Date.now(), micLive: !micMuted });
      })
      .catch(() => setMicStream(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Camera acquired/released with toggle.
  useEffect(() => {
    if (!cameraOn) {
      setCamStream((prev) => { prev?.getTracks().forEach((t) => t.stop()); return null; });
      return;
    }
    let cancelled = false;
    let acquired: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: true }).then((s) => {
      if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
      acquired = s;
      setCamStream(s);
    }).catch(() => setCamStream(null));
    return () => { cancelled = true; acquired?.getTracks().forEach((t) => t.stop()); };
  }, [cameraOn]);

  // Toggle mic track enabled (don't stop, so peer connection keeps sender alive).
  useEffect(() => {
    micStream?.getAudioTracks().forEach((t) => (t.enabled = !micMuted));
  }, [micStream, micMuted]);

  // Combined outbound stream for the peer.
  const localStream = useMemo(() => {
    const tracks = [
      ...(camStream?.getVideoTracks() ?? []),
      ...(micStream?.getAudioTracks() ?? []),
    ];
    return tracks.length ? new MediaStream(tracks) : null;
  }, [camStream, micStream]);

  // Local preview stream (video only) for the self tile.
  const selfPreview = useMemo(() => {
    const t = camStream?.getVideoTracks() ?? [];
    return t.length ? new MediaStream(t) : null;
  }, [camStream]);

  const { remoteStream, connState } = useStudioPeerVideo(sessionId, "artist", localStream);
  const remoteConnected = connState === "connected" || connState === "completed" as any;

  // Sync to session state.
  useEffect(() => { update({ micLive: !!micStream && !micMuted }); }, [micStream, micMuted, update]);
  useEffect(() => { update({ cameraOn }); }, [cameraOn, update]);

  const senderStats = useStudioArtistSender(micStream, "", 0, false);
  const pluginStatus = useStudioPluginStatus(false);
  const transportLive = pluginStatus.state === "LIVE";
  useEffect(() => { update({ hqReady: transportLive }); }, [transportLive, update]);

  const label = isLive ? "● Recording" : (STATUS_LABEL[sessionState] ?? "Connected");
  const tone =
    isLive ? "bg-[hsl(var(--studio-red)/0.12)] text-[hsl(var(--studio-red))]"
    : status.artistReady ? "studio-glow-green bg-[hsl(var(--studio-green)/0.08)] text-[hsl(var(--studio-green))]"
    : "studio-card-inset text-[hsl(var(--studio-text-dim))]";

  return (
    <div className="min-h-screen p-4 space-y-4 max-w-2xl mx-auto">
      <div className="studio-card px-4 py-3 flex items-center gap-3">
        <span className="studio-status-dot live" />
        <div className="font-bold tracking-wider">W.STUDIO</div>
        <div className="ml-auto text-xs text-[hsl(var(--studio-text-dim))]">{session?.name ?? "Live Session"}</div>
      </div>

      <div className={`rounded-xl p-4 text-center font-semibold tracking-wide ${tone}`}>
        {status.artistReady ? "READY — Engineer notified" : label}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <VideoTile
          name={session?.engineerName ?? "Engineer"}
          primary
          quality={remoteConnected ? "good" : "ok"}
          stream={remoteStream}
          cameraOn={!!remoteStream?.getVideoTracks().length}
        />
        <VideoTile name="You" isSelf cameraOn={cameraOn} micMuted={micMuted} stream={selfPreview} />
      </div>

      {!remoteConnected && (
        <div className="text-[11px] text-center text-[hsl(var(--studio-amber))] bg-[hsl(var(--studio-amber)/0.08)] border border-[hsl(var(--studio-amber)/0.25)] rounded-md px-3 py-1.5">
          Local preview only — remote WebRTC not connected ({connState})
        </div>
      )}

      <MicLevelMeter stream={micStream} muted={micMuted} />

      <div className="studio-card p-3 flex flex-wrap gap-2 justify-center">
        <button
          className={`studio-btn ${!micMuted && micStream ? "studio-glow-green" : ""} ${micMuted ? "studio-btn-danger" : ""}`}
          onClick={() => setMicMuted(!micMuted)}
        >
          {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          {micStream ? (micMuted ? "Muted" : "Mic Live") : "Mic —"}
        </button>
        <button className="studio-btn" onClick={() => setCameraOn(!cameraOn)}>
          {cameraOn ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />} Camera
        </button>
        <button
          className={`studio-btn ${status.headphonesOk ? "studio-glow-green" : ""}`}
          onClick={() => update({ headphonesOk: !status.headphonesOk })}
        >
          <Headphones className="w-4 h-4 text-[hsl(var(--studio-blue))]" />
          {status.headphonesOk ? "Headphones OK" : "Confirm Headphones"}
        </button>
        <button
          className={`studio-btn ${status.artistCanHearBeat ? "studio-glow-green" : ""}`}
          onClick={() => update({ artistCanHearBeat: !status.artistCanHearBeat })}
        >
          <Music2 className="w-4 h-4 text-[hsl(var(--studio-blue))]" />
          {status.artistCanHearBeat ? "Beat Heard ✓" : "I Can Hear Beat"}
        </button>
        <div className="studio-btn">
          <Radio className={`w-4 h-4 ${transportLive ? "text-[hsl(var(--studio-green))]" : "text-[hsl(var(--studio-text-dim))]"}`} />
          HQ {transportLive ? "Live" : "Standby"}
        </div>
        <button
          className={`studio-btn ${status.artistReady ? "studio-glow-green" : "studio-btn-primary"}`}
          onClick={() => update({ artistReady: !status.artistReady })}
        >
          <CheckCircle2 className="w-4 h-4" />
          {status.artistReady ? "Ready ✓" : "I'm Ready"}
        </button>
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
