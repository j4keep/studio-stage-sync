import { useEffect, useRef, useState } from "react";
import { X, Mic, Loader2 } from "lucide-react";
import {
  startMicRecording,
  transcribeYajAudio,
  synthesizeYajVoice,
  playYajAudio,
  stopYajAudio,
  unlockYajAudio,
  type MicRecorder,
} from "@/lib/yaj-media";

type Phase = "listening" | "thinking" | "speaking";

type Props = {
  /** Sends the spoken text into the chat and resolves with YAJ Buddy's reply. */
  onSend: (text: string) => Promise<string>;
  onClose: () => void;
};

/**
 * Full-screen hands-free voice conversation. Listens, detects when you stop
 * talking, replies out loud, then listens again — no buttons needed.
 * Every turn is written into the normal chat transcript by the parent.
 */
const YajVoiceMode = ({ onSend, onClose }: Props) => {
  const [phase, setPhase] = useState<Phase>("listening");
  const [level, setLevel] = useState(0);
  const [caption, setCaption] = useState("Listening…");
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MicRecorder | null>(null);
  const activeRef = useRef(true);
  const busyRef = useRef(false);
  const loopRef = useRef<() => Promise<void>>();

  useEffect(() => {
    activeRef.current = true;
    unlockYajAudio();

    const listen = async () => {
      if (!activeRef.current) return;
      setPhase("listening");
      setCaption("Listening…");
      busyRef.current = false;
      try {
        recorderRef.current = await startMicRecording({
          onLevel: (l) => setLevel(l),
          onSilence: () => {
            if (busyRef.current) return;
            busyRef.current = true;
            void handleTurn();
          },
        });
      } catch {
        setError("Microphone access is needed for voice mode.");
      }
    };

    const handleTurn = async () => {
      const rec = recorderRef.current;
      recorderRef.current = null;
      if (!rec || !activeRef.current) return;
      setPhase("thinking");
      setCaption("Thinking…");
      setLevel(0);
      try {
        const clip = await rec.stop();
        if (!clip) return void listen();
        const text = await transcribeYajAudio(clip);
        if (!text?.trim()) return void listen();
        if (!activeRef.current) return;
        setCaption(`“${text.trim()}”`);
        const reply = await onSend(text.trim());
        if (!activeRef.current) return;
        if (!reply?.trim()) return void listen();
        setPhase("speaking");
        setCaption("Speaking…");
        const src = await synthesizeYajVoice(reply);
        if (!activeRef.current) return;
        playYajAudio(src, () => {
          if (activeRef.current) void listen();
        });
      } catch (e) {
        if (!activeRef.current) return;
        setError(e instanceof Error ? e.message : "Voice mode hit a snag.");
      }
    };

    loopRef.current = listen;
    void listen();

    return () => {
      activeRef.current = false;
      recorderRef.current?.cancel();
      recorderRef.current = null;
      stopYajAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orbScale = 1 + (phase === "listening" ? level * 0.35 : phase === "speaking" ? 0.12 : 0.04);

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center px-6">
      <button
        onClick={onClose}
        className="absolute top-5 right-5 w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Close voice mode"
      >
        <X className="w-5 h-5" />
      </button>

      <div
        className="w-52 h-52 rounded-full gradient-primary transition-transform duration-150 ease-out shadow-2xl"
        style={{ transform: `scale(${orbScale})`, opacity: phase === "thinking" ? 0.6 : 1 }}
      />

      <div className="mt-12 text-center min-h-[64px] max-w-md">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed">{caption}</p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
        {phase === "thinking" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
        Just talk — YAJ Buddy answers out loud.
      </div>

      <button
        onClick={onClose}
        className="mt-10 px-5 py-2.5 rounded-full bg-card border border-border text-sm font-medium text-foreground"
      >
        End voice chat
      </button>
    </div>
  );
};

export default YajVoiceMode;
