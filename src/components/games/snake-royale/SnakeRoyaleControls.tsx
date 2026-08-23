import { useEffect, useRef, useState } from "react";
import { SnakeInput } from "@/lib/snake-royale/engine";

type Props = {
  /** Mutable input the engine reads each frame — no React state in the hot path. */
  input: React.MutableRefObject<SnakeInput>;
};

const MAX = 62;
const DEAD = 0.12;

/**
 * Free 360° movement stick, same touch-anywhere feel as the other YAJ Adventures:
 * press anywhere and drag to steer the character. WASD / arrows work on desktop.
 */
export default function SnakeRoyaleControls({ input }: Props) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const keys = useRef({ up: false, down: false, left: false, right: false });
  const [knob, setKnob] = useState<{ ox: number; oy: number; dx: number; dy: number } | null>(null);

  useEffect(() => {
    const map: Record<string, keyof typeof keys.current> = {
      ArrowUp: "up",
      w: "up",
      W: "up",
      ArrowDown: "down",
      s: "down",
      S: "down",
      ArrowLeft: "left",
      a: "left",
      A: "left",
      ArrowRight: "right",
      d: "right",
      D: "right",
    };
    const apply = () => {
      const k = keys.current;
      input.current.mx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
      input.current.my = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    };
    const down = (e: KeyboardEvent) => {
      const k = map[e.key];
      if (!k) return;
      e.preventDefault();
      keys.current[k] = true;
      apply();
    };
    const up = (e: KeyboardEvent) => {
      const k = map[e.key];
      if (!k) return;
      keys.current[k] = false;
      apply();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [input]);

  const reset = () => {
    origin.current = null;
    setKnob(null);
    input.current.mx = 0;
    input.current.my = 0;
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
    const mag = Math.hypot(nx, ny);
    if (mag < DEAD) {
      input.current.mx = 0;
      input.current.my = 0;
      return;
    }
    input.current.mx = nx;
    input.current.my = ny;
  };

  return (
    <div
      className="absolute inset-0 z-10 touch-none select-none"
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
      aria-label="Drag anywhere to move"
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
