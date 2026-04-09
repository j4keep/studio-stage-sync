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

type SignalPayload =
  | { t: "offer"; sdp: string; from: "artist" | "engineer" }
  | { t: "answer"; sdp: string; from: "artist" | "engineer" }
  | { t: "ice"; candidate: RTCIceCandidateInit; from: "artist" | "engineer" };

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

function channelName(sessionId: string): string {
  return `wstudio-rtc-${sessionId.trim()}`;
}

function offerKey(sessionId: string): string {
  return `wstudio_rtc_offer_${sessionId.trim()}`;
}

function answerKey(sessionId: string): string {
  return `wstudio_rtc_answer_${sessionId.trim()}`;
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
  const bcRef = useRef<BroadcastChannel | null>(null);
  const cameraVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const inboundStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const roleRef = useRef<Role>(role);
  const toggleScreenShareRef = useRef(toggleScreenShare);
  const screenPreviewStreamRef = useRef<MediaStream | null>(null);

  roleRef.current = role;
  toggleScreenShareRef.current = toggleScreenShare;

  const clearMediaError = useCallback(() => setMediaError(null), []);

  useEffect(() => {
    const audio = localStream?.getAudioTracks()[0];
    if (!audio) return;
    audio.enabled = talkbackHeld && !muted;
  }, [talkbackHeld, muted, localStream]);

  useEffect(() => {
    if (!sessionId.trim() || !role) {
      setLocalStream((prev) => {
        prev?.getTracks().forEach((t) => t.stop());
        return null;
      });
      cameraVideoTrackRef.current = null;
      return;
    }

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
        const a = ms.getAudioTracks()[0];
        if (a) a.enabled = talkbackHeld && !muted;
        setLocalStream(ms);
        setMediaError(null);
      } catch (e) {
        if (!cancelled) {
          setMediaError(e instanceof Error ? e.message : "Could not access camera or microphone");
          setLocalStream(null);
          cameraVideoTrackRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-acquire when session role changes
  }, [sessionId, role]);

  useEffect(() => {
    if (!sessionId.trim() || !role || !localStream) {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      bcRef.current?.close();
      bcRef.current = null;
      inboundStreamRef.current = null;
      setRemoteStream(null);
      pendingIceRef.current = [];
      return;
    }

    if (typeof BroadcastChannel === "undefined") {
      setMediaError("WebRTC signaling requires a browser with BroadcastChannel (open two tabs on this site).");
      return;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    const inbound = new MediaStream();
    inboundStreamRef.current = inbound;
    setRemoteStream(inbound);

    pc.ontrack = (ev) => {
      const t = ev.track;
      if (!inbound.getTracks().some((x) => x.id === t.id)) inbound.addTrack(t);
      setRemoteStream(new MediaStream(inbound.getTracks()));
    };

    const flushIce = async () => {
      const pending = pendingIceRef.current.splice(0);
      for (const c of pending) {
        try {
          await pc.addIceCandidate(c);
        } catch {
          /* ignore stale */
        }
      }
    };

    const persistAndPost = (payload: SignalPayload) => {
      try {
        if (payload.t === "offer") {
          localStorage.setItem(offerKey(sessionId), JSON.stringify(payload));
        } else if (payload.t === "answer") {
          localStorage.setItem(answerKey(sessionId), JSON.stringify(payload));
        }
      } catch {
        /* ignore quota */
      }
      bcRef.current?.postMessage(JSON.stringify(payload));
    };

    for (const t of localStream.getTracks()) {
      pc.addTrack(t, localStream);
    }

    const bc = new BroadcastChannel(channelName(sessionId));
    bcRef.current = bc;

    const handlePayload = async (msg: SignalPayload) => {
      if (msg.from === roleRef.current) return;

      try {
        if (msg.t === "offer" && roleRef.current === "artist") {
          await pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });
          await flushIce();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          persistAndPost({ t: "answer", sdp: answer.sdp!, from: "artist" });
        } else if (msg.t === "answer" && roleRef.current === "engineer") {
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

    const onMessage = async (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data as string) as SignalPayload;
        await handlePayload(msg);
      } catch {
        /* ignore */
      }
    };

    bc.onmessage = onMessage;

    pc.onicecandidate = (e) => {
      if (e.candidate && roleRef.current) {
        persistAndPost({
          t: "ice",
          candidate: e.candidate.toJSON(),
          from: roleRef.current === "engineer" ? "engineer" : "artist",
        });
      }
    };

    const tryStoredOfferAnswer = async () => {
      try {
        if (role === "artist") {
          const raw = localStorage.getItem(offerKey(sessionId));
          if (raw) {
            const msg = JSON.parse(raw) as SignalPayload;
            if (msg.t === "offer") await handlePayload(msg);
          }
        } else if (role === "engineer") {
          const raw = localStorage.getItem(answerKey(sessionId));
          if (raw) {
            const msg = JSON.parse(raw) as SignalPayload;
            if (msg.t === "answer") await handlePayload(msg);
          }
        }
      } catch {
        /* ignore */
      }
    };

    void (async () => {
      if (role === "engineer") {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          persistAndPost({ t: "offer", sdp: offer.sdp!, from: "engineer" });
        } catch (e) {
          console.warn("W.Studio offer failed", e);
        }
      }
      await tryStoredOfferAnswer();
    })();

    return () => {
      bc.onmessage = null;
      bc.close();
      bcRef.current = null;
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
      screenPreviewStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenPreviewStreamRef.current = null;
      setLocalScreenPreview(null);
    }
  }, [role]);

  useEffect(() => {
    if (role !== "engineer") {
      return;
    }

    const pc = pcRef.current;
    const videoSender = pc?.getSenders().find((s) => s.track?.kind === "video");
    const cam = cameraVideoTrackRef.current;

    if (!screenSharing) {
      screenPreviewStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenPreviewStreamRef.current = null;
      setLocalScreenPreview(null);
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
  }, [screenSharing, role]);

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
