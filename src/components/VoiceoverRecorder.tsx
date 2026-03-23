import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Play, Square, RotateCcw, Check, Volume2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface Props {
  mediaFile: File;
  mediaType: "audio" | "video";
  onMixedFile: (file: File) => void;
  onCancel: () => void;
}

const VoiceoverRecorder = ({ mediaFile, mediaType, onMixedFile, onCancel }: Props) => {
  const [state, setState] = useState<"idle" | "recording" | "preview" | "mixing">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [micVolume, setMicVolume] = useState(80);
  const [trackVolume, setTrackVolume] = useState(60);
  const [mixedUrl, setMixedUrl] = useState<string | null>(null);

  const mediaUrlRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaElRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const micGainRef = useRef<GainNode | null>(null);
  const trackGainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const mixedBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    mediaUrlRef.current = URL.createObjectURL(mediaFile);
    return () => {
      if (mediaUrlRef.current) URL.revokeObjectURL(mediaUrlRef.current);
      if (mixedUrl) URL.revokeObjectURL(mixedUrl);
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    mediaElRef.current?.pause();
    if (audioCtxRef.current?.state !== "closed") {
      try { audioCtxRef.current?.close(); } catch {}
    }
    audioCtxRef.current = null;
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      chunksRef.current = [];
      setElapsed(0);

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = micStream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      // Create media element for the track
      const el = document.createElement("audio");
      el.src = mediaUrlRef.current!;
      el.crossOrigin = "anonymous";
      mediaElRef.current = el;

      const trackSource = ctx.createMediaElementSource(el);
      const micSource = ctx.createMediaStreamSource(micStream);

      const trackGain = ctx.createGain();
      trackGain.gain.value = trackVolume / 100;
      trackGainRef.current = trackGain;

      const micGain = ctx.createGain();
      micGain.gain.value = micVolume / 100;
      micGainRef.current = micGain;

      // Mix destination
      const dest = ctx.createMediaStreamDestination();

      trackSource.connect(trackGain).connect(dest);
      micSource.connect(micGain).connect(dest);

      // Also connect track to speakers so user hears it
      trackGain.connect(ctx.destination);

      const recorder = new MediaRecorder(dest.stream, { mimeType: "audio/webm" });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        mixedBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        if (mixedUrl) URL.revokeObjectURL(mixedUrl);
        setMixedUrl(url);
        setState("preview");
      };

      recorder.start(100);

      // Play the track
      await el.play();

      // When track ends, stop recording
      el.onended = () => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
        cleanup();
      };

      // Timer
      timerRef.current = window.setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);

      setState("recording");
    } catch (err: any) {
      console.error("Mic access error:", err);
      alert("Please allow microphone access to record a voiceover.");
    }
  }, [trackVolume, micVolume, cleanup]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    mediaElRef.current?.pause();
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  const resetRecording = useCallback(() => {
    if (mixedUrl) URL.revokeObjectURL(mixedUrl);
    setMixedUrl(null);
    mixedBlobRef.current = null;
    setElapsed(0);
    setState("idle");
  }, [mixedUrl]);

  const confirmMix = useCallback(() => {
    if (!mixedBlobRef.current) return;
    setState("mixing");
    const ext = "webm";
    const file = new File([mixedBlobRef.current], `voiceover-mix-${Date.now()}.${ext}`, {
      type: "audio/webm",
    });
    onMixedFile(file);
  }, [onMixedFile]);

  // Update gains live
  useEffect(() => {
    if (micGainRef.current) micGainRef.current.gain.value = micVolume / 100;
  }, [micVolume]);

  useEffect(() => {
    if (trackGainRef.current) trackGainRef.current.gain.value = trackVolume / 100;
  }, [trackVolume]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Mic className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Voiceover Recording</h3>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Record your voice live over your {mediaType}. Your track will play while you record — the final mix replaces your upload.
      </p>

      {/* Volume controls — visible in idle & recording */}
      {(state === "idle" || state === "recording") && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
              <Mic className="w-3 h-3" /> Mic Volume
            </label>
            <div className="flex items-center gap-2">
              <Slider value={[micVolume]} onValueChange={v => setMicVolume(v[0])} min={0} max={100} step={1} className="flex-1" />
              <span className="text-[10px] font-bold text-primary w-8 text-right">{micVolume}%</span>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
              <Volume2 className="w-3 h-3" /> Track Volume
            </label>
            <div className="flex items-center gap-2">
              <Slider value={[trackVolume]} onValueChange={v => setTrackVolume(v[0])} min={0} max={100} step={1} className="flex-1" />
              <span className="text-[10px] font-bold text-primary w-8 text-right">{trackVolume}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Recording state indicator */}
      {state === "recording" && (
        <div className="flex items-center justify-center gap-3 py-3">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-bold text-red-500">Recording {formatTime(elapsed)}</span>
        </div>
      )}

      {/* Preview */}
      {state === "preview" && mixedUrl && (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground">Preview your voiceover mix:</p>
          <audio src={mixedUrl} controls className="w-full h-8" />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {state === "idle" && (
          <>
            <button onClick={startRecording} className="flex-1 py-2.5 rounded-lg gradient-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5">
              <Mic className="w-3.5 h-3.5" /> Start Recording
            </button>
            <button onClick={onCancel} className="px-4 py-2.5 rounded-lg bg-muted text-muted-foreground text-xs font-bold">
              Cancel
            </button>
          </>
        )}

        {state === "recording" && (
          <button onClick={stopRecording} className="flex-1 py-2.5 rounded-lg bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-1.5">
            <Square className="w-3.5 h-3.5" /> Stop
          </button>
        )}

        {state === "preview" && (
          <>
            <button onClick={resetRecording} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> Redo
            </button>
            <button onClick={confirmMix} className="flex-1 py-2.5 rounded-lg gradient-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Use This Mix
            </button>
          </>
        )}

        {state === "mixing" && (
          <div className="flex-1 py-2.5 text-center text-xs text-muted-foreground font-bold">Applying...</div>
        )}
      </div>
    </div>
  );
};

export default VoiceoverRecorder;
