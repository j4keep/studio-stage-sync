import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Mic, Loader2, Camera, SwitchCamera } from "lucide-react";
import {
  startMicRecording,
  transcribeYajAudio,
  synthesizeYajVoice,
  playYajAudio,
  stopYajAudio,
  unlockYajAudio,
  describeMicError,
  acquireYajCameraStream,
  describeCameraError,
  captureYajVisionFrame,
  type MicRecorder,
} from "@/lib/yaj-media";
import { getWellnessCoachVoice } from "@/lib/wellness-coach-prefs";

type Phase = "listening" | "thinking" | "speaking";

export type VoiceSendPayload = {
  text: string;
  /** JPEG/PNG data URL from the live camera when the user is showing something. */
  imageDataUrl?: string;
};

type Props = {
  /** Sends spoken text (and optional camera frame) into chat; resolves with YAJ's reply. */
  onSend: (payload: VoiceSendPayload) => Promise<string>;
  onClose: () => void;
  /** Mic stream acquired during the user tap that opened voice mode (iOS-safe). */
  initialStream?: MediaStream | null;
  /**
   * Optional seed message (e.g. wellness mood). Sent once on open so YAJ
   * speaks first — then normal listen/speak loop continues.
   */
  initialPrompt?: string | null;
};

type StarSpec = {
  id: string;
  color: string;
  glow: string;
  size: number;
  x: string;
  y: string;
  delay: string;
  duration: string;
};

/** Spread four-point stars from the YAJ AI mark — cyan, purple, pink. */
const STARS: StarSpec[] = [
  { id: "c1", color: "#22d3ee", glow: "rgba(34,211,238,0.85)", size: 54, x: "18%", y: "28%", delay: "0s", duration: "1.6s" },
  { id: "p1", color: "#c084fc", glow: "rgba(192,132,252,0.85)", size: 40, x: "72%", y: "22%", delay: "0.25s", duration: "1.9s" },
  { id: "k1", color: "#f472b6", glow: "rgba(244,114,182,0.85)", size: 28, x: "58%", y: "58%", delay: "0.45s", duration: "1.5s" },
  { id: "c2", color: "#67e8f9", glow: "rgba(103,232,249,0.75)", size: 22, x: "32%", y: "68%", delay: "0.7s", duration: "2.1s" },
  { id: "p2", color: "#e879f9", glow: "rgba(232,121,249,0.75)", size: 18, x: "78%", y: "48%", delay: "0.15s", duration: "1.7s" },
  { id: "k2", color: "#fb7185", glow: "rgba(251,113,133,0.7)", size: 16, x: "42%", y: "18%", delay: "0.9s", duration: "2s" },
];

const DEFAULT_VISION_PROMPT =
  "I'm showing you something on my camera. Look carefully and tell me what you see — identify it if you can, and briefly explain.";

function FourPointStar({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path
        d="M32 2 C34 22 42 30 62 32 C42 34 34 42 32 62 C30 42 22 34 2 32 C22 30 30 22 32 2 Z"
        fill={color}
      />
    </svg>
  );
}

/**
 * Full-screen hands-free voice conversation. Listens, detects when you stop
 * talking, replies out loud, then listens again. Optional camera lets YAJ see
 * what you're showing (Gemini Live–style vision).
 */
const YajVoiceMode = ({ onSend, onClose, initialStream = null, initialPrompt = null }: Props) => {
  const [phase, setPhase] = useState<Phase>("listening");
  const [level, setLevel] = useState(0);
  const [caption, setCaption] = useState(initialPrompt?.trim() ? "Connecting…" : "Listening…");
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("environment");
  const [cameraBusy, setCameraBusy] = useState(false);

  const recorderRef = useRef<MicRecorder | null>(null);
  const activeRef = useRef(true);
  const busyRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(initialStream);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraOnRef = useRef(false);
  const cameraFacingRef = useRef(cameraFacing);
  const onSendRef = useRef(onSend);
  const seedUsedRef = useRef(false);
  onSendRef.current = onSend;
  cameraFacingRef.current = cameraFacing;

  const stopCameraTracks = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const attachCameraPreview = useCallback(async (stream: MediaStream) => {
    cameraStreamRef.current = stream;
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    try {
      await video.play();
    } catch {
      /* autoplay can fail briefly; loadeddata retry is enough for stills */
    }
  }, []);

  const openCamera = useCallback(
    async (facing: "user" | "environment" = cameraFacingRef.current) => {
      setCameraBusy(true);
      setError(null);
      try {
        stopCameraTracks();
        const stream = await acquireYajCameraStream(facing);
        if (!activeRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setCameraFacing(facing);
        cameraOnRef.current = true;
        setCameraOn(true);
        await attachCameraPreview(stream);
        setCaption("Camera on — show YAJ something and talk.");
      } catch (e) {
        cameraOnRef.current = false;
        setCameraOn(false);
        setError(describeCameraError(e));
      } finally {
        setCameraBusy(false);
      }
    },
    [attachCameraPreview, stopCameraTracks],
  );

  const closeCamera = useCallback(() => {
    cameraOnRef.current = false;
    setCameraOn(false);
    stopCameraTracks();
    if (phase === "listening" && !error) {
      setCaption("Listening…");
    }
  }, [error, phase, stopCameraTracks]);

  const flipCamera = useCallback(async () => {
    if (!cameraOnRef.current || cameraBusy) return;
    const next = cameraFacingRef.current === "user" ? "environment" : "user";
    await openCamera(next);
  }, [cameraBusy, openCamera]);

  const grabVisionFrame = useCallback(async (): Promise<string | undefined> => {
    if (!cameraOnRef.current || !videoRef.current) return undefined;
    const mirror = cameraFacingRef.current === "user";
    const frame = await captureYajVisionFrame(videoRef.current, { mirror });
    return frame ?? undefined;
  }, []);

  const startListening = useCallback(async () => {
    if (!activeRef.current) return;
    setPhase("listening");
    setCaption(cameraOnRef.current ? "Camera on — show YAJ something and talk." : "Listening…");
    setError(null);
    busyRef.current = false;

    const handleTurn = async () => {
      const rec = recorderRef.current;
      recorderRef.current = null;
      if (!rec || !activeRef.current) return;
      setPhase("thinking");
      setCaption(cameraOnRef.current ? "Looking…" : "Thinking…");
      setLevel(0);
      try {
        const clip = await rec.stop();
        if (!clip) {
          void startListening();
          return;
        }
        const text = await transcribeYajAudio(clip);
        const imageDataUrl = await grabVisionFrame();
        // With camera on, allow a silent “what’s this?” turn if they showed something.
        if (!text?.trim() && !imageDataUrl) {
          void startListening();
          return;
        }
        if (!activeRef.current) return;
        const spoken = text?.trim() || "";
        setCaption(spoken ? `“${spoken}”` : "Showing camera…");
        const reply = await onSendRef.current({
          text: spoken || (imageDataUrl ? DEFAULT_VISION_PROMPT : ""),
          imageDataUrl,
        });
        if (!activeRef.current) return;
        if (!reply?.trim()) {
          void startListening();
          return;
        }
        setPhase("speaking");
        setCaption("Speaking…");
        const src = await synthesizeYajVoice(reply, getWellnessCoachVoice());
        if (!activeRef.current) return;
        playYajAudio(src, () => {
          if (activeRef.current) void startListening();
        });
      } catch (e) {
        if (!activeRef.current) return;
        setError(e instanceof Error ? e.message : "Voice mode hit a snag.");
      }
    };

    try {
      recorderRef.current = await startMicRecording({
        existingStream: streamRef.current,
        onLevel: (l) => setLevel(l),
        onSilence: () => {
          if (busyRef.current) return;
          busyRef.current = true;
          void handleTurn();
        },
      });
      // First open may reuse the gesture-acquired stream; later cycles open fresh.
      streamRef.current = null;
    } catch (e) {
      if (!activeRef.current) return;
      setError(describeMicError(e));
    }
  }, [grabVisionFrame]);

  const speakReply = useCallback(async (reply: string) => {
    setPhase("speaking");
    setCaption("Speaking…");
    const src = await synthesizeYajVoice(reply, getWellnessCoachVoice());
    if (!activeRef.current) return;
    playYajAudio(src, () => {
      if (activeRef.current) void startListening();
    });
  }, [startListening]);

  useEffect(() => {
    activeRef.current = true;
    unlockYajAudio();

    const seed = initialPrompt?.trim();
    if (seed && !seedUsedRef.current) {
      seedUsedRef.current = true;
      busyRef.current = true;
      setPhase("thinking");
      setCaption("Checking in…");
      void (async () => {
        try {
          const reply = await onSendRef.current({ text: seed });
          if (!activeRef.current) return;
          if (!reply?.trim()) {
            busyRef.current = false;
            void startListening();
            return;
          }
          await speakReply(reply);
        } catch (e) {
          if (!activeRef.current) return;
          setError(e instanceof Error ? e.message : "Couldn't start the check-in.");
          busyRef.current = false;
          void startListening();
        }
      })();
    } else {
      void startListening();
    }

    return () => {
      activeRef.current = false;
      recorderRef.current?.cancel();
      recorderRef.current = null;
      stopYajAudio();
      // Don't stop streamRef here — retry remounts this effect and would
      // kill a freshly acquired gesture stream. Parent + recorder teardown own tracks.
    };
  }, [startListening, retryKey, initialPrompt, speakReply]);

  useEffect(() => {
    return () => {
      cameraOnRef.current = false;
      stopCameraTracks();
    };
  }, [stopCameraTracks]);

  const pulseBoost = useMemo(() => {
    if (phase === "thinking") return 1;
    if (phase === "speaking") return 0.55 + level * 0.4;
    return 0.35 + level * 0.9;
  }, [phase, level]);

  const retryMic = async () => {
    setError(null);
    try {
      // Must run in this tap so browsers grant mic in a user gesture.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      setRetryKey((k) => k + 1);
    } catch (e) {
      setError(describeMicError(e));
    }
  };

  const toggleCamera = () => {
    if (cameraBusy) return;
    if (cameraOn) {
      closeCamera();
    } else {
      void openCamera();
    }
  };

  /** Capture current frame and ask YAJ without waiting for more speech. */
  const askAboutCamera = async () => {
    if (!cameraOn || busyRef.current || phase === "thinking" || phase === "speaking") return;
    busyRef.current = true;
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setPhase("thinking");
    setCaption("Looking…");
    setLevel(0);
    try {
      const imageDataUrl = await grabVisionFrame();
      if (!imageDataUrl) {
        setError("Couldn't capture from the camera. Try again.");
        busyRef.current = false;
        void startListening();
        return;
      }
      setCaption("Showing camera…");
      const reply = await onSendRef.current({
        text: DEFAULT_VISION_PROMPT,
        imageDataUrl,
      });
      if (!activeRef.current) return;
      if (!reply?.trim()) {
        void startListening();
        return;
      }
      setPhase("speaking");
      setCaption("Speaking…");
      const src = await synthesizeYajVoice(reply, getWellnessCoachVoice());
      if (!activeRef.current) return;
      playYajAudio(src, () => {
        if (activeRef.current) void startListening();
      });
    } catch (e) {
      if (!activeRef.current) return;
      setError(e instanceof Error ? e.message : "Couldn't ask about the camera.");
      busyRef.current = false;
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col ${
        cameraOn ? "bg-black" : "bg-background"
      }`}
    >
      <style>{`
        @keyframes yaj-star-blink {
          0%, 100% { opacity: 0.35; transform: scale(0.82) rotate(0deg); }
          40% { opacity: 1; transform: scale(1.08) rotate(8deg); }
          70% { opacity: 0.7; transform: scale(0.95) rotate(-4deg); }
        }
        @keyframes yaj-star-think {
          0%, 100% { opacity: 0.25; transform: scale(0.75); }
          50% { opacity: 1; transform: scale(1.18); }
        }
      `}</style>

      {/* Live camera — full-bleed when on (Gemini-style show-and-tell) */}
      <video
        ref={videoRef}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity ${
          cameraOn ? "opacity-100" : "pointer-events-none opacity-0"
        } ${cameraFacing === "user" ? "scale-x-[-1]" : ""}`}
        playsInline
        muted
        autoPlay
      />
      {cameraOn && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/70" />
      )}

      {cameraOn && (
        <button
          type="button"
          onClick={() => void flipCamera()}
          disabled={cameraBusy}
          className="absolute left-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white transition-colors hover:bg-black/55 disabled:opacity-50"
          aria-label="Flip camera"
        >
          <SwitchCamera className="h-5 w-5" />
        </button>
      )}

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-28 pt-12">
        {/* Stars — shrink slightly when camera is the main visual */}
        <div
          className={`relative transition-all duration-300 ${
            cameraOn ? "h-28 w-28 opacity-90" : "h-56 w-56"
          }`}
          aria-hidden
        >
          <div
            className="pointer-events-none absolute inset-6 rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.12),transparent_70%)]"
            style={{ opacity: 0.5 + pulseBoost * 0.35 }}
          />
          {STARS.map((star) => {
            const size = cameraOn ? Math.round(star.size * 0.55) : star.size;
            return (
              <div
                key={star.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: star.x,
                  top: star.y,
                  animationName: phase === "thinking" ? "yaj-star-think" : "yaj-star-blink",
                  animationDuration: phase === "thinking" ? "0.85s" : star.duration,
                  animationTimingFunction: "ease-in-out",
                  animationIterationCount: "infinite",
                  animationDelay: star.delay,
                  filter: `drop-shadow(0 0 ${phase === "thinking" ? 14 : 8 + pulseBoost * 10}px ${star.glow})`,
                }}
              >
                <FourPointStar color={star.color} size={size} />
              </div>
            );
          })}
        </div>

        <div className="mt-8 min-h-[64px] max-w-md text-center">
          {error ? (
            <div className="space-y-3">
              <p className={`text-sm ${cameraOn ? "text-red-300" : "text-destructive"}`}>{error}</p>
              <button
                type="button"
                onClick={() => void retryMic()}
                className={`rounded-full border px-4 py-2 text-xs font-semibold ${
                  cameraOn
                    ? "border-white/30 bg-black/40 text-white"
                    : "border-border bg-card text-foreground"
                }`}
              >
                Tap to enable microphone
              </button>
            </div>
          ) : (
            <p className={`text-sm leading-relaxed ${cameraOn ? "text-white/90" : "text-muted-foreground"}`}>
              {caption}
            </p>
          )}
        </div>

        {cameraOn && phase === "listening" && !error && (
          <button
            type="button"
            onClick={() => void askAboutCamera()}
            className="mt-4 rounded-full border border-white/30 bg-white/15 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
          >
            What am I showing?
          </button>
        )}
      </div>

      {/* Gemini-style bottom bar: camera · status · end */}
      <div className="absolute inset-x-0 bottom-0 z-20 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <div className="mx-auto flex max-w-md items-center justify-between gap-4">
          <button
            type="button"
            onClick={toggleCamera}
            disabled={cameraBusy}
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-all disabled:opacity-50 ${
              cameraOn
                ? "bg-sky-400 text-slate-900 shadow-[0_0_24px_rgba(56,189,248,0.55)]"
                : "border border-border bg-card text-foreground hover:border-sky-400/50 hover:text-sky-500"
            }`}
            aria-label={cameraOn ? "Turn camera off" : "Open camera"}
            aria-pressed={cameraOn}
          >
            {cameraBusy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" strokeWidth={2.25} />}
          </button>

          <div
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full px-4 py-3 ${
              cameraOn ? "bg-white/10 text-white backdrop-blur-md" : "border border-border bg-card text-muted-foreground"
            }`}
          >
            <div className="flex items-center gap-2 text-[11px]">
              {phase === "thinking" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mic className="h-3.5 w-3.5" />
              )}
              <span className="truncate font-medium">
                {cameraOn ? "Show & talk — YAJ can see" : "Just talk — YAJ answers out loud"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-colors ${
              cameraOn
                ? "border border-white/25 bg-black/45 text-white hover:bg-black/60"
                : "border border-border bg-card text-foreground hover:text-destructive"
            }`}
            aria-label="End voice chat"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default YajVoiceMode;
