import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";

interface Props {
  stream: MediaStream | null;
  label?: string;
  muted?: boolean;
}

/** Live mic input meter (0–100). Green / Amber / Red zones. */
export default function MicLevelMeter({ stream, label = "Mic Level", muted }: Props) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || muted) {
      setLevel(0);
      return;
    }
    const track = stream.getAudioTracks()[0];
    if (!track) return;

    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new AudioCtx();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);

    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      const pct = Math.min(100, Math.round(rms * 240));
      setLevel(pct);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { src.disconnect(); } catch {}
      try { ctx.close(); } catch {}
    };
  }, [stream, muted]);

  // Segmented meter, 20 bars.
  const segments = 20;
  const filled = Math.round((level / 100) * segments);

  return (
    <div className="studio-card-inset px-3 py-2 w-full">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[hsl(var(--studio-text-muted))]">
          <Mic className="w-3 h-3" /> {label}
        </div>
        <div className="text-[10px] tabular-nums text-[hsl(var(--studio-text-dim))]">
          {muted ? "MUTED" : `${level}%`}
        </div>
      </div>
      <div className="flex items-center gap-[2px] h-3">
        {Array.from({ length: segments }).map((_, i) => {
          const on = i < filled;
          const color =
            i < segments * 0.6 ? "hsl(var(--studio-green))"
            : i < segments * 0.85 ? "hsl(var(--studio-amber))"
            : "hsl(var(--studio-red))";
          return (
            <div
              key={i}
              className="flex-1 h-full rounded-sm transition-opacity"
              style={{
                background: color,
                opacity: on ? 1 : 0.15,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
