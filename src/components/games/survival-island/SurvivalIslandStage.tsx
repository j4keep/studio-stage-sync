import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { IslandInput, IslandState, NO_INPUT, initialIsland, step } from "@/lib/survival-island/engine";
import { IslandScore, scoreIsland } from "@/lib/survival-island/score";
import {
  islandAmbienceStart,
  islandAmbienceStop,
  islandSetMuted,
  islandSfx,
  islandWindLevel,
} from "@/lib/survival-island-sfx";
import { Camera, drawIsland, makeCamera } from "./render";
import IslandHud from "./IslandHud";
import IslandControls from "./IslandControls";
import SurvivalIslandAvatar from "./SurvivalIslandAvatar";

export type IslandOutcome = IslandScore & {
  survived: boolean;
  hearts: number;
  wave: number;
  reason: "survived" | "hearts";
  lines: { label: string; value: number }[];
};

type Props = {
  runKey: number;
  best: number | null;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  onEnd: (outcome: IslandOutcome) => void;
};

/** The live island: fixed-step survival engine, canvas render, HUD and one stick. */
export default function SurvivalIslandStage({ runKey, best, muted, onToggleMute, onBack, onEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stRef = useRef<IslandState>(initialIsland());
  const camRef = useRef<Camera | undefined>(undefined);
  const inputRef = useRef<IslandInput>({ ...NO_INPUT });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const endedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    islandSetMuted(muted);
    if (!muted) islandAmbienceStart();
  }, [muted]);

  useEffect(() => {
    stRef.current = initialIsland();
    camRef.current = undefined;
    endedRef.current = false;
    setPaused(false);
    islandSfx.unlock();
    islandAmbienceStart();
    return () => islandAmbienceStop();
  }, [runKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      const g = canvas.getContext("2d");
      if (g) g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const g = canvas.getContext("2d");
      if (!g) return;
      const rect = canvas.getBoundingClientRect();
      const dt = lastRef.current ? Math.min(80, now - lastRef.current) : 16;
      lastRef.current = now;

      const st = stRef.current;
      if (!paused && st.status === "alive") {
        const next = step(st, inputRef.current, dt);
        stRef.current = next;
        for (const ev of next.events) {
          if (ev === "star") islandSfx.star();
          else if (ev === "power") islandSfx.power();
          else if (ev === "heart") islandSfx.heart();
          else if (ev === "coconut") islandSfx.coconut();
          else if (ev === "crate") islandSfx.crate();
          else if (ev === "warn") islandSfx.warn();
          else if (ev === "hit") islandSfx.hit();
          else if (ev === "splash") islandSfx.splash();
          else if (ev === "wind") islandSfx.wind();
          else if (ev === "collapse") islandSfx.collapse();
          else if (ev === "wave") islandSfx.waveStart();
          else if (ev === "objective") islandSfx.objective();
          else if (ev === "timer") islandSfx.timerWarning();
        }
        islandWindLevel(next.wind.active ? 1 : 0);

        if (next.status !== "alive" && !endedRef.current) {
          endedRef.current = true;
          if (next.status === "survived") islandSfx.victory();
          else islandSfx.failed();
          islandAmbienceStop();
          onEnd(buildOutcome(next));
        }
      }

      camRef.current = makeCamera(stRef.current, rect.width, rect.height, camRef.current);
      drawIsland(g, stRef.current, camRef.current, rect.width, rect.height);
      setTick((t) => (t + 1) % 1_000_000);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = 0;
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
    };
  }, [paused, runKey, onEnd]);

  const st = stRef.current;

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0b2b42]">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />
      <SurvivalIslandAvatar stateRef={stRef} cameraRef={camRef} />

      <IslandHud
        st={st}
        best={best}
        muted={muted}
        onToggleMute={onToggleMute}
        onPause={() => setPaused((p) => !p)}
        onBack={onBack}
      />

      {!paused && st.status === "alive" && <IslandControls input={inputRef} />}

      {paused && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center backdrop-blur-sm">
          <p className="text-2xl font-black uppercase tracking-widest text-white">Paused</p>
          <p className="max-w-[300px] text-xs text-white/60">
            Drag anywhere to move. Watch the ground shadows, run uphill when the water rises, grab stars and
            power-ups, and survive until the timer hits zero.
          </p>
          <button
            type="button"
            onClick={() => setPaused(false)}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-black text-primary-foreground"
          >
            <Play className="h-4 w-4" /> Resume survival
          </button>
          <button type="button" onClick={onBack} className="text-xs font-bold text-white/60 underline">
            Leave the island
          </button>
        </div>
      )}
    </div>
  );
}

function buildOutcome(st: IslandState): IslandOutcome {
  const score = scoreIsland(st);
  return {
    ...score,
    survived: st.status === "survived",
    hearts: st.hearts,
    wave: st.wave,
    reason: st.status === "survived" ? "survived" : "hearts",
    lines: [
      { label: "Time survived", value: score.survivedPoints },
      { label: "Stars", value: score.stars },
      { label: "Star points", value: score.starPoints },
      { label: "Hazards dodged", value: score.avoided },
      { label: "Hearts left", value: score.heartBonus },
      { label: "Bonus goals", value: score.objectivePoints },
      { label: "Survival bonus", value: score.survivalBonus },
      { label: "Total", value: score.total },
    ],
  };
}
