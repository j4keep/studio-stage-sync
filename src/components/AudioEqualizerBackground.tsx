import { useRef, useEffect, useState, useCallback } from "react";

interface AudioEqualizerBackgroundProps {
  mediaElement: HTMLMediaElement | null;
  isPlaying: boolean;
}

const BAR_COUNT = 48;

const AudioEqualizerBackground = ({ mediaElement, isPlaying }: AudioEqualizerBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number>(0);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (!mediaElement || connected) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      const source = ctx.createMediaElementSource(mediaElement);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      setConnected(true);
    } catch {
      /* already connected or unsupported */
    }
  }, [mediaElement, connected]);

  useEffect(() => {
    if (isPlaying && mediaElement && !connected) {
      connect();
    }
  }, [isPlaying, mediaElement, connected, connect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext("2d");
    if (!c) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
    };
    resize();
    window.addEventListener("resize", resize);

    const analyser = analyserRef.current;
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    /* Idle animation fallback */
    let idlePhase = 0;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      c.clearRect(0, 0, w, h);

      const barW = w / BAR_COUNT;
      const gap = 2;

      if (analyser && dataArray && isPlaying) {
        analyser.getByteFrequencyData(dataArray);

        for (let i = 0; i < BAR_COUNT; i++) {
          const idx = Math.floor((i / BAR_COUNT) * dataArray.length);
          const val = dataArray[idx] / 255;
          const barH = Math.max(4, val * h * 0.6);

          /* Gradient from primary color (bottom) to transparent (top) */
          const grad = c.createLinearGradient(0, h, 0, h - barH);
          grad.addColorStop(0, "hsla(204, 100%, 50%, 0.35)");
          grad.addColorStop(0.5, "hsla(204, 100%, 50%, 0.15)");
          grad.addColorStop(1, "hsla(204, 100%, 50%, 0.02)");

          c.fillStyle = grad;
          c.beginPath();
          c.roundRect(i * barW + gap / 2, h - barH, barW - gap, barH, [4, 4, 0, 0]);
          c.fill();
        }
      } else {
        /* Idle gentle wave */
        idlePhase += 0.02;
        for (let i = 0; i < BAR_COUNT; i++) {
          const val = 0.08 + Math.sin(idlePhase + i * 0.3) * 0.05;
          const barH = val * h;
          const grad = c.createLinearGradient(0, h, 0, h - barH);
          grad.addColorStop(0, "hsla(204, 100%, 50%, 0.12)");
          grad.addColorStop(1, "hsla(204, 100%, 50%, 0.02)");
          c.fillStyle = grad;
          c.beginPath();
          c.roundRect(i * barW + gap / 2, h - barH, barW - gap, barH, [4, 4, 0, 0]);
          c.fill();
        }
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [isPlaying, connected]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      style={{ opacity: 0.9 }}
    />
  );
};

export default AudioEqualizerBackground;
