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
import { WSTUDIO_DAW_VOCAL_IN_1, WSTUDIO_DAW_VOCAL_IN_2 } from "./dawRouting";

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
  /** Remote stream for playback, processed into the current role's actual monitor mix. */
  remoteStreamForPlayback: MediaStream | null;
  /** Engineer's captured display for local preview only */
  localScreenPreview: MediaStream | null;
  /**
   * Engineer-only: isolated remote artist vocal, for DAW / virtual-input routing (not mixed with local mic or monitor faders).
   */
  engineerDawVocalIn1: MediaStream | null;
  engineerDawVocalIn2: MediaStream | null;
  /**
   * Engineer-only: screen-capture audio when present (isolated from vocal DAW buses).
   */
  engineerScreenShareAudioStream: MediaStream | null;
  /**
   * Engineer-only: 0–1 level measured on the dedicated bridge / DAW vocal graph (separate Web Audio path from session monitor metering).
   */
  engineerBridgeVocalLevel: number;
  /** Engineer-only: DAW return capture stream (from virtual cable input like BlackHole). */
  engineerDawReturnStream: MediaStream | null;
  /** Engineer-only: 0–1 level on the DAW return capture path. */
  engineerDawReturnLevel: number;
  /** Engineer-only: whether DAW return capture is active. */
  dawReturnActive: boolean;
  /** Engineer-only: selected input device ID for DAW return capture. */
  dawReturnDeviceId: string;
  /** Engineer-only: set the input device for DAW return. */
  setDawReturnDeviceId: (id: string) => void;
  /** Engineer-only: start capturing DAW return from selected input device. */
  startDawReturn: () => void;
  /** Engineer-only: stop DAW return capture. */
  stopDawReturn: () => void;
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function levelToUnityGain(level: number) {
  return clamp(level * 2, 0, 2);
}

function levelToTalkbackGain(level: number) {
  return 1 + clamp(level, 0, 1);
}

function rampGain(node: GainNode | null, target: number) {
  if (!node) return;
  const next = Math.max(0, target);
  const now = node.context.currentTime;
  try {
    node.gain.cancelScheduledValues(now);
    node.gain.linearRampToValueAtTime(next, now + 0.05);
  } catch {
    node.gain.value = next;
  }
}

function keepAudioContextRunning(ctx: AudioContext) {
  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener("pointerdown", resume, true);
    window.removeEventListener("touchstart", resume, true);
    window.removeEventListener("keydown", resume, true);
  };
  const resume = () => {
    void ctx.resume().catch(() => {});
    if (ctx.state === "running") cleanup();
  };

  if (ctx.state !== "running") {
    window.addEventListener("pointerdown", resume, true);
    window.addEventListener("touchstart", resume, true);
    window.addEventListener("keydown", resume, true);
    resume();
  }

  return cleanup;
}

export function StudioMediaProvider({ children }: { children: ReactNode }) {
  const { sessionId, role, muted, talkbackHeld, live, screenSharing, toggleScreenShare } = useSession();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remotePlaybackStream, setRemotePlaybackStream] = useState<MediaStream | null>(null);
  const [localScreenPreview, setLocalScreenPreview] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
   const [localMicLevel, setLocalMicLevel] = useState(0);
  const [localTalkbackTxLevel, setLocalTalkbackTxLevel] = useState(0);
  const [remoteMicLevel, setRemoteMicLevel] = useState(0);
  const [hasRemoteAudio, setHasRemoteAudio] = useState(false);
  const [engineerDawVocalIn1, setEngineerDawVocalIn1] = useState<MediaStream | null>(null);
  const [engineerDawVocalIn2, setEngineerDawVocalIn2] = useState<MediaStream | null>(null);
  const [engineerScreenShareAudioStream, setEngineerScreenShareAudioStream] = useState<MediaStream | null>(null);
  const [engineerBridgeVocalLevel, setEngineerBridgeVocalLevel] = useState(0);
  const [engineerDawReturnStream, setEngineerDawReturnStream] = useState<MediaStream | null>(null);
  const [engineerDawReturnLevel, setEngineerDawReturnLevel] = useState(0);
  const [dawReturnActive, setDawReturnActive] = useState(false);
  const [dawReturnDeviceId, setDawReturnDeviceId] = useState("none");

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
  const localSendDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const dawReturnSendSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dawReturnSendGainRef = useRef<GainNode | null>(null);
  const artistRemoteGainRef = useRef<GainNode | null>(null);
  const engineerRemoteGainRef = useRef<GainNode | null>(null);
  const engineerDawReturnMonitorGainRef = useRef<GainNode | null>(null);
  const engineerHeadphoneGainRef = useRef<GainNode | null>(null);
  const dawReturnCtxRef = useRef<AudioContext | null>(null);
  const dawReturnStreamRef = useRef<MediaStream | null>(null);
  const dawReturnRafRef = useRef(0);
  const dawReturnAudioUnlockCleanupRef = useRef<() => void>(() => {});
  const dawReturnSenderRef = useRef<RTCRtpSender | null>(null);

  roleRef.current = role;
  toggleScreenShareRef.current = toggleScreenShare;

  const clearMediaError = useCallback(() => setMediaError(null), []);

  const closeLocalAudioGraph = useCallback(() => {
    cancelAnimationFrame(localLevelRafRef.current);
    localLevelRafRef.current = 0;
    cancelAnimationFrame(txLevelRafRef.current);
    txLevelRafRef.current = 0;
    try {
      dawReturnSendSourceRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      dawReturnSendGainRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      void audioCtxRef.current?.close();
    } catch {
      /* ignore */
    }
    audioCtxRef.current = null;
    gainNodeRef.current = null;
    rawMicAudioTrackRef.current = null;
    localSendDestinationRef.current = null;
    dawReturnSendSourceRef.current = null;
    dawReturnSendGainRef.current = null;
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

  const detachDawReturnFromSendGraph = useCallback(() => {
    try {
      dawReturnSendSourceRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      dawReturnSendGainRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    dawReturnSendSourceRef.current = null;
    dawReturnSendGainRef.current = null;
  }, []);

  const applyMuteAndPttToGraph = useCallback(() => {
    const raw = rawMicAudioTrackRef.current;
    const micSendGain = gainNodeRef.current;
    const dawReturnSendGain = dawReturnSendGainRef.current;
    if (raw) raw.enabled = !muted;

    const micSendTarget = muted
      ? 0
      : role === "engineer"
        ? talkbackHeld
          ? levelToTalkbackGain(live.talkbackLevel)
          : 0
        : 1;

    rampGain(micSendGain, micSendTarget);

    const dawReturnSendTarget = role === "engineer" ? levelToUnityGain(live.cueMix) : 0;
    rampGain(dawReturnSendGain, dawReturnSendTarget);
  }, [muted, role, talkbackHeld, live.talkbackLevel, live.cueMix]);

  const applyMuteAndPttToGraphRef = useRef<() => void>(() => {});
  applyMuteAndPttToGraphRef.current = applyMuteAndPttToGraph;

  const attachDawReturnToSendGraph = useCallback(
    (stream: MediaStream | null) => {
      detachDawReturnFromSendGraph();

      const ctx = audioCtxRef.current;
      const dest = localSendDestinationRef.current;
      const returnTrack = stream?.getAudioTracks().find((track) => track.readyState === "live") ?? null;
      if (!ctx || !dest || !returnTrack) return;

      const source = ctx.createMediaStreamSource(new MediaStream([returnTrack]));
      const gain = ctx.createGain();
      source.connect(gain);
      gain.connect(dest);

      dawReturnSendSourceRef.current = source;
      dawReturnSendGainRef.current = gain;
      applyMuteAndPttToGraphRef.current();
    },
    [detachDawReturnFromSendGraph],
  );

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
    let releaseAudioContext = () => {};
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
        releaseAudioContext = keepAudioContextRunning(ctx);
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
        localSendDestinationRef.current = dest;
        gain.connect(analyserTx);
        gain.connect(dest);

        if (dawReturnStreamRef.current) {
          attachDawReturnToSendGraph(dawReturnStreamRef.current);
        }

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
      releaseAudioContext();
      cancelAnimationFrame(localLevelRafRef.current);
      localLevelRafRef.current = 0;
      cancelAnimationFrame(txLevelRafRef.current);
      txLevelRafRef.current = 0;
      stopLocalMedia();
    };
  }, [sessionId, role, stopLocalMedia, attachDawReturnToSendGraph]);

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

  /**
   * Engineer: isolate remote artist vocal into dedicated Web Audio destinations for DAW routing.
   * Independent of HTML video volume / headphone UI — unity gain on the peer mic tap.
   * Vocal In 1 & 2 are parallel buses for future stereo/aux mapping (MVP: dual mono from one track).
   */
  useEffect(() => {
    if (role !== "engineer") {
      setEngineerDawVocalIn1(null);
      setEngineerDawVocalIn2(null);
      setEngineerBridgeVocalLevel(0);
      return;
    }
    const rs = remoteStream;
    const audioTrack = rs?.getAudioTracks().find((t) => t.readyState === "live");
    if (!audioTrack) {
      setEngineerDawVocalIn1(null);
      setEngineerDawVocalIn2(null);
      setEngineerBridgeVocalLevel(0);
      return;
    }

    let cancelled = false;
    let meterRaf = 0;
    const bridgeScratch = new Float32Array(2048);
    const ctx = new AudioContext();
    void ctx.resume().catch(() => {});
    const micStream = new MediaStream([audioTrack]);
    const src = ctx.createMediaStreamSource(micStream);
    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    g1.gain.value = 1;
    g2.gain.value = 1;
    const dest1 = ctx.createMediaStreamDestination();
    const dest2 = ctx.createMediaStreamDestination();
    const bridgeAnalyser = ctx.createAnalyser();
    bridgeAnalyser.fftSize = 2048;
    bridgeAnalyser.smoothingTimeConstant = 0.75;
    try {
      dest1.stream.getAudioTracks().forEach((t) => {
        t.contentHint = "music";
      });
      dest2.stream.getAudioTracks().forEach((t) => {
        t.contentHint = "music";
      });
    } catch {
      /* contentHint unsupported */
    }
    src.connect(g1);
    src.connect(g2);
    g1.connect(dest1);
    g1.connect(bridgeAnalyser);
    g2.connect(dest2);

    const tickBridgeMeter = () => {
      if (cancelled) return;
      bridgeAnalyser.getFloatTimeDomainData(bridgeScratch);
      let sum = 0;
      for (let i = 0; i < bridgeScratch.length; i++) {
        const x = bridgeScratch[i];
        sum += x * x;
      }
      const rms = Math.sqrt(sum / bridgeScratch.length);
      const instant = Math.min(1, rms * 9);
      setEngineerBridgeVocalLevel((prev) => prev * 0.78 + instant * 0.22);
      meterRaf = requestAnimationFrame(tickBridgeMeter);
    };
    meterRaf = requestAnimationFrame(tickBridgeMeter);

    const s1 = dest1.stream;
    const s2 = dest2.stream;
    if (import.meta.env.DEV) {
      console.debug(DEBUG_AUDIO_TAG, "DAW vocal buses", WSTUDIO_DAW_VOCAL_IN_1, WSTUDIO_DAW_VOCAL_IN_2, s1.id, s2.id);
    }

    if (!cancelled) {
      setEngineerDawVocalIn1(s1);
      setEngineerDawVocalIn2(s2);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(meterRaf);
      setEngineerBridgeVocalLevel(0);
      src.disconnect();
      g1.disconnect();
      g2.disconnect();
      bridgeAnalyser.disconnect();
      void ctx.close();
      setEngineerDawVocalIn1(null);
      setEngineerDawVocalIn2(null);
    };
  }, [role, remoteStream]);

  /** Screen-share audio only (never mixed into artist vocal DAW buses). */
  /** Screen-share audio only (never mixed into artist vocal DAW buses). */
  useEffect(() => {
    if (role !== "engineer") {
      setEngineerScreenShareAudioStream(null);
      return;
    }
    const v = localScreenPreview;
    const a = v?.getAudioTracks().find((t) => t.readyState === "live");
    setEngineerScreenShareAudioStream(a ? new MediaStream([a]) : null);
  }, [role, localScreenPreview]);

  /**
   * Engineer-only: DAW Return capture.
   * Captures audio from a selected input device (e.g. BlackHole) and sends it to the artist
   * via WebRTC so they can hear DAW playback in their headphones.
   * Monitor-only — does NOT affect the recording path (artist mic → DAW).
   */
  const cleanupDawReturn = useCallback(() => {
    cancelAnimationFrame(dawReturnRafRef.current);
    dawReturnRafRef.current = 0;
    dawReturnAudioUnlockCleanupRef.current();
    dawReturnAudioUnlockCleanupRef.current = () => {};
    detachDawReturnFromSendGraph();
    if (dawReturnStreamRef.current) {
      dawReturnStreamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch { /* */ } });
      dawReturnStreamRef.current = null;
    }
    if (dawReturnCtxRef.current) {
      try { void dawReturnCtxRef.current.close(); } catch { /* */ }
      dawReturnCtxRef.current = null;
    }
    if (dawReturnSenderRef.current && pcRef.current) {
      try { pcRef.current.removeTrack(dawReturnSenderRef.current); } catch { /* */ }
      dawReturnSenderRef.current = null;
    }
    setEngineerDawReturnStream(null);
    setEngineerDawReturnLevel(0);
    setDawReturnActive(false);
  }, [detachDawReturnFromSendGraph]);

  const startDawReturn = useCallback(async () => {
    if (role !== "engineer" || dawReturnDeviceId === "none") return;
    cleanupDawReturn();
    try {
      const constraints: MediaStreamConstraints = {
        audio: dawReturnDeviceId === "default"
          ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
          : { deviceId: { exact: dawReturnDeviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      };
      const returnStream = await navigator.mediaDevices.getUserMedia(constraints);
      dawReturnStreamRef.current = returnStream;
      const returnTrack = returnStream.getAudioTracks()[0];
      if (!returnTrack) { cleanupDawReturn(); return; }
      try { returnTrack.contentHint = "music"; } catch { /* */ }

      const ctx = new AudioContext();
      dawReturnCtxRef.current = ctx;
      dawReturnAudioUnlockCleanupRef.current = keepAudioContextRunning(ctx);
      await ctx.resume().catch(() => {});
      const src = ctx.createMediaStreamSource(new MediaStream([returnTrack]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.75;
      src.connect(analyser);

      attachDawReturnToSendGraph(returnStream);

      const scratch = new Float32Array(2048);
      const tickReturn = () => {
        analyser.getFloatTimeDomainData(scratch);
        let sum = 0;
        for (let i = 0; i < scratch.length; i++) { sum += scratch[i] * scratch[i]; }
        const rms = Math.sqrt(sum / scratch.length);
        const instant = Math.min(1, rms * 9);
        setEngineerDawReturnLevel((prev) => prev * 0.78 + instant * 0.22);
        dawReturnRafRef.current = requestAnimationFrame(tickReturn);
      };
      dawReturnRafRef.current = requestAnimationFrame(tickReturn);

      setEngineerDawReturnStream(returnStream);
      setDawReturnActive(true);
      console.debug(DEBUG_AUDIO_TAG, "DAW Return capture started", { deviceId: dawReturnDeviceId });
    } catch (err) {
      console.warn(DEBUG_AUDIO_TAG, "DAW Return capture failed", err);
      setMediaError(err instanceof Error ? err.message : "Could not capture DAW return audio");
      cleanupDawReturn();
    }
  }, [role, dawReturnDeviceId, cleanupDawReturn, attachDawReturnToSendGraph]);

  const stopDawReturn = useCallback(() => {
    cleanupDawReturn();
    console.debug(DEBUG_AUDIO_TAG, "DAW Return capture stopped");
  }, [cleanupDawReturn]);

  // Cleanup DAW return when role changes or session ends
  useEffect(() => {
    if (role !== "engineer" || !sessionId.trim()) {
      cleanupDawReturn();
    }
  }, [role, sessionId, cleanupDawReturn]);

  useEffect(() => {
    artistRemoteGainRef.current = null;
    engineerRemoteGainRef.current = null;
    engineerDawReturnMonitorGainRef.current = null;
    engineerHeadphoneGainRef.current = null;

    if (role === "artist") {
      const rs = remoteStream;
      if (!rs) {
        setRemotePlaybackStream(null);
        return;
      }

      const videoTrack = rs.getVideoTracks()[0] ?? null;
      const audioTracks = rs.getAudioTracks().filter((track) => track.readyState === "live");
      if (!audioTracks.length) {
        setRemotePlaybackStream(rs);
        return;
      }

      const ctx = new AudioContext();
      const releaseAudioContext = keepAudioContextRunning(ctx);
      void ctx.resume().catch(() => {});

      const master = ctx.createGain();
      const dest = ctx.createMediaStreamDestination();
      artistRemoteGainRef.current = master;
      master.connect(dest);

      const sources = audioTracks.map((track) => {
        const source = ctx.createMediaStreamSource(new MediaStream([track]));
        source.connect(master);
        return source;
      });

      rampGain(master, live.headphoneLevelArtist);

      setRemotePlaybackStream(new MediaStream([...(videoTrack ? [videoTrack] : []), ...dest.stream.getAudioTracks()]));

      return () => {
        artistRemoteGainRef.current = null;
        sources.forEach((source) => source.disconnect());
        master.disconnect();
        releaseAudioContext();
        void ctx.close();
        setRemotePlaybackStream(null);
      };
    }

    if (role === "engineer") {
      const rs = remoteStream;
      const videoTrack = rs?.getVideoTracks()[0] ?? null;
      const remoteAudioTracks = rs?.getAudioTracks().filter((track) => track.readyState === "live") ?? [];
      const returnTrack = engineerDawReturnStream?.getAudioTracks().find((track) => track.readyState === "live") ?? null;

      if (!remoteAudioTracks.length && !returnTrack) {
        setRemotePlaybackStream(rs ?? null);
        return;
      }

      const ctx = new AudioContext();
      const releaseAudioContext = keepAudioContextRunning(ctx);
      void ctx.resume().catch(() => {});

      const remoteGain = ctx.createGain();
      const dawReturnGain = ctx.createGain();
      const headphonesGain = ctx.createGain();
      const dest = ctx.createMediaStreamDestination();

      engineerRemoteGainRef.current = remoteGain;
      engineerDawReturnMonitorGainRef.current = dawReturnGain;
      engineerHeadphoneGainRef.current = headphonesGain;

      remoteGain.connect(headphonesGain);
      dawReturnGain.connect(headphonesGain);
      headphonesGain.connect(dest);

      const sources = remoteAudioTracks.map((track) => {
        const source = ctx.createMediaStreamSource(new MediaStream([track]));
        source.connect(remoteGain);
        return source;
      });

      let returnSource: MediaStreamAudioSourceNode | null = null;
      if (returnTrack) {
        returnSource = ctx.createMediaStreamSource(new MediaStream([returnTrack]));
        returnSource.connect(dawReturnGain);
      }

      rampGain(remoteGain, levelToUnityGain(live.vocalLevel));
      rampGain(dawReturnGain, levelToUnityGain(live.cueMix));
      rampGain(headphonesGain, live.headphoneLevelEngineer);

      setRemotePlaybackStream(new MediaStream([...(videoTrack ? [videoTrack] : []), ...dest.stream.getAudioTracks()]));

      return () => {
        engineerRemoteGainRef.current = null;
        engineerDawReturnMonitorGainRef.current = null;
        engineerHeadphoneGainRef.current = null;
        sources.forEach((source) => source.disconnect());
        returnSource?.disconnect();
        remoteGain.disconnect();
        dawReturnGain.disconnect();
        headphonesGain.disconnect();
        releaseAudioContext();
        void ctx.close();
        setRemotePlaybackStream(null);
      };
    }

    setRemotePlaybackStream(remoteStream);
    return;
  }, [role, remoteStream, engineerDawReturnStream, live.headphoneLevelArtist, live.headphoneLevelEngineer, live.vocalLevel, live.cueMix]);

  useEffect(() => {
    if (role === "artist") {
      rampGain(artistRemoteGainRef.current, live.headphoneLevelArtist);
      return;
    }

    if (role === "engineer") {
      rampGain(engineerRemoteGainRef.current, levelToUnityGain(live.vocalLevel));
      rampGain(engineerDawReturnMonitorGainRef.current, levelToUnityGain(live.cueMix));
      rampGain(engineerHeadphoneGainRef.current, live.headphoneLevelEngineer);
    }
  }, [role, live.headphoneLevelArtist, live.headphoneLevelEngineer, live.vocalLevel, live.cueMix]);

  const remoteStreamForPlayback = useMemo(() => {
    if (role !== "artist" && role !== "engineer") return remoteStream;
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
      engineerDawVocalIn1,
      engineerDawVocalIn2,
      engineerScreenShareAudioStream,
      engineerBridgeVocalLevel,
      engineerDawReturnStream,
      engineerDawReturnLevel,
      dawReturnActive,
      dawReturnDeviceId,
      setDawReturnDeviceId,
      startDawReturn,
      stopDawReturn,
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
      engineerDawVocalIn1,
      engineerDawVocalIn2,
      engineerScreenShareAudioStream,
      engineerBridgeVocalLevel,
      engineerDawReturnStream,
      engineerDawReturnLevel,
      dawReturnActive,
      dawReturnDeviceId,
      startDawReturn,
      stopDawReturn,
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
