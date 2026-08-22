import { useEffect, useRef } from "react";
import { Dir } from "@/lib/sugar-rush-map";
import { SugarRushInput } from "@/lib/sugar-rush-maze";

type Props = {
  /** Mutable input the engine reads each frame — no React state in the hot path. */
  input: React.MutableRefObject<SugarRushInput>;
};

const DEAD = 14;

/** Swipe/drag anywhere to set the direction you want to move — the engine keeps the
 *  character going that way until it hits a wall, reaches an intersection, or a new
 *  swipe/key changes it. Arrow keys / WASD work the same way for desktop testing. No
 *  permanent on-screen joystick, per the brief. */
export default function SugarRushControls({ input }: Props) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const pressed = useRef<Dir[]>([]);

  useEffect(() => {
    const map: Record<string, Dir> = {
      ArrowUp: "n",
      w: "n",
      W: "n",
      ArrowDown: "s",
      s: "s",
      S: "s",
      ArrowLeft: "w",
      a: "w",
      A: "w",
      ArrowRight: "e",
      d: "e",
      D: "e",
    };
    const down = (e: KeyboardEvent) => {
      const d = map[e.key];
      if (!d) return;
      e.preventDefault();
      pressed.current = [d, ...pressed.current.filter((x) => x !== d)];
      input.current.desired = d;
    };
    const up = (e: KeyboardEvent) => {
      const d = map[e.key];
      if (!d) return;
      pressed.current = pressed.current.filter((x) => x !== d);
      input.current.desired = pressed.current[0] ?? null;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [input]);

  const fromDrag = (cx: number, cy: number) => {
    const o = origin.current;
    if (!o) return;
    const dx = cx - o.x;
    const dy = cy - o.y;
    if (Math.hypot(dx, dy) < DEAD) return;
    const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "e" : "w") : dy > 0 ? "s" : "n";
    input.current.desired = dir;
    origin.current = { x: cx, y: cy };
  };

  return (
    <div
      className="absolute inset-0 z-[8] touch-none select-none"
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        origin.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!origin.current) return;
        fromDrag(e.clientX, e.clientY);
      }}
      onPointerUp={() => {
        origin.current = null;
      }}
      onPointerCancel={() => {
        origin.current = null;
      }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="Swipe to move through Candy City"
    />
  );
}
