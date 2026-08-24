import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Mic, MicOff, Users, Video, VideoOff, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Circle, CircleMember, getCircle, getMyMembership } from "@/lib/circles";
import { CircleLiveSession, endCircleLive, getActiveLiveSession } from "@/lib/circle-live";
import { usePodcastLiveRoom, type RoomParticipant } from "@/pages/podcast/usePodcastLiveRoom";

/** A Circle's live broadcast room — reuses the same LiveKit connection hook the Podcast
 *  rooms run on (usePodcastLiveRoom), just with the host publishing and everyone else
 *  watching (publish: false), instead of every participant publishing like a podcast. */
export default function CircleLiveRoomPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [circle, setCircle] = useState<Circle | null | undefined>(undefined);
  const [membership, setMembership] = useState<CircleMember | null>(null);
  const [session, setSession] = useState<CircleLiveSession | null | undefined>(undefined);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (!id) return;
    void getCircle(id).then(setCircle).catch(() => setCircle(null));
    if (user?.id) void getMyMembership(id, user.id).then(setMembership).catch(() => setMembership(null));
    void getActiveLiveSession(id).then(setSession).catch(() => setSession(null));
  }, [id, user?.id]);

  const isOwner = !!circle && user?.id === circle.owner_id;
  const isApprovedMember = isOwner || membership?.status === "approved";
  const isHost = !!session && session.host_user_id === user?.id;
  const displayName = (user?.user_metadata as any)?.display_name || user?.email?.split("@")[0] || "Guest";

  const room = usePodcastLiveRoom({
    roomName: session?.room ?? "",
    displayName,
    hostIdentity: session?.host_user_id,
    enabled: !!session && isApprovedMember,
    publish: isHost,
  });

  const handleLeave = () => {
    room.disconnect();
    navigate(`/circle/c/${id}`, { replace: true });
  };

  const handleEndLive = async () => {
    if (!session) return;
    setEnding(true);
    try {
      await endCircleLive(session.id);
      room.disconnect();
      navigate(`/circle/c/${id}`, { replace: true });
    } catch (e: any) {
      toast({ title: "Couldn't end the live", description: e.message, variant: "destructive" });
      setEnding(false);
    }
  };

  if (circle === undefined || session === undefined) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-black text-white/70">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!circle || !isApprovedMember) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
        <p className="font-bold">You don't have access to this live.</p>
        <button type="button" onClick={() => navigate(`/circle/c/${id}`)} className="rounded-full bg-white px-4 py-2 text-sm font-black text-black">
          Back to Circle
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
        <p className="font-bold">This live has ended.</p>
        <button type="button" onClick={() => navigate(`/circle/c/${id}`)} className="rounded-full bg-white px-4 py-2 text-sm font-black text-black">
          Back to Circle
        </button>
      </div>
    );
  }

  const host = room.participants.find((p) => p.isHost);
  const viewerCount = Math.max(room.participants.length - 1, 0);

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-black text-white">
      <div className="relative flex-1 overflow-hidden">
        {isHost ? (
          host && <ParticipantVideo participant={host} mirrored />
        ) : host?.videoTrack && host.camOn ? (
          <ParticipantVideo participant={host} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/60">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-[13px] font-semibold">
              {room.connState === "connecting" ? "Connecting…" : "Waiting for the host's video…"}
            </p>
          </div>
        )}

        <div className="absolute left-3 top-[max(env(safe-area-inset-top),0.75rem)] flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
          </span>
          <span className="flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm">
            <Users className="h-3 w-3" /> {viewerCount}
          </span>
        </div>

        <button
          type="button"
          onClick={handleLeave}
          aria-label="Leave"
          className="absolute right-3 top-[max(env(safe-area-inset-top),0.75rem)] rounded-full bg-black/50 p-2 backdrop-blur-sm"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-white/10 bg-black/90 px-4 py-4" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}>
        {isHost ? (
          <>
            <button
              type="button"
              onClick={() => room.setMic(!room.local?.micOn)}
              className={`flex h-11 w-11 items-center justify-center rounded-full ${room.local?.micOn ? "bg-white/15" : "bg-white text-black"}`}
              aria-label="Toggle microphone"
            >
              {room.local?.micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => room.setCam(!room.local?.camOn)}
              className={`flex h-11 w-11 items-center justify-center rounded-full ${room.local?.camOn ? "bg-white/15" : "bg-white text-black"}`}
              aria-label="Toggle camera"
            >
              {room.local?.camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>
            <button
              type="button"
              disabled={ending}
              onClick={handleEndLive}
              className="rounded-full bg-red-600 px-5 py-3 text-[13px] font-black disabled:opacity-60"
            >
              {ending ? "Ending…" : "End Live"}
            </button>
          </>
        ) : (
          <button type="button" onClick={handleLeave} className="rounded-full bg-white/15 px-6 py-3 text-[13px] font-bold">
            Leave
          </button>
        )}
      </div>
    </div>
  );
}

function ParticipantVideo({ participant, mirrored }: { participant: RoomParticipant; mirrored?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = participant.videoTrack ? new MediaStream([participant.videoTrack]) : null;
  }, [participant.videoTrack]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = !participant.isLocal && participant.audioTrack ? new MediaStream([participant.audioTrack]) : null;
  }, [participant.audioTrack, participant.isLocal]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={participant.isLocal}
        className={`h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""}`}
      />
      <audio ref={audioRef} autoPlay playsInline />
    </>
  );
}
