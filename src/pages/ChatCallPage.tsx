import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mic, MicOff, PhoneOff, Video, VideoOff, Loader2 } from "lucide-react";
import { Room, RoomEvent, Track } from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { stopAllPageMedia } from "@/lib/stop-page-media";
import { callRoomId } from "@/lib/message-call";

/** 1:1 audio/video call between two people in a chat conversation. */
export default function ChatCallPage() {
  const { conversationId } = useParams();
  const [params] = useSearchParams();
  const kind: "video" | "audio" = params.get("kind") === "audio" ? "audio" : "video";
  const nav = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [peerName, setPeerName] = useState("Call");
  const [conn, setConn] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(kind === "video");
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [remoteVideoOn, setRemoteVideoOn] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!user || !conversationId) return;
    (async () => {
      setLoading(true);
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", conversationId);
      const ids = (parts || []).map((p) => p.user_id);
      if (!ids.includes(user.id)) {
        setError("You’re not part of this conversation");
        setLoading(false);
        return;
      }
      const otherId = ids.find((id) => id !== user.id);
      if (otherId) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", otherId)
          .maybeSingle();
        setPeerName(prof?.display_name || "Call");
      }
      setAllowed(true);
      setLoading(false);
    })();
  }, [user, conversationId]);

  const attachRemote = (room: Room) => {
    let sawVideo = false;
    room.remoteParticipants.forEach((p) => {
      p.trackPublications.forEach((pub) => {
        const track = pub.track;
        if (!track) return;
        if (track.kind === Track.Kind.Video && remoteVideoRef.current && !sawVideo) {
          try {
            track.attach(remoteVideoRef.current);
            void remoteVideoRef.current.play?.().catch(() => {});
          } catch { /* ignore */ }
          sawVideo = true;
        }
        if (track.kind === Track.Kind.Audio && remoteAudioRef.current) {
          try {
            track.attach(remoteAudioRef.current);
            void remoteAudioRef.current.play?.().catch(() => {});
          } catch { /* ignore */ }
        }
      });
    });
    setRemoteJoined(room.remoteParticipants.size > 0);
    setRemoteVideoOn(sawVideo);
  };

  const connect = async () => {
    if (!user || !conversationId || !allowed) return;
    setConn("connecting");
    setError(null);
    try {
      stopAllPageMedia();
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      const { data, error: fnErr } = await supabase.functions.invoke("livekit-token", {
        body: {
          room: callRoomId(conversationId),
          name: profile?.display_name || user.email?.split("@")[0] || "Guest",
          canPublish: true,
        },
      });
      if (fnErr) throw fnErr;
      if (!data?.token || !data?.url) throw new Error(data?.error || "Could not start the call");

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, () => attachRemote(room));
      room.on(RoomEvent.TrackUnsubscribed, () => attachRemote(room));
      room.on(RoomEvent.ParticipantConnected, () => attachRemote(room));
      room.on(RoomEvent.ParticipantDisconnected, () => attachRemote(room));
      room.on(RoomEvent.LocalTrackPublished, () => {
        setMicOn(room.localParticipant.isMicrophoneEnabled);
        setCamOn(room.localParticipant.isCameraEnabled);
      });
      room.on(RoomEvent.Disconnected, () => {
        setRemoteJoined(false);
        setConn("idle");
      });

      await room.connect(data.url, data.token);
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch (micErr) {
        toast.error("Microphone unavailable — tap the mic button to retry");
        console.warn("mic publish failed", micErr);
      }
      setMicOn(room.localParticipant.isMicrophoneEnabled);
      if (kind === "video") {
        try {
          await room.localParticipant.setCameraEnabled(true);
          const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
          if (pub?.track && localVideoRef.current) pub.track.attach(localVideoRef.current);
        } catch (camErr) {
          toast.error("Camera unavailable — continuing with audio only");
          console.warn("camera publish failed", camErr);
        }
        setCamOn(room.localParticipant.isCameraEnabled);
      } else {
        setCamOn(false);
      }
      attachRemote(room);
      setConn("connected");
    } catch (e: any) {
      setConn("error");
      setError(e.message || "Failed to join the call");
      toast.error(e.message || "Failed to join the call");
    }
  };

  const hangUp = async (leavePage = false) => {
    const room = roomRef.current;
    roomRef.current = null;
    try {
      if (room) {
        room.localParticipant.trackPublications.forEach((pub) => {
          const track = pub.track as { stop?: () => void; detach?: () => void } | null;
          try {
            track?.stop?.();
            track?.detach?.();
          } catch { /* ignore */ }
        });
        await room.disconnect();
      }
    } catch { /* ignore */ }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current.pause();
    }
    setConn("idle");
    setRemoteJoined(false);
    setRemoteVideoOn(false);
    if (leavePage) nav("/messages", { replace: true });
  };

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !room.localParticipant.isMicrophoneEnabled;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicOn(room.localParticipant.isMicrophoneEnabled);
    } catch (e: any) {
      setMicOn(room.localParticipant.isMicrophoneEnabled);
      toast.error(e?.message || "Microphone blocked — allow mic access in your browser settings");
    }
  };

  const toggleCam = async () => {
    const room = roomRef.current;
    if (!room || kind !== "video") return;
    const next = !room.localParticipant.isCameraEnabled;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setCamOn(room.localParticipant.isCameraEnabled);
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      if (pub?.track && localVideoRef.current) pub.track.attach(localVideoRef.current);
    } catch (e: any) {
      setCamOn(room.localParticipant.isCameraEnabled);
      toast.error(e?.message || "Camera blocked");
    }
  };

  useEffect(() => {
    return () => {
      stopRing();
      const room = roomRef.current;
      roomRef.current = null;
      try {
        room?.localParticipant.trackPublications.forEach((pub) => {
          const track = pub.track as { stop?: () => void; detach?: () => void } | null;
          track?.stop?.();
          track?.detach?.();
        });
        room?.disconnect();
      } catch { /* ignore */ }
    };
  }, []);

  // Ringback tone while waiting for the other person to pick up.
  useEffect(() => {
    if ((conn === "connecting" || conn === "connected") && !remoteJoined) startRing("outgoing");
    else stopRing();
  }, [conn, remoteJoined]);

  // Accepted from the incoming-call banner → join straight away.
  const autoJoin = params.get("auto") === "1";
  const autoTried = useRef(false);
  useEffect(() => {
    if (!autoJoin || autoTried.current || !allowed || conn !== "idle") return;
    autoTried.current = true;
    void connect();
  }, [autoJoin, allowed, conn]);

  if (loading) return <div className="min-h-screen bg-zinc-950 p-6 text-sm text-white">Loading call…</div>;
  if (error && !allowed) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6 text-white">
        <button onClick={() => nav("/messages")} className="mb-4 text-sm text-zinc-400">← Back</button>
        <p className="text-sm text-rose-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex h-[100dvh] flex-col overflow-hidden bg-zinc-950 text-white">
      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button onClick={() => { void hangUp(true); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{peerName}</p>
          <p className="text-[11px] text-zinc-400">{kind === "video" ? "Video call" : "Audio call"}</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div className={`relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 ${kind === "audio" ? "flex items-center justify-center" : ""}`}>
          {kind === "video" ? (
            <>
              <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
              <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-3 right-3 h-32 w-24 rounded-xl border border-white/20 bg-black object-cover" />

              {(conn !== "connected" || !remoteJoined || !remoteVideoOn) && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 px-6 text-center text-sm text-zinc-400">
                  {conn === "connecting"
                    ? "Connecting…"
                    : conn !== "connected"
                      ? "Tap the button below to join"
                      : !remoteJoined
                        ? "Waiting for them to join…"
                        : "Their camera is off"}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                <Mic className="h-7 w-7" />
              </div>
              <p className="text-sm font-semibold">{conn === "connected" ? "Audio call connected" : "Audio call"}</p>
              <p className="text-[11px] text-zinc-400">
                {conn === "connecting"
                  ? "Connecting…"
                  : conn === "connected"
                    ? remoteJoined ? "Both parties connected" : "Waiting for them to join…"
                    : "Mic only — no camera"}
              </p>
            </div>
          )}
          <audio ref={remoteAudioRef} autoPlay />
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {conn === "connected" ? (
          <>
            <button onClick={toggleMic} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10" aria-label={micOn ? "Mute" : "Unmute"}>
              {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5 text-rose-400" />}
            </button>
            {kind === "video" && (
              <button onClick={toggleCam} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10" aria-label="Toggle camera">
                {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5 text-rose-400" />}
              </button>
            )}
            <button onClick={() => { void hangUp(true); }} className="flex h-12 w-14 items-center justify-center rounded-full bg-rose-500" aria-label="End call">
              <PhoneOff className="h-5 w-5" />
            </button>
          </>
        ) : (
          <button
            onClick={connect}
            disabled={conn === "connecting"}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-emerald-500 px-6 text-sm font-bold text-white disabled:opacity-40"
          >
            {conn === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : kind === "audio" ? <Mic className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            {conn === "connecting" ? "Connecting…" : "Join call"}
          </button>
        )}
      </div>
    </div>
  );
}
