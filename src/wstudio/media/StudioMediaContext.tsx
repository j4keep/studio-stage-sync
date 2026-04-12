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
  /** Remote stream for playback (artist: processed for talkback priority + headphone; engineer: raw) */
  remoteStreamForPlayback: MediaStream | null;
  /** Engineer's captured display for local preview only */
  localScreenPreview: MediaStream | null;
  mediaError: string | null;
  clearMediaError: () => void;
  /** 0–1 RMS from local mic (pre–PTT gate; real input, ~0 when muted) */
  localMicLevel: number;
  /** 0–1 RMS on the WebRTC send path (post mute gate; follows voice when unmuted) */
  localTalkbackTxLevel: number;
  /** 0–1 RMS from remote participant's audio */
  remoteMicLevel: number;
  /** Live inbound audio track from peer (for UI labels) */
  hasRemoteAudio: boolean;
};

const Ctx = createContext<StudioMediaContextValue | null>(null);

const DEBUG_AUDIO_TAG = "[W.Studio audio]";

export function StudioMediaProvider({ children }: { children: ReactNode }) {
  const { sessionId, role, muted, live, screenSharing, toggleScreenShare } = useSession();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remotePlaybackStream, setRemotePlaybackStream] = useState<MediaStream | null>(null);
  const [localScreenPreview, setLocalScreenPreview] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
   const [localMicLevel, setLocalMicLevel] = useState(0);
  const [localTalkbackTxLevel, setLocalTalkbackTxLevel] = useState(0);
  const [remoteMicLevel, setRemoteMicLevel] = useState(0);
  const [hasRemoteAudio, setHasRemoteAudio] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const inboundStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const roleRef = useRef<Role>(role);
  const toggleScreenShareRef = useRef(toggleScreenShare);
  const screenPreviewStreamRef = useRef<MediaStream | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const rawMicAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const localLevelRafRef = useRef(0);
  const txLevelRafRef = useRef(0);
  const audioDebugLastLogRef = useRef(0);
  const acquiredSessionTracksRef = useRef<MediaStreamTrack[]>([]);
  const artistRemoteGainRef = useRef<GainNode | null>(null);

  roleRef.current = role;
  toggleScreenShareRef.current = toggleScreenShare;

  const clearMediaError = useCallback(() => setMediaError(null), []);

  const closeLocalAudioGraph = useCallback(() => {
    cancelAnimationFrame(localLevelRafRef.current);
    localLevelRafRef.current = 0;
    cancelAnimationFrame(txLevelRafRef.current);
    txLevelRafRef.current = 0;
    try {
      void audioCtxRef.current?.close();
    } catch {
      /* ignore */
    }
    audioCtxRef.current = null;
    gainNodeRef.current = null;
    rawMicAudioTrackRef.current = null;
  }, []);

  const stopLocalMedia = useCallback(
    (updateState = true) => {
      closeLocalAudioGraph();
      acquiredSessionTracksRef.current.forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
      acquiredSessionTracksRef.current = [];
      stopMediaStream(localStreamRef.current);
      localStreamRef.current = null;
      cameraVideoTrackRef.current = null;
      if (updateState) {
        setLocalStream(null);
        setLocalMicLevel(0);
        setLocalTalkbackTxLevel(0);
      }
    },
    [closeLocalAudioGraph],
  );

  const stopScreenPreview = useCallback((updateState = true) => {
    stopMediaStream(screenPreviewStreamRef.current);
    screenPreviewStreamRef.current = null;
    if (updateState) {
      setLocalScreenPreview(null);
    }
  }, []);

  const applyMuteAndPttToGraph = useCallback(() => {
    const raw = rawMicAudioTrackRef.current;
    const gain = gainNodeRef.current;
    if (!gain) return;
    if (muted) {
      if (raw) raw.enabled = false;
      gain.gain.value = 0;
    } else {
      if (raw) raw.enabled = true;
      /** Continuous voice to peer when unmuted; UI talkback stays a separate control layer. */
      gain.gain.value = 1;
    }
  }, [muted]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  /** Mute gates the processed send path; raw mic tap stays live for local metering when unmuted. */
  useEffect(() => {
    applyMuteAndPttToGraph();
  }, [applyMuteAndPttToGraph]);

  // Acquire camera/mic ONLY when user has joined a session (sessionId + role set).
  // Audio: Web Audio tap (meter) + gain node (mute) → MediaStreamDestination → WebRTC.
  useEffect(() => {
    if (!sessionId.trim() || !role) {
      stopLocalMedia();
      return;
    }

    stopLocalMedia();

    let cancelled = false;
    const buf = new Uint8Array(1024);

    const tickLocalMeter = (analyser: AnalyserNode) => {
      if (cancelled) return;
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const x = (buf[i] - 128) / 128;
        sum += x * x;
      }
      const rms = Math.sqrt(sum / buf.length);
      const instant = Math.min(1, rms * 5.5);
      setLocalMicLevel((prev) => prev * 0.82 + instant * 0.18);
      localLevelRafRef.current = requestAnimationFrame(() => tickLocalMeter(analyser));
    };

    const bufTx = new Uint8Array(1024);
    const tickTxMeter = (analyserTx: AnalyserNode) => {
      if (cancelled) return;
      analyserTx.getByteTimeDomainData(bufTx);
      let sum = 0;
      for (let i = 0; i < bufTx.length; i++) {
        const x = (bufTx[i] - 128) / 128;
        sum += x * x;
      }
      const rms = Math.sqrt(sum / bufTx.length);
      const instant = Math.min(1, rms * 5.5);
      setLocalTalkbackTxLevel((prev) => prev * 0.82 + instant * 0.18);
      txLevelRafRef.current = requestAnimationFrame(() => tickTxMeter(analyserTx));
    };

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

        acquiredSessionTracksRef.current = ms.getTracks();

        const videoTrack = ms.getVideoTracks()[0] ?? null;
        const audioTrack = ms.getAudioTracks()[0] ?? null;
        cameraVideoTrackRef.current = videoTrack;

        if (!audioTrack) {
          localStreamRef.current = ms;
          setLocalStream(ms);
          setMediaError(null);
          console.warn(DEBUG_AUDIO_TAG, "No audio track on getUserMedia stream");
          return;
        }

        rawMicAudioTrackRef.current = audioTrack;

        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        await ctx.resume().catch(() => {});

        const micOnly = new MediaStream([audioTrack]);
        const source = ctx.createMediaStreamSource(micOnly);

        const analyserLocal = ctx.createAnalyser();
        analyserLocal.fftSize = 2048;
        analyserLocal.smoothingTimeConstant = 0.75;
        source.connect(analyserLocal);

        const gain = ctx.createGain();
        gain.gain.value = 0;
        gainNodeRef.current = gain;
        source.connect(gain);

        const analyserTx = ctx.createAnalyser();
        analyserTx.fftSize = 2048;
        analyserTx.smoothingTimeConstant = 0.75;

        const dest = ctx.createMediaStreamDestination();
        gain.connect(analyserTx);
        analyserTx.connect(dest);

        const sentAudio = dest.stream.getAudioTracks()[0];
        const outTracks = videoTrack ? [videoTrack, sentAudio] : [sentAudio];
        const outStream = new MediaStream(outTracks);
        localStreamRef.current = outStream;
        setLocalStream(outStream);
        setMediaError(null);

        localLevelRafRef.current = requestAnimationFrame(() => tickLocalMeter(analyserLocal));

        applyMuteAndPttToGraph();

        console.debug(DEBUG_AUDIO_TAG, "Mic graph ready", {
          micTrackActive: audioTrack.readyState === "live",
          meterConnected: true,
        });
      } catch (e) {
        if (!cancelled) {
          setMediaError(e instanceof Error ? e.message : "Could not access camera or microphone");
          stopLocalMedia();
        }
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(localLevelRafRef.current);
      localLevelRafRef.current = 0;
      cancelAnimationFrame(txLevelRafRef.current);
      txLevelRafRef.current = 0;
      stopLocalMedia();
    };
  }, [sessionId, role, stopLocalMedia]);

  /** Remote level from peer audio (real RTP). */
  useEffect(() => {
    const audioTrack = remoteStream?.getAudioTracks().find((t) => t.readyState === "live");
    if (!audioTrack) {
      setHasRemoteAudio(false);
      setRemoteMicLevel(0);
      return;
    }

    setHasRemoteAudio(true);

    let cancelled = false;
    const remoteScratch = new Float32Array(2048);
    const remoteRafRef = { id: 0 };

    const ctx = new AudioContext();
    void ctx.resume().catch(() => {});
    const src = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.75;
    src.connect(analyser);

    const tick = () => {
      if (cancelled) return;
      analyser.getFloatTimeDomainData(remoteScratch);
      let sum = 0;
      for (let i = 0; i < remoteScratch.length; i++) {
        const x = remoteScratch[i];
        sum += x * x;
      }
      const rms = Math.sqrt(sum / remoteScratch.length);
      const instant = Math.min(1, rms * 9);
      setRemoteMicLevel((prev) => prev * 0.78 + instant * 0.22);
      remoteRafRef.id = requestAnimationFrame(tick);
    };
    remoteRafRef.id = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(remoteRafRef.id);
      src.disconnect();
      void ctx.close();
      setHasRemoteAudio(false);
      setRemoteMicLevel(0);
    };
  }, [remoteStream]);

  /** Artist: route peer audio through Web Audio for headphone level + engineer talkback priority. */
  useEffect(() => {
    artistRemoteGainRef.current = null;
    if (role !== "artist") {
      setRemotePlaybackStream(null);
      return;
    }
    const rs = remoteStream;
    if (!rs) {
      setRemotePlaybackStream(null);
      return;
    }
    const audioTr = rs.getAudioTracks()[0];
    if (!audioTr) {
      setRemotePlaybackStream(rs);
      return;
    }
    const videoTr = rs.getVideoTracks()[0] ?? null;
    const ctx = new AudioContext();
    void ctx.resume().catch(() => {});
    const src = ctx.createMediaStreamSource(new MediaStream([audioTr]));
    const gain = ctx.createGain();
    artistRemoteGainRef.current = gain;
    const dest = ctx.createMediaStreamDestination();
    src.connect(gain);
    gain.connect(dest);
    const hp = live.headphoneLevelArtist;
    const priority = live.engineerPtt ? 1.3 : 1;
    gain.gain.value = Math.min(1.5, Math.max(0, hp * priority));
    const out = new MediaStream([...(videoTr ? [videoTr] : []), ...dest.stream.getAudioTracks()]);
    setRemotePlaybackStream(out);
    return () => {
      artistRemoteGainRef.current = null;
      src.disconnect();
      gain.disconnect();
      void ctx.close();
      setRemotePlaybackStream(null);
    };
  }, [role, remoteStream]);

  useEffect(() => {
    const gain = artistRemoteGainRef.current;
    if (role !== "artist" || !gain) return;
    const hp = live.headphoneLevelArtist;
    /** Engineer holding Talk: lift peer voice in artist cans (continuous duplex unchanged). */
    const priority = live.engineerPtt ? 1.3 : 1;
    const target = Math.min(1.5, Math.max(0, hp * priority));
    const ctx = gain.context;
    const t = ctx.currentTime;
    try {
      gain.gain.cancelScheduledValues(t);
      gain.gain.linearRampToValueAtTime(target, t + 0.05);
    } catch {
      gain.gain.value = target;
    }
  }, [role, live.headphoneLevelArtist, live.engineerPtt]);

  const remoteStreamForPlayback = useMemo(() => {
    if (role !== "artist") return remoteStream;
    return remotePlaybackStream ?? remoteStream;
  }, [role, remoteStream, remotePlaybackStream]);

  useEffect(() => {
    const now = performance.now();
    if (now - audioDebugLastLogRef.current < 2500) return;
    audioDebugLastLogRef.current = now;
    const raw = rawMicAudioTrackRef.current;
    const pc = pcRef.current;
    console.debug(DEBUG_AUDIO_TAG, {
      micStreamActive: !!localStreamRef.current && (raw?.readyState === "live" || false),
      meterConnectedToLiveMic: !!audioCtxRef.current && !!gainNodeRef.current,
      muteState: muted,
      micSendingToPeer: !muted && gainNodeRef.current !== null && gainNodeRef.current.gain.value > 0,
      rtcConnectionState: pc?.connectionState ?? "no-pc",
      localMicLevel: Number(localMicLevel.toFixed(3)),
      remoteMicLevel: Number(remoteMicLevel.toFixed(3)),
    });
  }, [localMicLevel, remoteMicLevel, muted, localStream]);

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
      remoteStreamForPlayback,
      localScreenPreview,
      mediaError,
      clearMediaError,
      localMicLevel,
      localTalkbackTxLevel,
      remoteMicLevel,
      hasRemoteAudio,
    }),
    [
      localStream,
      remoteStream,
      remoteStreamForPlayback,
      localScreenPreview,
      mediaError,
      clearMediaError,
      localMicLevel,
      localTalkbackTxLevel,
      remoteMicLevel,
      hasRemoteAudio,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudioMedia() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStudioMedia requires StudioMediaProvider");
  return v;
}
