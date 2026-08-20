import { useEffect, useMemo, useRef, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import {
  NO_INPUT,
  TowerInput,
  TowerState,
  currentSection,
  initialTower,
  retryFromCheckpoint,
  step,
} from "@/lib/tower-escape/engine";
import { TowerScore, scoreRun } from "@/lib/tower-escape/score";
import { towerAmbienceStart, towerAmbienceStop, towerSetMuted, towerSfx } from "@/lib/tower-escape-sfx";
import { Camera, drawTower, makeCamera } from "./render";
import TowerHud from "./TowerHud";
import TowerControls from "./TowerControls";

export type TowerOutcome = TowerScore & {
  escaped: boolean;
  hearts: number;
  checkpoint: number;
  reason: "rooftop" | "timeup" | "hearts";
  lines: { label: string; value: number }[];
};

type Props = {
  runKey: number;
  best: number | null;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  onEnd: (outcome: TowerOutcome) => void;
};

/** The live tower: fixed-step physics, canvas render, HUD and controls. */
export default function TowerEscapeStage({ runKey, best, muted, onToggleMute, onBack, onEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stRef = useRef<TowerState>(initialTower());
  const camRef = useRef<Camera | undefined>(undefined);
  const inputRef = useRef<TowerInput>({ ...NO_INPUT });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const endedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [, setTick] = useState(0);
  const [downed, setDowned] = useState(false);

  useEffect(() => {
    towerSetMuted(muted);
  }, [muted]);

  // Fresh tower whenever the run key changes.
  useEffect(() => {
    stRef.current = initialTower();
    camRef.current = undefined;
    endedRef.current = false;
    setDowned(false);
    setPaused(false);
    towerSfx.unlock();
    towerAmbienceStart();
    return () => towerAmbienceStop();
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
      if (!paused && !downed && st.status === "climbing") {
        const next = step(st, inputRef.current, dt);
        stRef.current = next;
        for (const ev of next.events) {
          if (ev === "jump") towerSfx.jump();
          else if (ev === "land") towerSfx.land();
          else if (ev === "star") towerSfx.star();
          else if (ev === "bonusStar") towerSfx.bonus();
          else if (ev === "power") towerSfx.power();
          else if (ev === "hit") towerSfx.hit();
          else if (ev === "fall") towerSfx.fall();
          else if (ev === "collapse") towerSfx.collapse();
          else if (ev === "checkpoint") towerSfx.checkpoint();
          else if (ev === "warn") towerSfx.warn();
        }
        if (next.status !== "climbing" && !endedRef.current) {
          endedRef.current = true;
          if (next.status === "escaped") towerSfx.finish();
          else towerSfx.failed();
          towerAmbienceStop();
          const score = scoreRun(next);
          const reason: TowerOutcome["reason"] =
            next.status === "escaped" ? "rooftop" : next.timeLeft <= 0 ? "timeup" : "hearts";
          if (next.status === "escaped") {
            onEnd(buildOutcome(next, score, reason));
          } else {
            // Failed runs offer a checkpoint retry before we bank the result.
            setDowned(true);
          }
        }
      }

      camRef.current = makeCamera(stRef.current, rect.width, rect.height, camRef.current);
      drawTower(g, stRef.current, camRef.current, rect.width, rect.height);
      setTick((t) => (t + 1) % 1_000_000);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = 0;
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
    };
  }, [paused, downed, runKey, onEnd]);

  const st = stRef.current;
  const section = useMemo(() => currentSection(st).name, [st.y, st]);

  const retry = () => {
    stRef.current = retryFromCheckpoint(stRef.current);
    endedRef.current = false;
    setDowned(false);
    towerAmbienceStart();
  };

  const giveUp = () => {
    const failed = stRef.current;
    const score = scoreRun(failed);
    const reason: TowerOutcome["reason"] = failed.timeLeft <= 0 ? "timeup" : "hearts";
    setDowned(false);
    onEnd(buildOutcome(failed, score, reason));
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#08060f]">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />

      <TowerHud
        st={st}
        sectionName={section}
        best={best}
        muted={muted}
        onToggleMute={onToggleMute}
        onPause={() => setPaused((p) => !p)}
        onBack={onBack}
      />

      {!paused && !downed && <TowerControls input={inputRef} onJump={() => { /* engine reads the held flag */ }} />}

      {paused && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center backdrop-blur-sm">
          <p className="text-2xl font-black uppercase tracking-widest text-white">Paused</p>
          <p className="max-w-[300px] text-xs text-white/60">
            Touch anywhere and drag: left / right to move, swipe up to jump or climb, swipe down to drop.
          </p>

          <button
            type="button"
            onClick={() => setPaused(false)}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-black text-primary-foreground"
          >
            <Play className="h-4 w-4" /> Resume climb
          </button>
          <button type="button" onClick={onBack} className="text-xs font-bold text-white/60 underline">
            Leave the tower
          </button>
        </div>
      )}

      {downed && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/85 px-6 text-center backdrop-blur-sm">
          <p className="text-2xl font-black uppercase tracking-widest text-rose-300">Tower run failed</p>
          <p className="max-w-[320px] text-xs text-white/65">
            {st.timeLeft <= 0
              ? "The clock beat you to the roof."
              : "You are out of hearts — restart from checkpoint " + st.checkpoint + "."}
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

function buildOutcome(st: TowerState, score: TowerScore, reason: TowerOutcome["reason"]): TowerOutcome {
  return {
    ...score,
    escaped: st.status === "escaped",
    hearts: st.hearts,
    checkpoint: st.checkpoint,
    reason,
    lines: [
      { label: "Stars", value: score.stars },
      { label: "Star points", value: score.starPoints },
      { label: "Checkpoints", value: score.checkpointBonus },
      { label: "Hearts left", value: score.heartBonus },
      { label: "Time bonus", value: score.timeBonus },
      { label: "Escape bonus", value: score.escapeBonus },
      { label: "Total", value: score.total },
    ],
  };
}
