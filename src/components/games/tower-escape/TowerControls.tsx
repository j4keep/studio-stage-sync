import { useEffect, useRef, useState } from "react";
import { TowerInput } from "@/lib/tower-escape/engine";

type Props = {
  /** Mutable input the engine reads each frame — no React state in the hot path. */
  input: React.MutableRefObject<TowerInput>;
  onJump: () => void;
};

const MAX = 58;
const DEAD = 0.28;

/**
 * One-stick control, same feel as City Run / Obby: touch anywhere on the screen to
 * spawn an invisible stick — left / right to move, swipe up to jump (or climb a
 * ladder), swipe down to drop. Keyboard (WASD / arrows / space) still works.
 */
export default function TowerControls({ input, onJump }: Props) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const jumped = useRef(false);
  const [knob, setKnob] = useState<{ ox: number; oy: number; dx: number; dy: number } | null>(null);

  useEffect(() => {
    const map: Record<string, keyof TowerInput> = {
      ArrowLeft: "left",
      a: "left",
      A: "left",
      ArrowRight: "right",
      d: "right",
      D: "right",
      ArrowUp: "up",
      w: "up",
      W: "up",
      ArrowDown: "down",
      s: "down",
      S: "down",
      " ": "jump",
      z: "jump",
      Z: "jump",
    };
    const down = (e: KeyboardEvent) => {
      const k = map[e.key];
      if (!k) return;
      e.preventDefault();
      if (k === "jump" && !input.current.jump) onJump();
      input.current[k] = true;
      if (k === "up") input.current.jump = true;
    };
    const up = (e: KeyboardEvent) => {
      const k = map[e.key];
      if (!k) return;
      input.current[k] = false;
      if (k === "up") input.current.jump = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [input, onJump]);

  const reset = () => {
    origin.current = null;
    jumped.current = false;
    setKnob(null);
    const i = input.current;
    i.left = i.right = i.up = i.down = i.jump = false;
  };

  const move = (cx: number, cy: number) => {
    const o = origin.current;
    if (!o) return;
    let dx = cx - o.x;
    let dy = cy - o.y;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, MAX);
    dx = (dx / len) * clamped;
    dy = (dy / len) * clamped;
    setKnob({ ox: o.x, oy: o.y, dx, dy });

    const nx = dx / MAX;
    const ny = dy / MAX;
    const i = input.current;
    i.left = nx < -DEAD;
    i.right = nx > DEAD;
    i.down = ny > 0.45;

    const wantsUp = ny < -0.4;
    i.up = wantsUp; // climbs ladders when one is in reach
    if (wantsUp && !jumped.current) {
      jumped.current = true;
      i.jump = true;
      onJump();
    }
    if (!wantsUp) {
      jumped.current = false;
      i.jump = false;
    }
  };

  return (
    <div
      className="absolute inset-0 z-30 touch-none select-none"
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        origin.current = { x: e.clientX, y: e.clientY };
        setKnob({ ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 });
      }}
      onPointerMove={(e) => {
        if (!origin.current) return;
        move(e.clientX, e.clientY);
      }}
      onPointerUp={reset}
      onPointerCancel={reset}
      onPointerLeave={reset}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="Move, swipe up to jump, swipe down to drop"
    >
      {knob && (
        <div
          className="pointer-events-none absolute h-28 w-28 rounded-full border border-white/15 bg-white/5"
          style={{ left: knob.ox, top: knob.oy, transform: "translate(-50%, -50%)" }}
        >
          <div
            className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full border border-white/25 bg-white/25"
            style={{ transform: `translate(calc(-50% + ${knob.dx}px), calc(-50% + ${knob.dy}px))` }}
          />
        </div>
      )}
    </div>
  );
}
