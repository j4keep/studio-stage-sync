import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Mic, Loader2 } from "lucide-react";
import {
  startMicRecording,
  transcribeYajAudio,
  synthesizeYajVoice,
  playYajAudio,
  stopYajAudio,
  unlockYajAudio,
  describeMicError,
  type MicRecorder,
} from "@/lib/yaj-media";

type Phase = "listening" | "thinking" | "speaking";

type Props = {
  /** Sends the spoken text into the chat and resolves with YAJ's reply. */
  onSend: (text: string) => Promise<string>;
  onClose: () => void;
  /** Mic stream acquired during the user tap that opened voice mode (iOS-safe). */
  initialStream?: MediaStream | null;
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
 * talking, replies out loud, then listens again.
 */
const YajVoiceMode = ({ onSend, onClose, initialStream = null }: Props) => {
  const [phase, setPhase] = useState<Phase>("listening");
  const [level, setLevel] = useState(0);
  const [caption, setCaption] = useState("Listening…");
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const recorderRef = useRef<MicRecorder | null>(null);
  const activeRef = useRef(true);
  const busyRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(initialStream);
  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;

  const startListening = useCallback(async () => {
    if (!activeRef.current) return;
    setPhase("listening");
    setCaption("Listening…");
    setError(null);
    busyRef.current = false;

    const handleTurn = async () => {
      const rec = recorderRef.current;
      recorderRef.current = null;
      if (!rec || !activeRef.current) return;
      setPhase("thinking");
      setCaption("Thinking…");
      setLevel(0);
      try {
        const clip = await rec.stop();
        if (!clip) {
          void startListening();
          return;
        }
        const text = await transcribeYajAudio(clip);
        if (!text?.trim()) {
          void startListening();
          return;
        }
        if (!activeRef.current) return;
        setCaption(`“${text.trim()}”`);
        const reply = await onSendRef.current(text.trim());
        if (!activeRef.current) return;
        if (!reply?.trim()) {
          void startListening();
          return;
        }
        setPhase("speaking");
        setCaption("Speaking…");
        const src = await synthesizeYajVoice(reply);
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
  }, []);

  useEffect(() => {
    activeRef.current = true;
    unlockYajAudio();
    void startListening();

    return () => {
      activeRef.current = false;
      recorderRef.current?.cancel();
      recorderRef.current = null;
      stopYajAudio();
      // Don't stop streamRef here — retry remounts this effect and would
      // kill a freshly acquired gesture stream. Parent + recorder teardown own tracks.
    };
  }, [startListening, retryKey]);

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

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background px-6">
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

      <button
        onClick={onClose}
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Close voice mode"
      >
        <X className="h-5 w-5" />
      </button>

      {/* YAJ stars speaking area — replaces the round gradient orb */}
      <div className="relative h-56 w-56" aria-hidden>
        <div
          className="pointer-events-none absolute inset-6 rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.12),transparent_70%)]"
          style={{ opacity: 0.5 + pulseBoost * 0.35 }}
        />
        {STARS.map((star) => (
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
            <FourPointStar color={star.color} size={star.size} />
          </div>
        ))}
      </div>

      <div className="mt-10 min-h-[64px] max-w-md text-center">
        {error ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <button
              type="button"
              onClick={() => void retryMic()}
              className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground"
            >
              Tap to enable microphone
            </button>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">{caption}</p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
        {phase === "thinking" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
        Just talk — YAJ answers out loud.
      </div>

      <button
        onClick={onClose}
        className="mt-10 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground"
      >
        End voice chat
      </button>
    </div>
  );
};

export default YajVoiceMode;
