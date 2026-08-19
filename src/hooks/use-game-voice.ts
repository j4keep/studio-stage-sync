import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, createLocalAudioTrack, type LocalAudioTrack, type RemoteTrack } from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
import { gameLiveRoomId } from "@/lib/game-live";

export type VoiceConn = "idle" | "connecting" | "connected" | "error";

type Opts = {
  gameId: string | undefined;
  userId: string | undefined;
  /** Join the room at all. */
  enabled: boolean;
  /** Players publish their mic; spectators listen only. */
  canPublish: boolean;
};

/**
 * Audio-only LiveKit room for a match: the two players talk while they play and
 * spectators of a live game hear the trash talk. No video by design.
 */
export function useGameVoice({ gameId, userId, enabled, canPublish }: Opts) {
  const roomRef = useRef<Room | null>(null);
  const micTrackRef = useRef<LocalAudioTrack | null>(null);
  const elementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [conn, setConn] = useState<VoiceConn>("idle");
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [remoteCount, setRemoteCount] = useState(0);

  const detachAll = useCallback(() => {
    elementsRef.current.forEach((el) => {
      el.pause();
      el.srcObject = null;
      el.remove();
    });
    elementsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!enabled || !gameId || !userId) return;
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const attach = (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return;
      const el = track.attach() as HTMLAudioElement;
      el.autoplay = true;
      (el as any).playsInline = true;
      el.style.display = "none";
      document.body.appendChild(el);
      elementsRef.current.set(track.sid || String(elementsRef.current.size), el);
      void el.play().catch(() => {});
    };

    room
      .on(RoomEvent.TrackSubscribed, (track) => attach(track))
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove());
      })
      .on(RoomEvent.ActiveSpeakersChanged, (list) => {
        setSpeakers(list.map((p) => p.identity));
      })
      .on(RoomEvent.ParticipantConnected, () => setRemoteCount(room.remoteParticipants.size))
      .on(RoomEvent.ParticipantDisconnected, () => setRemoteCount(room.remoteParticipants.size))
      .on(RoomEvent.Disconnected, () => setConn("idle"));

    void (async () => {
      try {
        setConn("connecting");
        setError(null);
        const { data, error: fnError } = await supabase.functions.invoke("livekit-token", {
          body: { room: gameLiveRoomId(gameId), identity: userId, canPublish },
        });
        if (fnError) throw fnError;
        if (!data?.token || !data?.url) throw new Error("Voice chat is not configured yet.");
        if (cancelled) return;
        await room.connect(data.url, data.token);
        if (cancelled) {
          await room.disconnect();
          return;
        }
        if (canPublish) {
          const mic = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true });
          micTrackRef.current = mic;
          await room.localParticipant.publishTrack(mic);
          setMicOn(true);
        }
        setConn("connected");
        setRemoteCount(room.remoteParticipants.size);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Could not join voice chat");
        setConn("error");
      }
    })();

    return () => {
      cancelled = true;
      const mic = micTrackRef.current;
      micTrackRef.current = null;
      if (mic) {
        try {
          void room.localParticipant.unpublishTrack(mic);
        } catch {
          /* already gone */
        }
        mic.stop();
      }
      detachAll();
      void room.disconnect();
      roomRef.current = null;
      setConn("idle");
      setSpeakers([]);
    };
  }, [enabled, gameId, userId, canPublish, detachAll]);

  const toggleMic = useCallback(async () => {
    const mic = micTrackRef.current;
    if (!mic) return;
    const next = !micOn;
    if (next) await mic.unmute();
    else await mic.mute();
    setMicOn(next);
  }, [micOn]);

  return { conn, error, micOn, toggleMic, speakers, remoteCount, canTalk: canPublish };
}
