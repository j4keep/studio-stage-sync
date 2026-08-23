import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { NO_INPUT, SnakeInput, SnakeRoyaleState, initialSnakeRoyale, step } from "@/lib/snake-royale/engine";
import { SnakeRoyaleScore, scoreSnakeRoyale } from "@/lib/snake-royale/score";
import {
  snakeRoyaleAmbienceStart,
  snakeRoyaleAmbienceStop,
  snakeRoyaleSetMuted,
  snakeRoyaleSfx,
} from "@/lib/snake-royale-sfx";
import { Camera, drawJungle, makeCamera } from "./render";
import SnakeRoyaleHud from "./SnakeRoyaleHud";
import SnakeRoyaleControls from "./SnakeRoyaleControls";
import SnakeRoyaleActors from "./SnakeRoyaleActors";

export type SnakeRoyaleOutcome = SnakeRoyaleScore & {
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
  onQuit?: () => void;
  onEnd: (outcome: SnakeRoyaleOutcome) => void;
  /** Solo mode: endless jungle run — no win-by-timer, only hearts or a manual quit end it. */
  endless?: boolean;
};

/** The live jungle: fixed-step survival engine, canvas render, r3f actor overlay, HUD
 *  and one stick — mirrors SurvivalIslandStage.tsx's structure exactly. */
export default function SnakeRoyaleStage({ runKey, best, muted, onToggleMute, onBack, onQuit, onEnd, endless }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stRef = useRef<SnakeRoyaleState>(initialSnakeRoyale(undefined, endless));
  const camRef = useRef<Camera | undefined>(undefined);
  const inputRef = useRef<SnakeInput>({ ...NO_INPUT });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const endedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [, setTick] = useState(0);
  const [snakeIds, setSnakeIds] = useState<number[]>([]);
  const snakeIdsRef = useRef<number[]>([]);

  useEffect(() => {
    snakeRoyaleSetMuted(muted);
    if (!muted) snakeRoyaleAmbienceStart();
  }, [muted]);

  useEffect(() => {
    stRef.current = initialSnakeRoyale(undefined, endless);
    camRef.current = undefined;
    endedRef.current = false;
    setPaused(false);
    snakeIdsRef.current = [];
    setSnakeIds([]);
    snakeRoyaleSfx.unlock();
    snakeRoyaleAmbienceStart();
    return () => snakeRoyaleAmbienceStop();
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
          if (ev === "star") snakeRoyaleSfx.star();
          else if (ev === "hiss") snakeRoyaleSfx.hiss();
          else if (ev === "strike") {
            /* the actual hit sound only plays on a real hit, see "hit" below */
          } else if (ev === "hit") snakeRoyaleSfx.bite();
          else if (ev === "splash") snakeRoyaleSfx.splash();
          else if (ev === "mud") snakeRoyaleSfx.mud();
          else if (ev === "rock") snakeRoyaleSfx.rock();
          else if (ev === "branch") snakeRoyaleSfx.branch();
          else if (ev === "warn") snakeRoyaleSfx.warn();
          else if (ev === "wave") snakeRoyaleSfx.wave();
          else if (ev === "objective") snakeRoyaleSfx.objective();
          else if (ev === "timer") snakeRoyaleSfx.timer();
          else if (ev === "weapon") snakeRoyaleSfx.objective();
          else if (ev === "attack") snakeRoyaleSfx.branch();
          else if (ev === "animal") snakeRoyaleSfx.bite();
          else if (ev === "jeep") snakeRoyaleSfx.objective();
          else if (ev === "escape") snakeRoyaleSfx.win();
        }

        const ids = next.snakes.map((s) => s.id);
        const prev = snakeIdsRef.current;
        if (ids.length !== prev.length || ids.some((id) => !prev.includes(id))) {
          snakeIdsRef.current = ids;
          setSnakeIds(ids);
        }

        if (next.status !== "alive" && !endedRef.current) {
          endedRef.current = true;
          if (next.status === "survived") snakeRoyaleSfx.win();
          else snakeRoyaleSfx.gameOver();
          snakeRoyaleAmbienceStop();
          onEnd(buildOutcome(next));
        }
      }

      camRef.current = makeCamera(stRef.current, rect.width, rect.height, camRef.current);
      drawJungle(g, stRef.current, camRef.current, rect.width, rect.height);
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
    <div className="absolute inset-0 overflow-hidden bg-[#0e2a17]">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />
      <SnakeRoyaleActors stateRef={stRef} cameraRef={camRef} snakeIds={snakeIds} />

      <SnakeRoyaleHud
        st={st}
        best={best}
        muted={muted}
        onToggleMute={onToggleMute}
        onPause={() => setPaused((p) => !p)}
        onBack={onBack}
        onQuit={onQuit}
      />

      {!paused && st.status === "alive" && <SnakeRoyaleControls input={inputRef} />}

      {paused && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center backdrop-blur-sm">
          <p className="text-2xl font-black uppercase tracking-widest text-white">Paused</p>
          <p className="max-w-[300px] text-xs text-white/60">
            Drag anywhere to move. Find a defense tool, fight off snakes and predators, cross the river,
            reach the abandoned camp, and escape in the jeep.
          </p>
          <button
            type="button"
            onClick={() => setPaused(false)}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-black text-primary-foreground"
          >
            <Play className="h-4 w-4" /> Resume run
          </button>
          <button type="button" onClick={onBack} className="text-xs font-bold text-white/60 underline">
            Leave the jungle
          </button>
        </div>
      )}
    </div>
  );
}

function buildOutcome(st: SnakeRoyaleState): SnakeRoyaleOutcome {
  const score = scoreSnakeRoyale(st);
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
      { label: "Hazards dodged", value: score.dodged },
      { label: "Hearts left", value: score.heartBonus },
      { label: "Bonus goals", value: score.objectivePoints },
      { label: "Survival bonus", value: score.survivalBonus },
      { label: "Total", value: score.total },
    ],
  };
}
