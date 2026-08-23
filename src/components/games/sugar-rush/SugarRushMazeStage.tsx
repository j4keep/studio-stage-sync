import { useEffect, useRef, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import {
  NO_INPUT,
  SugarRushInput,
  SugarRushMazeState,
  SugarRushScore,
  initialSugarRushMaze,
  cavityWorldPos,
  playerWorldPos,
  retryFromCheckpoint,
  scoreRun,
  step,
} from "@/lib/sugar-rush-maze";
import { sugarRushSfx } from "@/lib/sugar-rush-sfx";
import { Camera, drawCandyCity, makeCamera } from "./maze-render";
import SugarRushActors from "./SugarRushActors";
import SugarRushHud from "./SugarRushHud";
import SugarRushControls from "./SugarRushControls";
import SugarRushTutorial from "./SugarRushTutorial";
import "./sugar-rush.css";

export type SugarRushOutcome = SugarRushScore & {
  completed: boolean;
  reason: "exit" | "hearts";
  lines: { label: string; value: number }[];
};

type Props = {
  runKey: number;
  best: number | null;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  onQuit?: () => void;
  onEnd: (outcome: SugarRushOutcome) => void;
};

const TUTORIAL_KEY = "yaj.games.sugarrush.tutorialSeen";

/** The live maze: fixed-step engine, canvas render, a 3D actor overlay, HUD and controls —
 *  mirrors TowerEscapeStage.tsx's structure. */
export default function SugarRushMazeStage({ runKey, best, muted, onToggleMute, onBack, onQuit, onEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stRef = useRef<SugarRushMazeState>(initialSugarRushMaze());
  const camRef = useRef<Camera | undefined>(undefined);
  const inputRef = useRef<SugarRushInput>({ ...NO_INPUT });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const endedRef = useRef(false);
  const cavityAlertRef = useRef(0);

  const [paused, setPaused] = useState(false);
  const [, setTick] = useState(0);
  const [downed, setDowned] = useState(false);
  const [checkpointFlash, setCheckpointFlash] = useState(0);
  const [rushFlash, setRushFlash] = useState(0);
  const [dangerFlash, setDangerFlash] = useState(0);
  const [tutorial, setTutorial] = useState(() => {
    try {
      return localStorage.getItem(TUTORIAL_KEY) !== "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    sugarRushSfx.setMuted(muted);
  }, [muted]);

  // Fresh maze whenever the run key changes.
  useEffect(() => {
    stRef.current = initialSugarRushMaze();
    camRef.current = undefined;
    endedRef.current = false;
    setDowned(false);
    setPaused(false);
    void sugarRushSfx.prime().then(() => sugarRushSfx.startMusic());
    return () => sugarRushSfx.stopMusic();
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
      if (!paused && !downed && !tutorial && st.status === "playing") {
        const next = step(st, inputRef.current, dt);
        stRef.current = next;
        for (const ev of next.events) {
          if (ev === "pickup") sugarRushSfx.treatPickup();
          else if (ev === "sugarStar") sugarRushSfx.sugarStarPickup();
          else if (ev === "powerUp") sugarRushSfx.powerUpPickup();
          else if (ev === "rushStart") {
            sugarRushSfx.rushStart();
            setRushFlash((n) => n + 1);
          }
          else if (ev === "rushEnd") sugarRushSfx.rushEnd();
          else if (ev === "tunnel") sugarRushSfx.tunnelWarp();
          else if (ev === "hit" || ev === "shieldBlock") sugarRushSfx.playerHit();
          else if (ev === "checkpoint") {
            sugarRushSfx.checkpointReached();
            setCheckpointFlash((n) => n + 1);
          }
          else if (ev === "objectiveComplete") sugarRushSfx.powerUpPickup();
          else if (ev === "cavityNear" && next.t - cavityAlertRef.current > 2.5) {
            cavityAlertRef.current = next.t;
            sugarRushSfx.cavityAlert();
            setDangerFlash((n) => n + 1);
          }
        }
        if (next.status !== "playing" && !endedRef.current) {
          endedRef.current = true;
          if (next.status === "complete") {
            sugarRushSfx.levelComplete();
            sugarRushSfx.stopMusic();
            onEnd(buildOutcome(next, true, "exit"));
          } else {
            setDowned(true);
          }
        }
      }

      camRef.current = makeCamera(playerWorldPos(stRef.current), stRef.current.map, rect.width, rect.height, camRef.current);
      drawCandyCity(g, stRef.current, camRef.current, rect.width, rect.height);
      setTick((t) => (t + 1) % 1_000_000);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = 0;
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
    };
  }, [paused, downed, tutorial, runKey, onEnd]);

  const st = stRef.current;
  const pp = playerWorldPos(st);
  const cp = cavityWorldPos(st);
  const cavityDistance = Math.hypot(pp.x - cp.x, pp.y - cp.y);
  const dangerStrength = st.rushActive ? 0 : Math.max(0, Math.min(1, 1 - cavityDistance / (st.map.cellSize * 4.2)));

  const retry = () => {
    stRef.current = retryFromCheckpoint(stRef.current);
    endedRef.current = false;
    setDowned(false);
  };

  const giveUp = () => {
    const failed = stRef.current;
    setDowned(false);
    sugarRushSfx.stopMusic();
    onEnd(buildOutcome(failed, false, "hearts"));
  };

  const closeTutorial = () => {
    setTutorial(false);
    try {
      localStorage.setItem(TUTORIAL_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="sr-game-viewport fixed inset-0 h-[100dvh] w-[100dvw] overflow-hidden bg-[#160a28]">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />
      <SugarRushActors stateRef={stRef} camRef={camRef} />

      <SugarRushHud st={st} best={best} muted={muted} onToggleMute={onToggleMute} onPause={() => setPaused((p) => !p)} onBack={onBack} onQuit={onQuit} />

      {/* Edge warning stays out of the maze itself and grows only as Dr. Cavity gets close. */}
      {dangerStrength > 0.08 && !paused && !tutorial && (
        <div
          className="pointer-events-none absolute inset-0 z-[12] sr-danger-edge"
          style={{ opacity: 0.18 + dangerStrength * 0.52 }}
        />
      )}

      {dangerFlash > 0 && !st.rushActive && (
        <div key={dangerFlash} className="pointer-events-none absolute inset-x-0 top-[16%] z-30 flex justify-center">
          <div className="sr-danger-toast rounded-full border border-rose-300/35 bg-rose-950/80 px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-rose-100 shadow-xl backdrop-blur-md">
            Dr. Cavity spotted you!
          </div>
        </div>
      )}

      {rushFlash > 0 && (
        <div key={rushFlash} className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="sr-rush-burst text-center">
            <p className="text-4xl font-black uppercase tracking-tight text-yellow-100 drop-shadow-[0_4px_18px_rgba(255,84,200,.9)]">Sugar Rush!</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.24em] text-white/85">Fast • glowing • bonus score</p>
          </div>
        </div>
      )}

      {checkpointFlash > 0 && (
        <p
          key={checkpointFlash}
          className="pointer-events-none absolute inset-x-0 top-[22%] z-20 sr-checkpoint-flash text-center text-sm font-black uppercase tracking-widest text-emerald-300 drop-shadow"
        >
          Checkpoint reached
        </p>
      )}

      {!paused && !downed && !tutorial && <SugarRushControls input={inputRef} />}

      <SugarRushTutorial open={tutorial} onClose={closeTutorial} />

      {paused && !tutorial && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center backdrop-blur-sm">
          <p className="text-2xl font-black uppercase tracking-widest text-white">Paused</p>
          <p className="max-w-[300px] text-xs text-white/60">
            Swipe anywhere (or arrow keys / WASD) to move. Collect treats to fill the Sugar Meter and trigger Sugar Rush Mode.
          </p>
          <button
            type="button"
            onClick={() => setPaused(false)}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-black text-primary-foreground"
          >
            <Play className="h-4 w-4" /> Resume
          </button>
          <button type="button" onClick={onBack} className="text-xs font-bold text-white/60 underline">
            Leave Candy City
          </button>
        </div>
      )}

      {downed && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/85 px-6 text-center backdrop-blur-sm">
          <p className="text-2xl font-black uppercase tracking-widest text-rose-300">Dr. Cavity got you!</p>
          <p className="max-w-[320px] text-xs text-white/65">
            You're out of hearts — restart from checkpoint {st.checkpoint || "0"}.
          </p>
          <button
            type="button"
            onClick={retry}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-black text-primary-foreground"
          >
            <RotateCcw className="h-4 w-4" /> Retry from checkpoint
          </button>
          <button type="button" onClick={giveUp} className="text-xs font-bold text-white/60 underline">
            End run and see my score
          </button>
        </div>
      )}
    </div>
  );
}

function buildOutcome(st: SugarRushMazeState, completed: boolean, reason: SugarRushOutcome["reason"]): SugarRushOutcome {
  const score = scoreRun(st);
  return {
    ...score,
    completed,
    reason,
    lines: [
      { label: "Treats collected", value: score.treatsCollected },
      { label: "Sugar Rush activations", value: score.rushActivations },
      { label: "Hearts remaining", value: score.heartsRemaining },
      { label: "Time (sec)", value: Math.round(score.elapsedMs / 1000) },
      { label: "Total score", value: score.score },
    ],
  };
}
