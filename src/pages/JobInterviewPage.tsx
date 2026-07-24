import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mic, MicOff, PhoneOff, Video, VideoOff, Loader2 } from "lucide-react";
import { Room, RoomEvent, Track, createLocalTracks } from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatInterviewWhen, getInterviewInvite, interviewJoinState } from "@/lib/job-interview";

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
    room.remoteParticipants.forEach((p) => {
      p.trackPublications.forEach((pub) => {
        const track = pub.track;
        if (!track) return;
        if (pub.kind === Track.Kind.Video && remoteVideoRef.current) {
          track.attach(remoteVideoRef.current);
        }
        if (pub.kind === Track.Kind.Audio && remoteAudioRef.current) {
          track.attach(remoteAudioRef.current);
        }
      });
    });
  };

  const connect = async () => {
    if (!invite || !user) return;
    if (joinState === "expired") return toast.error("Join deadline has passed");
    if (joinState === "pending_accept") return toast.error("Applicant must accept first");
    if (joinState === "too_early") return toast.error("Interview channel opens 15 minutes before the scheduled time");

    setConn("connecting");
    setError(null);
    try {
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

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video && remoteVideoRef.current) track.attach(remoteVideoRef.current);
        if (track.kind === Track.Kind.Audio && remoteAudioRef.current) track.attach(remoteAudioRef.current);
      });
      room.on(RoomEvent.ParticipantConnected, () => attachRemote(room));
      room.on(RoomEvent.Disconnected, () => setConn("idle"));

      await room.connect(data.url, data.token);
      const videoWanted = invite.call_kind === "video";
      setCamOn(videoWanted);
      const tracks = await createLocalTracks({ audio: true, video: videoWanted });
      for (const t of tracks) {
        await room.localParticipant.publishTrack(t);
        if (t.kind === "video" && localVideoRef.current) t.attach(localVideoRef.current);
      }
      attachRemote(room);
      setConn("connected");
    } catch (e: any) {
      setConn("error");
      setError(e.message || "Failed to join interview");
      toast.error(e.message || "Failed to join interview");
    }
  };

  const hangUp = async () => {
    const room = roomRef.current;
    roomRef.current = null;
    await room?.disconnect();
    setConn("idle");
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
      roomRef.current?.disconnect();
      roomRef.current = null;
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
        <button onClick={() => { hangUp(); nav(-1); }} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
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
            {joinState === "too_early" && <p className="text-amber-400">Channel opens 15 minutes before start.</p>}
            {joinState === "expired" && <p className="text-rose-400">Join deadline has passed.</p>}
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
              {conn !== "connected" && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
                  {conn === "connecting" ? "Connecting…" : "Waiting to join…"}
                </div>
              )}
            </>
          ) : (
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-white/10 mx-auto flex items-center justify-center">
                <Mic className="w-7 h-7" />
              </div>
              <p className="text-sm font-semibold">{conn === "connected" ? "Audio interview connected" : "Audio interview"}</p>
              <p className="text-[11px] text-zinc-400">{conn === "connecting" ? "Connecting…" : "Mic only — no camera"}</p>
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
            <button onClick={hangUp} className="w-14 h-12 rounded-full bg-rose-500 flex items-center justify-center">
              <PhoneOff className="w-5 h-5" />
            </button>
          </>
        ) : (
          <button
            onClick={connect}
            disabled={conn === "connecting" || joinState === "expired" || joinState === "pending_accept" || joinState === "too_early" || joinState === "missing"}
            className="h-12 px-6 rounded-full bg-emerald-500 text-white font-bold text-sm disabled:opacity-40 inline-flex items-center gap-2"
          >
            {conn === "connecting" ? <Loader2 className="w-4 h-4 animate-spin" /> : invite?.call_kind === "audio" ? <Mic className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            {conn === "connecting" ? "Joining…" : "Join interview channel"}
          </button>
        )}
      </div>
    </div>
  );
}
