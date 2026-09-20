import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Heart, LogOut, Mic, MicOff, Send, Share2, Users, Video, VideoOff, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  endYajTvLive,
  getYajTvLiveSession,
  listYajTvLiveComments,
  sendYajTvLiveComment,
  type YajTvLiveComment,
  type YajTvLiveSession,
} from "./yajTvLiveStore";
import { usePodcastLiveRoom, type RoomParticipant } from "@/pages/podcast/usePodcastLiveRoom";

const sb = supabase as any;

/** Debounced host leave → end session (avoids a React Strict Mode remount ending a
 *  brand-new live before it really gets going). */
const pendingHostEndTimers = new Map<string, number>();
function cancelPendingHostEnd(sessionId: string) {
  const t = pendingHostEndTimers.get(sessionId);
  if (t) {
    window.clearTimeout(t);
    pendingHostEndTimers.delete(sessionId);
  }
}
function scheduleHostEnd(sessionId: string) {
  cancelPendingHostEnd(sessionId);
  const t = window.setTimeout(() => {
    pendingHostEndTimers.delete(sessionId);
    void endYajTvLive(sessionId).catch(() => {});
  }, 700);
  pendingHostEndTimers.set(sessionId, t);
}

const YajTvLiveRoomPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const displayName = (user?.user_metadata as any)?.display_name || user?.email?.split("@")[0] || "Guest";

  const [session, setSession] = useState<YajTvLiveSession | null | undefined>(undefined);
  const [comments, setComments] = useState<YajTvLiveComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [hearts, setHearts] = useState<{ id: string }[]>([]);
  const [ending, setEnding] = useState(false);
  const nameCache = useRef<Map<string, string>>(new Map());
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const hostEndedRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    void getYajTvLiveSession(sessionId).then((s) => active && setSession(s));
    // Viewers need to notice when the host ends — no session-status realtime channel yet,
    // so a light poll closes that gap without a persistent socket per viewer.
    const poll = window.setInterval(() => {
      void getYajTvLiveSession(sessionId).then((s) => active && setSession(s));
    }, 8000);
    return () => {
      active = false;
      window.clearInterval(poll);
    };
  }, [sessionId]);

  const isHost = !!session && !!user && session.host_user_id === user.id;

  const room = usePodcastLiveRoom({
    roomName: session?.room ?? "",
    displayName,
    hostIdentity: session?.host_user_id,
    enabled: !!session,
    publish: isHost,
    canPublish: isHost,
    maxParticipants: 60,
  });

  const host = room.participants.find((p) => p.isHost);
  const viewerCount = Math.max(room.participants.length - 1, 0);

  const resolveName = useCallback(async (userId: string): Promise<string> => {
    const cached = nameCache.current.get(userId);
    if (cached) return cached;
    const { data } = await sb.from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
    const name = data?.display_name || "Someone";
    nameCache.current.set(userId, name);
    return name;
  }, []);

  useEffect(() => {
    if (!session) return;
    void listYajTvLiveComments(session.id).then(setComments).catch(() => setComments([]));

    const channel = supabase
      .channel(`yajtv-live-comments-${session.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "yajtv_live_comments", filter: `session_id=eq.${session.id}` },
        (payload: { new: YajTvLiveComment }) => setComments((prev) => [...prev.slice(-49), payload.new]),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session?.id]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ block: "end" });
  }, [comments.length]);

  const spawnHeart = () => {
    const id = `${Date.now()}-${Math.random()}`;
    setHearts((prev) => [...prev.slice(-11), { id }]);
    window.setTimeout(() => setHearts((prev) => prev.filter((h) => h.id !== id)), 4600);
  };

  // Ephemeral, unpersisted heart taps — broadcast only, no table, no monetization surface.
  const heartsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`yajtv-live-hearts-${session.id}`)
      .on("broadcast", { event: "heart" }, () => spawnHeart())
      .subscribe();
    heartsChannelRef.current = channel;
    return () => {
      heartsChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [session?.id]);

  const sendHeart = () => {
    spawnHeart();
    void heartsChannelRef.current?.send({ type: "broadcast", event: "heart", payload: {} });
  };

  const sendComment = async () => {
    const text = commentText.trim();
    if (!text || !session || !user?.id) return;
    setCommentText("");
    setSendingComment(true);
    try {
      await sendYajTvLiveComment(session.id, user.id, text);
    } catch (e: any) {
      toast({ title: "Couldn't send that", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setSendingComment(false);
    }
  };

  const endHostSessionNow = useCallback(async () => {
    if (!session || !isHost || hostEndedRef.current) return;
    hostEndedRef.current = true;
    cancelPendingHostEnd(session.id);
    try {
      await endYajTvLive(session.id);
    } catch {
      /* ignore — still leave the room */
    }
    try {
      room.disconnect();
    } catch {
      /* ignore */
    }
  }, [session, isHost, room]);

  // Leaving the room as host must end the session so it doesn't stay stuck "live" on
  // Home; debounced so a Strict Mode dev remount doesn't kill a brand-new broadcast.
  useEffect(() => {
    if (!session?.id || !isHost) return;
    cancelPendingHostEnd(session.id);
    hostEndedRef.current = false;
    return () => {
      scheduleHostEnd(session.id);
    };
  }, [session?.id, isHost]);

  const handleEndLive = async () => {
    if (!session || ending) return;
    setEnding(true);
    await endHostSessionNow();
    navigate("/tv");
  };

  const handleLeave = () => {
    room.disconnect();
    navigate("/tv");
  };

  const handleShare = async () => {
    if (!session) return;
    const url = `${window.location.origin}/#/tv/live/${session.id}`;
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: "Watch this live on YAJ.TV", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied" });
      }
    } catch {
      /* user cancelled share sheet */
    }
  };

  if (session === undefined) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black text-white/60">
        Loading…
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
        <p className="text-lg font-bold">This live has ended</p>
        <button onClick={() => navigate("/tv")} className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black">
          Back to YAJ.TV
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black text-white">
      <div className="absolute inset-0">
        {host ? (
          <ParticipantVideo participant={host} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/40">
            {isHost ? "Starting your camera…" : "Waiting for the host…"}
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80" />

      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-black">
            <span className="h-1.5 w-1.5 rounded-full bg-white" /> LIVE
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold">
            <Users className="h-3 w-3" />
            {viewerCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleShare} aria-label="Share" className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50">
            <Share2 className="h-4 w-4" />
          </button>
          {isHost ? (
            <button
              onClick={handleEndLive}
              disabled={ending}
              className="rounded-full bg-white px-3.5 py-1.5 text-[12px] font-bold text-black disabled:opacity-60"
            >
              End Live
            </button>
          ) : (
            <button onClick={handleLeave} aria-label="Leave" className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {hearts.map((h) => (
        <FloatingHeart key={h.id} />
      ))}

      <div className="absolute inset-x-0 bottom-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mb-2 max-h-40 space-y-1.5 overflow-y-auto">
          {comments.map((c) => (
            <CommentLine key={c.id} comment={c} nameCache={nameCache} resolveName={resolveName} isMe={c.sender_id === user?.id} />
          ))}
          <div ref={commentsEndRef} />
        </div>

        <div className="flex items-center gap-2">
          {isHost && (
            <>
              <button
                onClick={() => void room.setMic(!room.local?.micOn)}
                aria-label="Toggle mic"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10"
              >
                {room.local?.micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-red-400" />}
              </button>
              <button
                onClick={() => void room.setCam(!room.local?.camOn)}
                aria-label="Toggle camera"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10"
              >
                {room.local?.camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4 text-red-400" />}
              </button>
            </>
          )}
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendComment()}
            placeholder={user ? "Say something…" : "Sign in to chat"}
            disabled={!user}
            className="h-10 flex-1 rounded-full border border-white/15 bg-black/40 px-3.5 text-sm placeholder:text-white/40 disabled:opacity-50"
          />
          <button
            onClick={sendComment}
            disabled={sendingComment || !commentText.trim()}
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
          <button
            onClick={sendHeart}
            disabled={!user}
            aria-label="Send heart"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 disabled:opacity-40"
          >
            <Heart className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isHost && (
        <button
          onClick={handleLeave}
          aria-label="Leave"
          className="absolute left-4 top-[calc(3.5rem+env(safe-area-inset-top))] flex h-8 w-8 items-center justify-center rounded-full bg-black/50 md:hidden"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

function CommentLine({
  comment,
  nameCache,
  resolveName,
  isMe,
}: {
  comment: YajTvLiveComment;
  nameCache: { current: Map<string, string> };
  resolveName: (userId: string) => Promise<string>;
  isMe: boolean;
}) {
  const [name, setName] = useState(nameCache.current.get(comment.sender_id) ?? (isMe ? "You" : "…"));

  useEffect(() => {
    if (isMe || nameCache.current.has(comment.sender_id)) return;
    void resolveName(comment.sender_id).then(setName);
  }, [comment.sender_id, isMe, nameCache, resolveName]);

  return (
    <p className="w-fit max-w-full rounded-xl bg-black/40 px-2.5 py-1 text-[12.5px] leading-snug backdrop-blur-sm">
      <span className="font-black">{isMe ? "You" : name}</span> <span className="text-white/90">{comment.text}</span>
    </p>
  );
}

function FloatingHeart() {
  const [offsetX] = useState(() => Math.round((Math.random() - 0.5) * 120));
  return (
    <span
      className="pointer-events-none absolute bottom-24 animate-emoji-float text-4xl"
      style={{ left: `calc(50% + ${offsetX}px)`, marginLeft: "-1rem" }}
    >
      ❤️
    </span>
  );
}

function ParticipantVideo({ participant }: { participant: RoomParticipant }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [needsTap, setNeedsTap] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const tracks = [participant.videoTrack, participant.audioTrack].filter(Boolean) as MediaStreamTrack[];
    el.srcObject = tracks.length ? new MediaStream(tracks) : null;
    if (tracks.length) {
      el.play().then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
    }
  }, [participant.videoTrack, participant.audioTrack]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={participant.isLocal}
        className={`h-full w-full object-cover ${participant.isLocal ? "-scale-x-100" : ""}`}
      />
      {needsTap && !participant.isLocal && (
        <button
          type="button"
          onClick={() => videoRef.current?.play().then(() => setNeedsTap(false)).catch(() => {})}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 text-white"
        >
          <span className="text-3xl">🔊</span>
          <span className="text-[13px] font-bold">Tap for sound</span>
        </button>
      )}
    </>
  );
}

export default YajTvLiveRoomPage;
