import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Hand, Loader2, LogOut, Mic, MicOff, Users, Video, VideoOff, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import MeetAdultGate, { MeetBrandMark } from "@/components/meet/MeetAdultGate";
import LiveMotorGrid from "@/components/live/LiveMotorGrid";
import { useLiveStageDoor } from "@/hooks/useLiveStageDoor";
import {
  LIVE_MOTOR_MAX_ON_STAGE,
  stageParticipantsFromRoom,
  usePodcastLiveRoom,
} from "@/pages/podcast/usePodcastLiveRoom";
import { getMeetProfile } from "@/lib/meet";

/**
 * Meet interview motor stage — same multi-seat grid + host kick as live Multi.
 * Host = Meet profile owner (`/meet/stage/:hostUserId`). Guests Ask → host Accepts.
 * Dating flow polish comes later; this plants the kick / stage controls now.
 */
function MeetInterviewStageInner() {
  const { hostUserId } = useParams<{ hostUserId: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const [hostName, setHostName] = useState("Host");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const isHost = !!user?.id && user.id === hostUserId;
  const displayName =
    (user?.user_metadata as any)?.display_name || user?.email?.split("@")[0] || "Guest";
  const roomName = hostUserId ? `meet_stage_${hostUserId.replace(/[^a-zA-Z0-9_-]/g, "")}` : "";

  useEffect(() => {
    if (!hostUserId) return;
    void getMeetProfile(hostUserId).then((p) => {
      if (p?.display_name) setHostName(p.display_name);
    });
  }, [hostUserId]);

  const room = usePodcastLiveRoom({
    roomName,
    displayName,
    hostIdentity: hostUserId,
    enabled: !!user?.id && !!hostUserId,
    publish: isHost,
    canPublish: true,
    maxParticipants: 40,
  });

  const stageDoor = useLiveStageDoor({
    sessionId: hostUserId ? `meet-${hostUserId}` : null,
    enabled: !!user?.id && !!hostUserId,
    isHost,
    userId: user?.id,
    displayName,
  });

  const stagePeople = useMemo(
    () => stageParticipantsFromRoom(room.participants),
    [room.participants],
  );
  const onStage =
    !!room.local && (room.local.isHost || room.local.camOn || room.local.micOn || !!room.local.videoTrack);
  const seatsLeft = Math.max(0, LIVE_MOTOR_MAX_ON_STAGE - stagePeople.length);

  const goOnStage = useCallback(async () => {
    if (isHost || joining) return;
    setJoining(true);
    try {
      await room.startPublishing();
      toast({ title: "You're on the interview stage" });
    } catch (e: any) {
      toast({ title: "Couldn't join", description: e?.message, variant: "destructive" });
      stageDoor.resetToIdle();
    } finally {
      setJoining(false);
    }
  }, [isHost, joining, room, stageDoor]);

  useEffect(() => {
    if (isHost) return;
    if (stageDoor.status !== "accepted") return;
    if (onStage || joining) return;
    void goOnStage();
  }, [stageDoor.status, isHost, onStage, joining, goOnStage]);

  useEffect(() => {
    if (stageDoor.status === "declined" && stageDoor.declineReason) {
      toast({ title: "Request declined", description: stageDoor.declineReason, variant: "destructive" });
    }
    if (stageDoor.status === "full") {
      toast({
        title: "Stage is full",
        description: stageDoor.declineReason || "No space available.",
        variant: "destructive",
      });
    }
    if (stageDoor.status === "kicked") {
      toast({
        title: "Removed from interview",
        description: stageDoor.declineReason || "The host removed you from the stage.",
        variant: "destructive",
      });
      void (async () => {
        try {
          await room.stopPublishing();
        } catch {
          /* ignore */
        }
        setFocusedId(null);
        stageDoor.resetToIdle();
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageDoor.status, stageDoor.declineReason]);

  const handleRequestJoin = () => {
    if (isHost || onStage) return;
    if (seatsLeft <= 0) {
      toast({
        title: "Stage is full",
        description: `No space available — up to ${LIVE_MOTOR_MAX_ON_STAGE} people.`,
      });
      return;
    }
    if (stageDoor.status === "requesting") {
      stageDoor.cancelRequest();
      return;
    }
    stageDoor.requestJoin();
    toast({ title: "Request sent", description: "Waiting for the host…" });
  };

  const handleKick = (participantId: string) => {
    if (!isHost) return;
    stageDoor.kick(participantId);
    if (focusedId === participantId) setFocusedId(null);
    toast({ title: "Removed", description: "Seat is open again." });
  };

  const handleLeaveStage = async () => {
    if (isHost) return;
    try {
      await room.stopPublishing();
      setFocusedId(null);
      stageDoor.resetToIdle();
      toast({ title: "Left the stage" });
    } catch (e: any) {
      toast({ title: "Couldn't leave", description: e?.message, variant: "destructive" });
    }
  };

  if (!hostUserId) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-sm text-muted-foreground">
        Missing interview host.
      </div>
    );
  }

  if (!user?.id) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-bold">Sign in to join the interview stage</p>
        <button
          type="button"
          onClick={() => nav("/auth")}
          className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black text-white">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {stagePeople.length > 0 || seatsLeft > 0 ? (
          <LiveMotorGrid
            participants={stagePeople}
            focusedId={focusedId}
            onFocusChange={setFocusedId}
            emptySeatCount={seatsLeft > 0 ? 1 : 0}
            emptySeatLabel={isHost ? "Invite" : seatsLeft <= 0 ? "Full" : "Ask to join"}
            showHostKick={isHost}
            onKick={handleKick}
            onEmptySeatTap={
              isHost
                ? () =>
                    toast({
                      title: "Share your Meet profile",
                      description: "People can Ask to join your interview stage from here.",
                    })
                : onStage
                  ? undefined
                  : seatsLeft <= 0
                    ? () =>
                        toast({
                          title: "Stage is full",
                          description: "No space available to join right now.",
                        })
                    : handleRequestJoin
            }
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/60">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-[13px] font-semibold">
              {room.connState === "connecting" ? "Connecting…" : "Waiting for the stage…"}
            </p>
          </div>
        )}

        <div className="absolute left-3 top-[max(env(safe-area-inset-top),0.75rem)] z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              room.disconnect();
              nav("/meet");
            }}
            className="rounded-full bg-black/50 p-2 backdrop-blur-sm"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="rounded-2xl bg-black/50 px-3 py-1.5 backdrop-blur-sm">
            <MeetBrandMark className="text-rose-300 [&_span]:text-rose-200" />
            <p className="text-[12px] font-bold">{hostName}'s interview</p>
          </div>
          <span className="rounded-full bg-fuchsia-600/90 px-2.5 py-1 text-[11px] font-black uppercase">
            Stage · {stagePeople.length}/{LIVE_MOTOR_MAX_ON_STAGE}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm">
            <Users className="h-3 w-3" /> {Math.max(room.participants.length - 1, 0)}
          </span>
        </div>

        {isHost && (
          <div className="absolute left-3 top-[calc(max(env(safe-area-inset-top),0.75rem)+3.5rem)] z-20 flex gap-2 rounded-2xl bg-black/70 p-2 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => room.setMic(!room.local?.micOn)}
              className={`flex h-10 w-10 items-center justify-center rounded-full ${room.local?.micOn ? "bg-white/15" : "bg-white text-black"}`}
              aria-label="Toggle mic"
            >
              {room.local?.micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => room.setCam(!room.local?.camOn)}
              className={`flex h-10 w-10 items-center justify-center rounded-full ${room.local?.camOn ? "bg-white/15" : "bg-white text-black"}`}
              aria-label="Toggle camera"
            >
              {room.local?.camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </button>
          </div>
        )}

        {isHost && stageDoor.pending.length > 0 && (
          <div className="absolute right-3 top-[calc(max(env(safe-area-inset-top),0.75rem)+3rem)] z-30 flex w-[min(100%-1.5rem,18rem)] flex-col gap-2">
            {stageDoor.pending.map((req) => (
              <div
                key={req.reqId}
                className="rounded-2xl border border-white/15 bg-black/75 p-3 shadow-lg backdrop-blur-md"
              >
                <p className="text-[12px] font-bold">
                  <span className="text-teal-300">{req.name}</span> wants to join
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (seatsLeft <= 0) {
                        stageDoor.notifyFull(req.reqId);
                        toast({ title: "Stage is full" });
                        return;
                      }
                      stageDoor.accept(req.reqId);
                    }}
                    disabled={seatsLeft <= 0}
                    className="flex flex-1 items-center justify-center gap-1 rounded-full bg-teal-500 py-1.5 text-[11px] font-black disabled:opacity-40"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {seatsLeft <= 0 ? "Full" : "Accept"}
                  </button>
                  <button
                    type="button"
                    onClick={() => stageDoor.decline(req.reqId)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-full bg-white/15 py-1.5 text-[11px] font-black"
                  >
                    <X className="h-3.5 w-3.5" /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isHost && onStage && (
          <div className="absolute left-3 top-[calc(max(env(safe-area-inset-top),0.75rem)+3.5rem)] z-20 flex gap-2 rounded-2xl bg-black/70 p-2 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => room.setMic(!room.local?.micOn)}
              className={`flex h-10 w-10 items-center justify-center rounded-full ${room.local?.micOn ? "bg-white/15" : "bg-white text-black"}`}
            >
              {room.local?.micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => room.setCam(!room.local?.camOn)}
              className={`flex h-10 w-10 items-center justify-center rounded-full ${room.local?.camOn ? "bg-white/15" : "bg-white text-black"}`}
            >
              {room.local?.camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>

      <div
        className="flex shrink-0 items-center gap-2 border-t border-white/10 bg-black/90 px-3 py-2"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
      >
        <p className="min-w-0 flex-1 text-[11px] text-white/60">
          {isHost
            ? "Tap X on a guest box to remove them and free a seat."
            : "Ask to join — host can accept, decline, or remove you anytime."}
        </p>
        {!isHost &&
          (onStage ? (
            <button
              type="button"
              onClick={() => void handleLeaveStage()}
              className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-2 text-[12px] font-black"
            >
              <LogOut className="h-3.5 w-3.5" /> Leave
            </button>
          ) : seatsLeft <= 0 ? (
            <span className="rounded-full bg-white/10 px-3 py-2 text-[12px] font-black text-white/60">Full</span>
          ) : (
            <button
              type="button"
              disabled={joining || stageDoor.status === "accepted"}
              onClick={handleRequestJoin}
              className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-[12px] font-black disabled:opacity-40 ${
                stageDoor.status === "requesting" ? "bg-white/20" : "bg-teal-500"
              }`}
            >
              {joining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Hand className="h-3.5 w-3.5" />}
              {stageDoor.status === "requesting" ? "Cancel" : "Ask"}
            </button>
          ))}
      </div>
    </div>
  );
}

export default function MeetInterviewStagePage() {
  return (
    <MeetAdultGate>
      <MeetInterviewStageInner />
    </MeetAdultGate>
  );
}
