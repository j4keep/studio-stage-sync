import { useRef, useEffect, useCallback } from "react";

interface AudioEqualizerBackgroundProps {
  mediaElement: HTMLMediaElement | null;
  isPlaying: boolean;
}

const BAR_COUNT = 48;

// Shared AudioContext + source cache to avoid re-creating sources
const audioCtxCache = {
  ctx: null as AudioContext | null,
  sources: new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>(),
};

const getOrCreateSource = (el: HTMLMediaElement): { ctx: AudioContext; source: MediaElementAudioSourceNode } => {
  if (!audioCtxCache.ctx) {
    audioCtxCache.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  const ctx = audioCtxCache.ctx;
  let source = audioCtxCache.sources.get(el);
  if (!source) {
    source = ctx.createMediaElementSource(el);
    // Connect source directly to destination so audio always plays
    source.connect(ctx.destination);
    audioCtxCache.sources.set(el, source);
  }
  return { ctx, source };
};

const AudioEqualizerBackground = ({ mediaElement, isPlaying }: AudioEqualizerBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef<number>(0);
  const lastElementRef = useRef<HTMLMediaElement | null>(null);

  const connect = useCallback(() => {
    if (!mediaElement) return;

    // If same element, already connected
    if (mediaElement === lastElementRef.current && analyserRef.current) return;

    try {
      const { ctx, source } = getOrCreateSource(mediaElement);

      // Disconnect old analyser if any
      if (analyserRef.current) {
        try { analyserRef.current.disconnect(); } catch {}
      }

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      // analyser doesn't need to connect to destination; source already does

      analyserRef.current = analyser;
      lastElementRef.current = mediaElement;

      if (ctx.state === "suspended") {
        ctx.resume();
      }
    } catch {
      /* already connected or unsupported */
    }
  }, [mediaElement]);

  useEffect(() => {
    if (mediaElement) {
      connect();
    }
  }, [mediaElement, connect]);

  // Resume AudioContext on play (needed for autoplay policy)
  useEffect(() => {
    if (isPlaying && audioCtxCache.ctx?.state === "suspended") {
      audioCtxCache.ctx.resume();
    }
  }, [isPlaying]);

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
      frameRef.current = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;
      c.clearRect(0, 0, w, h);

      let barData: number[] = [];

      if (analyser && dataArray && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
        const step = Math.floor(dataArray.length / BAR_COUNT);
        for (let i = 0; i < BAR_COUNT; i++) {
          barData.push(dataArray[i * step] / 255);
        }
      } else {
        idlePhase += 0.01;
        for (let i = 0; i < BAR_COUNT; i++) {
          barData.push(0.08 + Math.sin(idlePhase + i * 0.25) * 0.06);
        }
      }

      const barW = w / BAR_COUNT;
      const maxH = h * 0.7;

      for (let i = 0; i < BAR_COUNT; i++) {
        const barH = barData[i] * maxH;
        const x = i * barW;
        const y = h - barH;

        const grad = c.createLinearGradient(x, y, x, h);
        grad.addColorStop(0, `hsla(260, 80%, 65%, ${0.25 + barData[i] * 0.35})`);
        grad.addColorStop(1, `hsla(260, 80%, 65%, 0.02)`);

        c.fillStyle = grad;
        c.fillRect(x + 1, y, barW - 2, barH);
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [isPlaying, analyserRef.current]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-50"
      style={{ mixBlendMode: "screen" }}
    />
  );
};

export default AudioEqualizerBackground;
