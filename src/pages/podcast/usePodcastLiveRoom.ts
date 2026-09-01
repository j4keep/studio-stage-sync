// LiveKit room hook for the W.STUDIO Podcast Room + Circle / public lives.
// - Connects to a LiveKit room using a token from the `livekit-token` edge function.
// - Exposes participants (local + remote), with mic/cam state,
//   audio level (0..1), and connection quality (Excellent/Good/Weak/Poor/Unknown).
// - Returns the local MediaStream (audio+video tracks) so MediaRecorder can record
//   the user's OWN isolated audio+video locally.
// - Multi / motor lives: guests connect with canPublish but publish=false, then call
//   startPublishing() when they join a stage seat.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  ConnectionQuality,
  LocalParticipant,
  LocalVideoTrack,
  RemoteParticipant,
  Participant,
  ConnectionState,
} from "livekit-client";
import { supabase } from "@/integrations/supabase/client";

export type RoomParticipant = {
  id: string; // LiveKit identity
  name: string;
  isLocal: boolean;
  isHost: boolean;
  micOn: boolean;
  camOn: boolean;
  level: number; // 0..1
  quality: "excellent" | "good" | "weak" | "poor" | "unknown";
  // For rendering video tile:
  videoTrack?: MediaStreamTrack;
  audioTrack?: MediaStreamTrack;
};

const DEFAULT_MAX_PARTICIPANTS = 6;
/** Multi / motor lives — host + up to 8 guests on stage (Bigo-style 3×3). */
export const LIVE_MOTOR_MAX_ON_STAGE = 9;

function mapQuality(q: ConnectionQuality | undefined): RoomParticipant["quality"] {
  switch (q) {
    case ConnectionQuality.Excellent:
      return "excellent";
    case ConnectionQuality.Good:
      return "good";
    case ConnectionQuality.Poor:
      return "weak";
    case ConnectionQuality.Lost:
      return "poor";
    default:
      return "unknown";
  }
}

function pickTracks(p: Participant) {
  let video: MediaStreamTrack | undefined;
  let audio: MediaStreamTrack | undefined;
  p.trackPublications.forEach((pub) => {
    const t = pub.track?.mediaStreamTrack;
    if (!t) return;
    if (pub.kind === Track.Kind.Video && pub.source === Track.Source.Camera) video = t;
    if (pub.kind === Track.Kind.Audio && pub.source === Track.Source.Microphone) audio = t;
  });
  return { video, audio };
}

function snapshot(p: Participant, hostIdentity: string): RoomParticipant {
  const { video, audio } = pickTracks(p);
  return {
    id: p.identity,
    name: p.name || p.identity,
    isLocal: p instanceof LocalParticipant,
    isHost: p.identity === hostIdentity,
    micOn: p.isMicrophoneEnabled,
    camOn: p.isCameraEnabled,
    level: p.audioLevel ?? 0,
    quality: mapQuality(p.connectionQuality),
    videoTrack: video,
    audioTrack: audio,
  };
}

/** People currently on the motor stage (host always; guests when cam/mic is live). */
export function stageParticipantsFromRoom(list: RoomParticipant[]): RoomParticipant[] {
  const onStage = list.filter((p) => p.isHost || p.camOn || p.micOn || !!p.videoTrack);
  // Host first, then guests by join order (list order from LiveKit snapshot).
  return [
    ...onStage.filter((p) => p.isHost),
    ...onStage.filter((p) => !p.isHost),
  ].slice(0, LIVE_MOTOR_MAX_ON_STAGE);
}

export function usePodcastLiveRoom(opts: {
  roomName: string;
  displayName: string;
  hostIdentity?: string; // identity considered host (defaults to first joiner = self if not set)
  enabled: boolean;
  /** Defaults to true (existing Podcast behavior: everyone publishes). Pass false for a
   *  view-only participant (e.g. a Circle-live viewer) — skips auto-enabling camera/mic. */
  publish?: boolean;
  /** Token permission to publish. Defaults to `publish`. Multi guests use
   *  `canPublish: true` + `publish: false` so they can join the motor stage later. */
  canPublish?: boolean;
  /** Cap on tracked LiveKit participants (room presence). Defaults to 6. */
  maxParticipants?: number;
}) {
  const { roomName, displayName, enabled, publish = true } = opts;
  const canPublish = opts.canPublish ?? publish;
  const maxParticipants = opts.maxParticipants ?? DEFAULT_MAX_PARTICIPANTS;
  const roomRef = useRef<Room | null>(null);
  const [connState, setConnState] = useState<
    "idle" | "connecting" | "connected" | "error" | "disconnected"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  // A ref, not state: `refresh` is registered once per connection on Room event listeners
  // and a setInterval — both bind to whatever closure existed at that moment and never
  // see a *new* `refresh` if hostIdentity later changed as state (state changes don't
  // retroactively update already-bound listener closures). A ref sidesteps that — every
  // call to `refresh`, however it was bound, reads the live value at call time.
  const hostIdentityRef = useRef<string>(opts.hostIdentity ?? "");
  const maxParticipantsRef = useRef(maxParticipants);

  useEffect(() => {
    if (opts.hostIdentity) hostIdentityRef.current = opts.hostIdentity;
  }, [opts.hostIdentity]);

  useEffect(() => {
    maxParticipantsRef.current = maxParticipants;
  }, [maxParticipants]);

  const refresh = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const list: Participant[] = [
      room.localParticipant,
      ...Array.from(room.remoteParticipants.values()),
    ];
    const h = hostIdentityRef.current || room.localParticipant.identity;
    setParticipants(list.slice(0, maxParticipantsRef.current).map((p) => snapshot(p, h)));

    // Build a fresh local MediaStream from currently-published local tracks.
    const lp = room.localParticipant;
    const tracks: MediaStreamTrack[] = [];
    lp.trackPublications.forEach((pub) => {
      const t = pub.track?.mediaStreamTrack;
      if (t && (pub.source === Track.Source.Camera || pub.source === Track.Source.Microphone)) {
        tracks.push(t);
      }
    });
    setLocalStream((prev) => {
      const next = new MediaStream(tracks);
      // Only update if track set actually changed (cheap id check).
      const prevIds = prev ? prev.getTracks().map((t) => t.id).sort().join(",") : "";
      const nextIds = next.getTracks().map((t) => t.id).sort().join(",");
      return prevIds === nextIds ? prev : next;
    });
  }, []);

  useEffect(() => {
    if (!enabled || !roomName) return;
    let cancelled = false;
    let levelInterval: number | undefined;

    (async () => {
      setConnState("connecting");
      setError(null);
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("livekit-token", {
          body: { room: roomName, name: displayName, canPublish },
        });
        if (fnErr) throw fnErr;
        if (!data?.token || !data?.url) throw new Error("No token returned");
        if (cancelled) return;

        if (!opts.hostIdentity) hostIdentityRef.current = data.identity;

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        room
          .on(RoomEvent.ParticipantConnected, refresh)
          .on(RoomEvent.ParticipantDisconnected, refresh)
          .on(RoomEvent.TrackSubscribed, refresh)
          .on(RoomEvent.TrackUnsubscribed, refresh)
          .on(RoomEvent.TrackPublished, refresh)
          .on(RoomEvent.TrackUnpublished, refresh)
          .on(RoomEvent.TrackMuted, refresh)
          .on(RoomEvent.TrackUnmuted, refresh)
          .on(RoomEvent.LocalTrackPublished, refresh)
          .on(RoomEvent.LocalTrackUnpublished, refresh)
          .on(RoomEvent.ConnectionQualityChanged, refresh)
          .on(RoomEvent.ConnectionStateChanged, (s) => {
            if (s === ConnectionState.Connected) setConnState("connected");
            else if (s === ConnectionState.Disconnected) setConnState("disconnected");
          });

        await room.connect(data.url, data.token);
        if (publish) {
          await room.localParticipant.enableCameraAndMicrophone();
          // Belt-and-suspenders: mic/cam must default to ON the moment you go live —
          // explicit here rather than trusting enableCameraAndMicrophone alone left it.
          await Promise.all([
            room.localParticipant.setMicrophoneEnabled(true),
            room.localParticipant.setCameraEnabled(true),
          ]);
        }
        if (cancelled) {
          room.disconnect();
          return;
        }
        setConnState("connected");
        refresh();

        // Poll audio levels (LiveKit doesn't always emit a per-frame event).
        levelInterval = window.setInterval(refresh, 250);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || String(e));
        setConnState("error");
      }
    })();

    return () => {
      cancelled = true;
      if (levelInterval) window.clearInterval(levelInterval);
      const r = roomRef.current;
      roomRef.current = null;
      r?.disconnect().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, roomName, displayName, publish, canPublish]);

  const setMic = useCallback(
    async (on: boolean) => {
      await roomRef.current?.localParticipant.setMicrophoneEnabled(on);
      refresh();
    },
    [refresh],
  );
  const setCam = useCallback(
    async (on: boolean) => {
      await roomRef.current?.localParticipant.setCameraEnabled(on);
      refresh();
    },
    [refresh],
  );
  const setScreen = useCallback(
    async (on: boolean) => {
      await roomRef.current?.localParticipant.setScreenShareEnabled(on);
      refresh();
    },
    [refresh],
  );

  /** Guest joins the motor stage — turns on cam + mic (token must allow publish). */
  const startPublishing = useCallback(async () => {
    const lp = roomRef.current?.localParticipant;
    if (!lp) throw new Error("Not connected to the live room yet");
    await lp.enableCameraAndMicrophone();
    await Promise.all([lp.setMicrophoneEnabled(true), lp.setCameraEnabled(true)]);
    refresh();
  }, [refresh]);

  /** Leave the motor stage — stay in the room as a viewer. */
  const stopPublishing = useCallback(async () => {
    const lp = roomRef.current?.localParticipant;
    if (!lp) return;
    await Promise.all([lp.setMicrophoneEnabled(false), lp.setCameraEnabled(false)]);
    refresh();
  }, [refresh]);

  /** Swaps the published camera track's underlying pixels without unpublish/republish
   *  (no renegotiation flicker for remote viewers) — used to switch a Circle live host
   *  between their raw camera and a face-filter canvas mid-broadcast. */
  const replaceVideoTrack = useCallback(
    async (track: MediaStreamTrack) => {
      const room = roomRef.current;
      if (!room) throw new Error("Not connected to the live room yet");
      const pub = Array.from(room.localParticipant.videoTrackPublications.values())[0];
      const localTrack = pub?.track as LocalVideoTrack | undefined;
      if (!localTrack) throw new Error("No camera track published yet");
      await localTrack.replaceTrack(track);
      refresh();
    },
    [refresh],
  );

  const local = useMemo(() => participants.find((p) => p.isLocal), [participants]);

  return {
    connState,
    error,
    participants,
    local,
    localStream,
    setMic,
    setCam,
    setScreen,
    startPublishing,
    stopPublishing,
    replaceVideoTrack,
    disconnect: () => roomRef.current?.disconnect(),
  };
}
