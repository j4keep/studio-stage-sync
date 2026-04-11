import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "../session/SessionContext";
import type { Role } from "../session/SessionContext";
import {
  sendRtcSignal,
  subscribeRtcSignals,
  type RtcSignalPayload,
  type RtcSignalRole,
} from "./realtimeRtcSignaling";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      /* ignore track shutdown errors */
    }
  });
}

function toSignalRole(role: Role): RtcSignalRole | null {
  return role === "artist" || role === "engineer" ? role : null;
}

export type StudioMediaContextValue = {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  /** Engineer's captured display for local preview only */
  localScreenPreview: MediaStream | null;
  mediaError: string | null;
  clearMediaError: () => void;
};

const Ctx = createContext<StudioMediaContextValue | null>(null);

export function StudioMediaProvider({ children }: { children: ReactNode }) {
  const { sessionId, role, talkbackHeld, muted, screenSharing, toggleScreenShare } = useSession();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localScreenPreview, setLocalScreenPreview] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const inboundStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const roleRef = useRef<Role>(role);
  const toggleScreenShareRef = useRef(toggleScreenShare);
  const screenPreviewStreamRef = useRef<MediaStream | null>(null);

  roleRef.current = role;
  toggleScreenShareRef.current = toggleScreenShare;

  const clearMediaError = useCallback(() => setMediaError(null), []);

  const stopLocalMedia = useCallback((updateState = true) => {
    stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;
    cameraVideoTrackRef.current = null;
    if (updateState) {
      setLocalStream(null);
    }
  }, []);

  const stopScreenPreview = useCallback((updateState = true) => {
    stopMediaStream(screenPreviewStreamRef.current);
    screenPreviewStreamRef.current = null;
    if (updateState) {
      setLocalScreenPreview(null);
    }
  }, []);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    const audio = localStream?.getAudioTracks()[0];
    if (!audio) return;
    audio.enabled = talkbackHeld && !muted;
  }, [talkbackHeld, muted, localStream]);

  // Acquire camera/mic ONLY when user has joined a session (sessionId + role set).
  // talkbackHeld/muted are handled separately so they don't restart the camera.
  useEffect(() => {
    if (!sessionId.trim() || !role) {
      // No active session — stop all tracks and release camera
      stopLocalMedia();
      return;
    }

    // Starting a new session — stop previous tracks first
    stopLocalMedia();

    let cancelled = false;
    (async () => {
      try {
        const ms = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        if (cancelled) {
          ms.getTracks().forEach((t) => t.stop());
          return;
        }
        cameraVideoTrackRef.current = ms.getVideoTracks()[0] ?? null;
        localStreamRef.current = ms;
        // Audio starts muted; the talkback effect below will enable it
        const a = ms.getAudioTracks()[0];
        if (a) a.enabled = false;
        setLocalStream(ms);
        setMediaError(null);
      } catch (e) {
        if (!cancelled) {
          setMediaError(e instanceof Error ? e.message : "Could not access camera or microphone");
          stopLocalMedia();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Only re-run when session identity changes, NOT on mute/talkback toggles
  }, [sessionId, role, stopLocalMedia]);

  // Hard cleanup: stop all tracks when provider unmounts (user navigates away)
  useEffect(() => {
    return () => {
      stopLocalMedia(false);
      stopScreenPreview(false);
      if (pcRef.current) {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.close();
        pcRef.current = null;
      }
      inboundStreamRef.current = null;
      pendingIceRef.current = [];
    };
  }, [stopLocalMedia, stopScreenPreview]);

  useEffect(() => {
    if (!sessionId.trim() || !role || !localStream) {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      inboundStreamRef.current = null;
      setRemoteStream(null);
      pendingIceRef.current = [];
      return;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    const inbound = new MediaStream();
    inboundStreamRef.current = inbound;
    setRemoteStream(inbound);
    pendingIceRef.current = [];

    pc.ontrack = (ev) => {
      const track = ev.track;
      if (!inbound.getTracks().some((existing) => existing.id === track.id)) {
        inbound.addTrack(track);
      }
      setRemoteStream(new MediaStream(inbound.getTracks()));
    };

    const flushIce = async () => {
      const pending = pendingIceRef.current.splice(0);
      for (const candidate of pending) {
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          /* ignore stale */
        }
      }
    };

    const sendSignal = (payload: RtcSignalPayload) => {
      sendRtcSignal(sessionId, payload);
    };

    const sendReady = () => {
      const currentRole = toSignalRole(roleRef.current);
      if (!currentRole) return;
      sendSignal({ t: "ready", from: currentRole });
    };

    const sendOrRepeatOffer = async () => {
      if (roleRef.current !== "engineer") return;
      const currentRole = toSignalRole(roleRef.current);
      if (!currentRole) return;

      try {
        const existingOffer = pc.localDescription;
        if (existingOffer?.type === "offer" && existingOffer.sdp) {
          sendSignal({ t: "offer", sdp: existingOffer.sdp, from: currentRole });
          return;
        }

        if (pc.signalingState !== "stable") return;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (offer.sdp) {
          sendSignal({ t: "offer", sdp: offer.sdp, from: currentRole });
        }
      } catch (err) {
        console.warn("W.Studio offer failed", err);
      }
    };

    const handlePayload = async (msg: RtcSignalPayload) => {
      if (msg.from === roleRef.current) return;

      try {
        if (msg.t === "ready") {
          if (roleRef.current === "engineer") {
            await sendOrRepeatOffer();
          }
          return;
        }

        if (msg.t === "offer" && roleRef.current === "artist") {
          if (pc.currentRemoteDescription?.type === "offer" && pc.currentRemoteDescription.sdp === msg.sdp) {
            if (pc.localDescription?.type === "answer" && pc.localDescription.sdp) {
              sendSignal({ t: "answer", sdp: pc.localDescription.sdp, from: "artist" });
            }
            return;
          }

          if (pc.signalingState === "have-local-offer") {
            try {
              await pc.setLocalDescription({ type: "rollback" });
            } catch {
              /* ignore rollback failures */
            }
          }

          await pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });
          await flushIce();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (answer.sdp) {
            sendSignal({ t: "answer", sdp: answer.sdp, from: "artist" });
          }
        } else if (msg.t === "answer" && roleRef.current === "engineer") {
          if (pc.currentRemoteDescription?.type === "answer" && pc.currentRemoteDescription.sdp === msg.sdp) {
            return;
          }
          await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
          await flushIce();
        } else if (msg.t === "ice") {
          if (!pc.remoteDescription) {
            pendingIceRef.current.push(msg.candidate);
          } else {
            try {
              await pc.addIceCandidate(msg.candidate);
            } catch {
              /* ignore */
            }
          }
        }
      } catch (err) {
        console.warn("W.Studio WebRTC signaling", err);
      }
    };

    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }

    const unsubscribeSignals = subscribeRtcSignals(sessionId, (msg) => {
      void handlePayload(msg);
    });

    pc.onicecandidate = (e) => {
      const currentRole = toSignalRole(roleRef.current);
      if (e.candidate && currentRole) {
        sendSignal({
          t: "ice",
          candidate: e.candidate.toJSON(),
          from: currentRole,
        });
      }
    };

    sendReady();
    if (role === "engineer") {
      void sendOrRepeatOffer();
    }

    return () => {
      unsubscribeSignals();
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
      pcRef.current = null;
      inboundStreamRef.current = null;
      pendingIceRef.current = [];
      setRemoteStream(null);
    };
  }, [sessionId, role, localStream]);

  useEffect(() => {
    if (!role) {
      stopScreenPreview();
    }
  }, [role, stopScreenPreview]);

  useEffect(() => {
    if (role !== "engineer") {
      return;
    }

    const pc = pcRef.current;
    const videoSender = pc?.getSenders().find((s) => s.track?.kind === "video");
    const cam = cameraVideoTrackRef.current;

    if (!screenSharing) {
      stopScreenPreview();
      if (videoSender && cam && cam.readyState === "live") {
        void videoSender.replaceTrack(cam);
      }
      return;
    }

    let cancelled = false;
    const run = async () => {
      await new Promise((r) => window.setTimeout(r, 0));
      if (cancelled) return;
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
      try {
        const disp = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        if (cancelled) {
          disp.getTracks().forEach((t) => t.stop());
          return;
        }
        screenPreviewStreamRef.current = disp;
        setLocalScreenPreview(disp);
        const vt = disp.getVideoTracks()[0];
        if (!vt) return;
        vt.onended = () => {
          if (roleRef.current === "engineer") toggleScreenShareRef.current();
        };
        await sender?.replaceTrack(vt);
      } catch {
        toggleScreenShareRef.current();
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [screenSharing, role, stopScreenPreview]);

  const value = useMemo<StudioMediaContextValue>(
    () => ({
      localStream,
      remoteStream,
      localScreenPreview,
      mediaError,
      clearMediaError,
    }),
    [localStream, remoteStream, localScreenPreview, mediaError, clearMediaError],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudioMedia() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStudioMedia requires StudioMediaProvider");
  return v;
}
