import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  createLocalVideoTrack,
  createLocalAudioTrack,
  type LocalTrack,
  type RemoteTrack,
} from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { battleLiveRoomId } from "@/lib/battle-live";

export type BattleLiveConn = "idle" | "connecting" | "connected" | "error";

type SideStreams = {
  leftVideo: MediaStream | null;
  rightVideo: MediaStream | null;
  leftAudio: MediaStream | null;
  rightAudio: MediaStream | null;
};

type Opts = {
  battleId: string | undefined;
  challengerId?: string | null;
  opponentId?: string | null;
  /** Connect when true. */
  enabled: boolean;
  /** Challenger/opponent publish cam+mic; spectators subscribe only. */
  canPublish: boolean;
};

/**
 * LiveKit room for live debate battles.
 * Maps participant identity → left (challenger) / right (opponent) streams.
 */
export function useBattleLiveRoom({
  battleId,
  challengerId,
  opponentId,
  enabled,
  canPublish,
}: Opts) {
  const { user } = useAuth();
  const roomRef = useRef<Room | null>(null);
  const localTracksRef = useRef<LocalTrack[]>([]);
  const [conn, setConn] = useState<BattleLiveConn>("idle");
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [streams, setStreams] = useState<SideStreams>({
    leftVideo: null,
    rightVideo: null,
    leftAudio: null,
    rightAudio: null,
  });
  const [remoteCount, setRemoteCount] = useState(0);

  const sideForIdentity = useCallback(
    (identity: string): "left" | "right" | null => {
      if (challengerId && identity === challengerId) return "left";
      if (opponentId && identity === opponentId) return "right";
      return null;
    },
    [challengerId, opponentId],
  );

  const rebuildStreams = useCallback(
    (room: Room) => {
      const next: SideStreams = {
        leftVideo: null,
        rightVideo: null,
        leftAudio: null,
        rightAudio: null,
      };

      const applyTrack = (identity: string, track: RemoteTrack | LocalTrack, kind: Track.Kind) => {
        const side = sideForIdentity(identity);
        if (!side) return;
        const media = new MediaStream([track.mediaStreamTrack]);
        if (kind === Track.Kind.Video) {
          if (side === "left") next.leftVideo = media;
          else next.rightVideo = media;
        } else if (kind === Track.Kind.Audio) {
          if (side === "left") next.leftAudio = media;
          else next.rightAudio = media;
        }
      };

      const localId = room.localParticipant.identity;
      room.localParticipant.trackPublications.forEach((pub) => {
        if (!pub.track) return;
        applyTrack(localId, pub.track, pub.kind);
      });

      let remotes = 0;
      room.remoteParticipants.forEach((p) => {
        remotes += 1;
        p.trackPublications.forEach((pub) => {
          if (!pub.track) return;
          applyTrack(p.identity, pub.track, pub.kind);
        });
      });
      setRemoteCount(remotes);
      setStreams(next);
    },
    [sideForIdentity],
  );

  const disconnect = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    for (const t of localTracksRef.current) {
      try {
        t.stop();
        t.detach();
      } catch {
        /* ignore */
      }
    }
    localTracksRef.current = [];
    if (room) {
      try {
        await room.disconnect();
      } catch {
        /* ignore */
      }
    }
    setStreams({ leftVideo: null, rightVideo: null, leftAudio: null, rightAudio: null });
    setRemoteCount(0);
    setConn("idle");
    setMicOn(true);
    setCamOn(true);
  }, []);

  const connect = useCallback(async () => {
    if (!user || !battleId || roomRef.current) return;
    setConn("connecting");
    setError(null);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data, error: fnErr } = await supabase.functions.invoke("livekit-token", {
        body: {
          room: battleLiveRoomId(battleId),
          name: profile?.display_name || user.email?.split("@")[0] || "Guest",
          identity: user.id,
          canPublish,
        },
      });
      if (fnErr) throw fnErr;
      if (!data?.token || !data?.url) throw new Error(data?.error || "Live room unavailable");

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      const refresh = () => rebuildStreams(room);
      room.on(RoomEvent.TrackSubscribed, refresh);
      room.on(RoomEvent.TrackUnsubscribed, refresh);
      room.on(RoomEvent.TrackMuted, refresh);
      room.on(RoomEvent.TrackUnmuted, refresh);
      room.on(RoomEvent.ParticipantConnected, refresh);
      room.on(RoomEvent.ParticipantDisconnected, refresh);
      room.on(RoomEvent.LocalTrackPublished, refresh);
      room.on(RoomEvent.LocalTrackUnpublished, refresh);
      room.on(RoomEvent.Disconnected, () => {
        roomRef.current = null;
        setConn("idle");
      });

      await room.connect(data.url, data.token);

      if (canPublish) {
        const published: LocalTrack[] = [];
        // Video first (facing user) — iOS often fails if audio session is wrong.
        try {
          const video = await createLocalVideoTrack({
            facingMode: "user",
            resolution: { width: 720, height: 1280, frameRate: 24 },
          });
          await room.localParticipant.publishTrack(video);
          published.push(video);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Camera unavailable";
          throw new Error(msg);
        }

        try {
          const audio = await createLocalAudioTrack({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          });
          await room.localParticipant.publishTrack(audio);
          published.push(audio);
        } catch (e: unknown) {
          // Keep video-only if mic session conflicts (common on iOS Safari).
          const msg = e instanceof Error ? e.message : "Microphone unavailable";
          setError(msg.includes("AudioSession") ? "Mic blocked — video still on. Check mute/permissions." : msg);
          setMicOn(false);
        }
        localTracksRef.current = published;
      }

      rebuildStreams(room);
      setConn("connected");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to join live battle";
      setError(msg);
      setConn("error");
      await disconnect();
    }
  }, [battleId, canPublish, disconnect, rebuildStreams, user]);

  useEffect(() => {
    if (!enabled || !user || !battleId) {
      void disconnect();
      return;
    }
    void connect();
    return () => {
      void disconnect();
    };
    // Connect once per enabled window / publish role — avoid reconnect loops from callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, battleId, user?.id, canPublish]);

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room || !canPublish) return;
    const next = !micOn;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicOn(next);
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Mic unavailable";
      setError(msg);
    }
  };

  const toggleCam = async () => {
    const room = roomRef.current;
    if (!room || !canPublish) return;
    const next = !camOn;
    await room.localParticipant.setCameraEnabled(next);
    setCamOn(next);
  };

  return {
    conn,
    error,
    micOn,
    camOn,
    streams,
    remoteCount,
    toggleMic,
    toggleCam,
    disconnect,
    reconnect: connect,
  };
}
