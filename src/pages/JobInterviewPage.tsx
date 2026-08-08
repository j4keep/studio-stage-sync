import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mic, MicOff, PhoneOff, Video, VideoOff, Loader2 } from "lucide-react";
import { Room, RoomEvent, Track } from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatInterviewWhen, getInterviewInvite, interviewJoinState } from "@/lib/job-interview";
import { stopAllPageMedia } from "@/lib/stop-page-media";

export default function JobInterviewPage() {
  const { applicationId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [app, setApp] = useState<any>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [isEmployer, setIsEmployer] = useState(false);
  const [conn, setConn] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [remoteVideoOn, setRemoteVideoOn] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!user || !applicationId) return;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase.from("job_applications").select("*").eq("id", applicationId).maybeSingle();
      if (err || !data) {
        setError("Interview not found");
        setLoading(false);
        return;
      }
      const { data: job } = await supabase.from("job_listings").select("id,title,employer_id").eq("id", data.job_id).maybeSingle();
      const employer = !!(job && job.employer_id === user.id);
      const applicant = data.applicant_id === user.id;
      if (!employer && !applicant) {
        setError("You’re not part of this interview");
        setLoading(false);
        return;
      }
      setIsEmployer(employer);
      setApp(data);
      setJobTitle(job?.title || "Interview");
      setLoading(false);
    })();
  }, [user, applicationId]);

  const invite = getInterviewInvite(app);
  const joinState = interviewJoinState({
    invite,
    applicantAccepted: !!app?.applicant_accepted,
    isEmployer,
  });

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
    if (!invite || !user) return;
    if (joinState === "expired") return toast.error("Join deadline has passed");
    if (joinState === "pending_accept") return toast.error("Applicant must accept first");
    if (joinState === "missing") return toast.error("Interview not scheduled");

    setConn("connecting");
    setError(null);
    try {
      // Free the iOS audio session held by feed/radio players before capturing.
      stopAllPageMedia();
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
      const { data, error: fnErr } = await supabase.functions.invoke("livekit-token", {
        body: {
          room: invite.room,
          name: profile?.display_name || user.email?.split("@")[0] || "Guest",
          canPublish: true,
        },
      });
      if (fnErr) throw fnErr;
      if (!data?.token || !data?.url) throw new Error(data?.error || "Could not start interview channel");

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, () => attachRemote(room));
      room.on(RoomEvent.TrackUnsubscribed, () => attachRemote(room));
      room.on(RoomEvent.LocalTrackPublished, () => {
        setMicOn(room.localParticipant.isMicrophoneEnabled);
        setCamOn(room.localParticipant.isCameraEnabled);
      });
      room.on(RoomEvent.LocalTrackUnpublished, () => {
        setMicOn(room.localParticipant.isMicrophoneEnabled);
        setCamOn(room.localParticipant.isCameraEnabled);
      });
      room.on(RoomEvent.ParticipantConnected, () => {
        setRemoteJoined(true);
        attachRemote(room);
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        setRemoteJoined(room.remoteParticipants.size > 0);
        attachRemote(room);
      });
      room.on(RoomEvent.Disconnected, () => {
        setRemoteJoined(false);
        setConn("idle");
      });


      await room.connect(data.url, data.token);
      setRemoteJoined(room.remoteParticipants.size > 0);

      const videoWanted = invite.call_kind === "video";
      // Publish mic and camera separately so a camera failure never kills audio (iOS Safari).
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        setMicOn(true);
      } catch (micErr) {
        setMicOn(false);
        toast.error("Microphone unavailable — check permissions");
        console.warn("mic publish failed", micErr);
      }
      if (videoWanted) {
        try {
          await room.localParticipant.setCameraEnabled(true);
          setCamOn(true);
          const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
          if (pub?.track && localVideoRef.current) pub.track.attach(localVideoRef.current);
        } catch (camErr) {
          setCamOn(false);
          toast.error("Camera unavailable — continuing with audio only");
          console.warn("camera publish failed", camErr);
        }
      } else {
        setCamOn(false);
      }
      attachRemote(room);
      setConn("connected");
    } catch (e: any) {
      setConn("error");
      setError(e.message || "Failed to join interview");
      toast.error(e.message || "Failed to join interview");
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
          } catch {
            /* ignore */
          }
        });
        await room.disconnect();
      }
    } catch {
      /* ignore */
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
      localVideoRef.current.removeAttribute("src");
      localVideoRef.current.load();
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
      remoteVideoRef.current.removeAttribute("src");
      remoteVideoRef.current.load();
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current.pause();
    }
    setConn("idle");
    setMicOn(true);
    setCamOn(true);
    setRemoteJoined(false);
    setRemoteVideoOn(false);
    if (leavePage) {
      nav(isEmployer ? "/employer-dashboard" : "/my-jobs", { replace: true });
    }
  };

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  };

  const toggleCam = async () => {
    const room = roomRef.current;
    if (!room || invite?.call_kind !== "video") return;
    const next = !camOn;
    await room.localParticipant.setCameraEnabled(next);
    setCamOn(next);
  };

  useEffect(() => {
    return () => {
      const room = roomRef.current;
      roomRef.current = null;
      try {
        room?.localParticipant.trackPublications.forEach((pub) => {
          const track = pub.track as { stop?: () => void; detach?: () => void } | null;
          track?.stop?.();
          track?.detach?.();
        });
        room?.disconnect();
      } catch {
        /* ignore */
      }
    };
  }, []);

  if (loading) return <div className="min-h-screen bg-zinc-950 text-white p-6 text-sm">Loading interview…</div>;
  if (error && !app) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-6">
        <button onClick={() => nav(-1)} className="mb-4 text-sm text-zinc-400">← Back</button>
        <p className="text-sm text-rose-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <button onClick={() => { void hangUp(true); }} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold truncate">{jobTitle}</p>
          <p className="text-[11px] text-zinc-400 truncate">
            {invite ? `${invite.call_kind === "video" ? "Video" : "Audio"} · ${formatInterviewWhen(invite.at)}` : "Interview"}
          </p>
        </div>
      </header>

      <div className="flex-1 p-4 flex flex-col gap-3">
        {invite && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-[11px] text-zinc-300 space-y-1">
            <p>Scheduled: <span className="text-white font-semibold">{formatInterviewWhen(invite.at)}</span></p>
            <p>Join by: <span className="text-white font-semibold">{formatInterviewWhen(invite.join_deadline)}</span></p>
            {joinState === "pending_accept" && <p className="text-amber-400">Waiting for applicant to accept the invite.</p>}
            {joinState === "expired" && <p className="text-rose-400">Join deadline has passed.</p>}
            {isEmployer && joinState === "open" && (
              <p className="text-emerald-400">You’re the host — tap Start meeting below to open the channel.</p>
            )}
            {invite.external_url && (
              <a href={invite.external_url} target="_blank" rel="noreferrer" className="text-sky-400 underline block pt-1">
                Open external call link
              </a>
            )}
          </div>
        )}

        <div className={`relative flex-1 min-h-[240px] rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 ${invite?.call_kind === "audio" ? "flex items-center justify-center" : ""}`}>
          {invite?.call_kind === "video" ? (
            <>
              <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
              <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-3 right-3 w-28 h-40 rounded-xl object-cover border border-white/20 bg-black" />
              {(conn !== "connected" || !remoteJoined || !remoteVideoOn) && (
                <div className="absolute inset-0 flex items-center justify-center text-center px-6 text-sm text-zinc-400 bg-zinc-900/80">
                  {conn === "connecting"
                    ? "Connecting…"
                    : conn !== "connected"
                      ? "Tap the button below to join"
                      : !remoteJoined
                        ? "Waiting for the other person to join…"
                        : "Their camera is off"}
                </div>
              )}
            </>
          ) : (
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-white/10 mx-auto flex items-center justify-center">
                <Mic className="w-7 h-7" />
              </div>
              <p className="text-sm font-semibold">{conn === "connected" ? "Audio interview connected" : "Audio interview"}</p>
              <p className="text-[11px] text-zinc-400">
                {conn === "connecting"
                  ? "Connecting…"
                  : conn === "connected"
                    ? remoteJoined ? "Both parties connected" : "Waiting for the other person to join…"
                    : "Mic only — no camera"}
              </p>
            </div>
          )}
          <audio ref={remoteAudioRef} autoPlay />
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>

      <div className="p-4 border-t border-white/10 flex items-center justify-center gap-3">
        {conn === "connected" ? (
          <>
            <button onClick={toggleMic} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5 text-rose-400" />}
            </button>
            {invite?.call_kind === "video" && (
              <button onClick={toggleCam} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5 text-rose-400" />}
              </button>
            )}
            <button
              onClick={() => { void hangUp(true); }}
              className="w-14 h-12 rounded-full bg-rose-500 flex items-center justify-center"
              aria-label="End call"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </>
        ) : (
          <button
            onClick={connect}
            disabled={conn === "connecting" || joinState === "expired" || joinState === "pending_accept" || joinState === "missing"}
            className="h-12 px-6 rounded-full bg-emerald-500 text-white font-bold text-sm disabled:opacity-40 inline-flex items-center gap-2"
          >
            {conn === "connecting" ? <Loader2 className="w-4 h-4 animate-spin" /> : invite?.call_kind === "audio" ? <Mic className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            {conn === "connecting" ? "Starting…" : isEmployer ? "Start meeting" : "Join meeting"}
          </button>
        )}
      </div>
    </div>
  );
}
