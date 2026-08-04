import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  LocalVideoTrack,
  createLocalVideoTrack,
  createLocalAudioTrack,
  type LocalTrack,
  type RemoteTrack,
  type TrackPublication,
} from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { battleLiveRoomId } from "@/lib/battle-live";
import {
  forceIosAudioSessionToPlayback,
  setIosAudioSessionForRecording,
} from "@/lib/feed-video-playback";
import {
  canBrowserScreenShare,
  screenShareUnsupportedReason,
} from "@/lib/screen-share-support";

export type BattleLiveConn = "idle" | "connecting" | "connected" | "error";

/** off = not sharing · privacy = local preview only / paused · live = crowd can see */
export type ScreenSharePhase = "off" | "privacy" | "live";

type SideStreams = {
  leftCamera: MediaStream | null;
  rightCamera: MediaStream | null;
  leftScreen: MediaStream | null;
  rightScreen: MediaStream | null;
  /** @deprecated use leftCamera — kept for recorder/call sites that want “main” cam */
  leftVideo: MediaStream | null;
  rightVideo: MediaStream | null;
  leftAudio: MediaStream | null;
  rightAudio: MediaStream | null;
};

type SideAudioTracks = {
  left: RemoteTrack | LocalTrack | null;
  right: RemoteTrack | LocalTrack | null;
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

const emptyStreams = (): SideStreams => ({
  leftCamera: null,
  rightCamera: null,
  leftScreen: null,
  rightScreen: null,
  leftVideo: null,
  rightVideo: null,
  leftAudio: null,
  rightAudio: null,
});

/**
 * LiveKit room for live debate battles.
 * Maps participant identity → left (challenger) / right (opponent) streams.
 * Screen share starts in privacy (paused) until the competitor unpauses for the crowd.
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
  const screenTrackRef = useRef<LocalTrack | null>(null);
  const screenPublishedRef = useRef(false);
  const [conn, setConn] = useState<BattleLiveConn>("idle");
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharePhase, setScreenSharePhase] = useState<ScreenSharePhase>("off");
  const [localScreenPreview, setLocalScreenPreview] = useState<MediaStream | null>(null);
  const [streams, setStreams] = useState<SideStreams>(emptyStreams);
  const [audioTracks, setAudioTracks] = useState<SideAudioTracks>({
    left: null,
    right: null,
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
      const next = emptyStreams();
      const nextAudio: SideAudioTracks = { left: null, right: null };
      const localId = room.localParticipant.identity;

      const applyPub = (identity: string, pub: TrackPublication) => {
        const track = pub.track as RemoteTrack | LocalTrack | null | undefined;
        if (!track) return;
        if ("isSubscribed" in pub && pub.isSubscribed === false) return;
        const side = sideForIdentity(identity);
        if (!side) return;

        const media = new MediaStream([track.mediaStreamTrack]);
        if (pub.kind === Track.Kind.Video) {
          if (pub.source === Track.Source.ScreenShare) {
            // Crowd must not see paused/muted screens — local preview uses localScreenPreview.
            if (pub.isMuted && identity !== localId) return;
            if (side === "left") next.leftScreen = media;
            else next.rightScreen = media;
          } else {
            // Camera (or unknown video) — never overwrite with screen.
            if (pub.source && pub.source !== Track.Source.Camera) return;
            if (side === "left") {
              next.leftCamera = media;
              next.leftVideo = media;
            } else {
              next.rightCamera = media;
              next.rightVideo = media;
            }
          }
        } else if (pub.kind === Track.Kind.Audio) {
          if (pub.source === Track.Source.ScreenShareAudio) return;
          if (side === "left") {
            next.leftAudio = media;
            nextAudio.left = track;
          } else {
            next.rightAudio = media;
            nextAudio.right = track;
          }
        }
      };

      room.localParticipant.trackPublications.forEach((pub) => applyPub(localId, pub));

      let remotes = 0;
      room.remoteParticipants.forEach((p) => {
        remotes += 1;
        p.trackPublications.forEach((pub) => applyPub(p.identity, pub));
      });
      setRemoteCount(remotes);
      setStreams(next);
      setAudioTracks(nextAudio);
      setMicOn(room.localParticipant.isMicrophoneEnabled);
      setCamOn(room.localParticipant.isCameraEnabled);
    },
    [sideForIdentity],
  );

  const clearScreenShareLocal = useCallback(() => {
    const t = screenTrackRef.current;
    screenTrackRef.current = null;
    screenPublishedRef.current = false;
    if (t) {
      try {
        t.stop();
        t.detach();
      } catch {
        /* ignore */
      }
    }
    setLocalScreenPreview(null);
    setScreenSharePhase("off");
  }, []);

  const stopScreenShare = useCallback(async () => {
    const room = roomRef.current;
    const track = screenTrackRef.current;
    if (room && track && screenPublishedRef.current) {
      try {
        await room.localParticipant.unpublishTrack(track, true);
      } catch {
        try {
          await room.localParticipant.setScreenShareEnabled(false);
        } catch {
          /* ignore */
        }
      }
    }
    clearScreenShareLocal();
    if (room) rebuildStreams(room);
  }, [clearScreenShareLocal, rebuildStreams]);

  const disconnect = useCallback(async () => {
    const room = roomRef.current;
    // Unpublish/stop screen while room ref is still valid.
    await stopScreenShare().catch(() => undefined);
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
    // Detach every LiveKit media element so debate audio cannot keep playing
    // after leaving the post viewer.
    try {
      room?.remoteParticipants.forEach((p) => {
        p.trackPublications.forEach((pub) => {
          try {
            pub.track?.detach()?.forEach((el) => {
              try {
                el.pause();
                el.remove();
              } catch {
                /* ignore */
              }
            });
          } catch {
            /* ignore */
          }
        });
      });
    } catch {
      /* ignore */
    }
    if (room) {
      try {
        await room.disconnect();
      } catch {
        /* ignore */
      }
    }
    setStreams(emptyStreams());
    setAudioTracks({ left: null, right: null });
    setRemoteCount(0);
    setConn("idle");
    setMicOn(true);
    setCamOn(true);
  }, [stopScreenShare]);

  const startAudio = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    if (!canPublish) forceIosAudioSessionToPlayback();
    try {
      await room.startAudio();
    } catch {
      /* browser may still require a direct element.play() */
    }
  }, [canPublish]);

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
      const ensureSubscribed = () => {
        room.remoteParticipants.forEach((p) => {
          p.trackPublications.forEach((pub) => {
            if (!pub.isSubscribed) {
              try {
                void pub.setSubscribed(true);
              } catch {
                /* ignore */
              }
            }
          });
        });
        refresh();
      };
      room.on(RoomEvent.TrackSubscribed, refresh);
      room.on(RoomEvent.TrackUnsubscribed, refresh);
      room.on(RoomEvent.TrackUnpublished, refresh);
      room.on(RoomEvent.TrackMuted, refresh);
      room.on(RoomEvent.TrackUnmuted, refresh);
      room.on(RoomEvent.TrackPublished, ensureSubscribed);
      room.on(RoomEvent.ParticipantConnected, ensureSubscribed);
      room.on(RoomEvent.ParticipantDisconnected, refresh);
      room.on(RoomEvent.LocalTrackPublished, refresh);
      room.on(RoomEvent.LocalTrackUnpublished, refresh);
      room.on(RoomEvent.Disconnected, () => {
        roomRef.current = null;
        setConn("idle");
      });

      await room.connect(data.url, data.token);
      ensureSubscribed();

      if (canPublish) {
        setIosAudioSessionForRecording();
        const published: LocalTrack[] = [];
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
          const msg = e instanceof Error ? e.message : "Microphone unavailable";
          setError(
            msg.includes("AudioSession")
              ? "Mic blocked — video still on. Check mute/permissions."
              : msg,
          );
          setMicOn(false);
        }
        localTracksRef.current = published;
      } else {
        forceIosAudioSessionToPlayback();
        try {
          await room.startAudio();
        } catch {
          /* tap-to-unmute fallback in UI */
        }
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

  /**
   * Pick a screen/window/tab. Stays in privacy mode — crowd cannot see until showScreenShare().
   * Important: getDisplayMedia must be the first await (user-gesture), or the picker never opens.
   */
  const startScreenSharePrivacy = useCallback(async () => {
    if (!canPublish) {
      const msg = "Only battle competitors can share their screen";
      setError(msg);
      throw new Error(msg);
    }
    if (!roomRef.current) {
      const msg =
        conn === "connecting"
          ? "Still connecting to the live room — wait a second and try again"
          : "Live room isn’t connected yet — wait for Live, then try Share screen again";
      setError(msg);
      throw new Error(msg);
    }
    if (!canBrowserScreenShare()) {
      const msg = screenShareUnsupportedReason();
      setError(msg);
      throw new Error(msg);
    }

    // FIRST await — do not stop previous tracks / await anything before this.
    let displayStream: MediaStream;
    try {
      // Keep constraints simple so the browser picker always opens.
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
    } catch (e: unknown) {
      const name = e instanceof DOMException ? e.name : "";
      const msg = e instanceof Error ? e.message : "Screen share cancelled";
      const cancelled =
        name === "NotAllowedError" || /cancel|denied|permission|notallowed/i.test(msg);
      if (!cancelled) setError(msg);
      throw cancelled ? new Error("Screen share cancelled") : e;
    }

    const mediaTrack = displayStream.getVideoTracks()[0];
    if (!mediaTrack) {
      displayStream.getTracks().forEach((t) => t.stop());
      const msg = "No screen video track returned";
      setError(msg);
      throw new Error(msg);
    }

    try {
      // Clear any previous share only AFTER the picker succeeded.
      if (screenTrackRef.current) {
        await stopScreenShare();
      }

      const video = new LocalVideoTrack(mediaTrack, undefined, true);
      video.source = Track.Source.ScreenShare;
      try {
        mediaTrack.contentHint = "detail";
      } catch {
        /* older browsers */
      }

      mediaTrack.addEventListener("ended", () => {
        void stopScreenShare();
      });

      screenTrackRef.current = video;
      screenPublishedRef.current = false;
      setLocalScreenPreview(new MediaStream([mediaTrack]));
      setScreenSharePhase("privacy");
      setError(null);
    } catch (e: unknown) {
      mediaTrack.stop();
      displayStream.getTracks().forEach((t) => t.stop());
      clearScreenShareLocal();
      const msg = e instanceof Error ? e.message : "Couldn’t start screen share";
      setError(msg);
      throw e;
    }
  }, [canPublish, clearScreenShareLocal, conn, stopScreenShare]);

  /** Unpause — publish so the crowd can see the screen. */
  const showScreenShare = useCallback(async () => {
    const room = roomRef.current;
    const track = screenTrackRef.current;
    if (!room || !track || !canPublish) return;
    try {
      if (!screenPublishedRef.current) {
        await room.localParticipant.publishTrack(track, {
          source: Track.Source.ScreenShare,
          videoEncoding: { maxBitrate: 1_500_000, maxFramerate: 15 },
          degradationPreference: "maintain-resolution",
        });
        screenPublishedRef.current = true;
      }
      setScreenSharePhase("live");
      setLocalScreenPreview(new MediaStream([track.mediaStreamTrack]));
      rebuildStreams(room);
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Couldn’t show screen";
      setError(msg);
      throw e;
    }
  }, [canPublish, rebuildStreams]);

  /** Pause broadcast — unpublish so the crowd sees nothing; keep local privacy preview. */
  const pauseScreenShare = useCallback(async () => {
    const room = roomRef.current;
    const track = screenTrackRef.current;
    if (!track) return;
    if (room && screenPublishedRef.current) {
      try {
        await room.localParticipant.unpublishTrack(track, false);
      } catch {
        /* ignore */
      }
      screenPublishedRef.current = false;
    }
    setLocalScreenPreview(new MediaStream([track.mediaStreamTrack]));
    setScreenSharePhase("privacy");
    if (room) rebuildStreams(room);
  }, [rebuildStreams]);

  return {
    conn,
    error,
    micOn,
    camOn,
    screenSharePhase,
    localScreenPreview,
    streams,
    audioTracks,
    remoteCount,
    startAudio,
    toggleMic,
    toggleCam,
    startScreenSharePrivacy,
    showScreenShare,
    pauseScreenShare,
    stopScreenShare,
    disconnect,
    reconnect: connect,
  };
}
