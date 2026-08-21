import { useRef, useState } from "react";

const STICK_MAX = 58;

/**
 * Touch anywhere on the screen to steer — free 360° movement, same invisible-until-touched
 * feel as Survival Island/Tower Escape/Neighborhood Adventure. No fixed visible controller;
 * the knob only appears at the point you touch.
 */
export default function TreasureStick({ onAxis }: { onAxis: (ax: number, az: number) => void }) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState<{ ox: number; oy: number; dx: number; dy: number } | null>(null);

  const update = (clientX: number, clientY: number) => {
    const o = origin.current;
    if (!o) return;
    let dx = clientX - o.x;
    let dy = clientY - o.y;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, STICK_MAX);
    dx = (dx / len) * clamped;
    dy = (dy / len) * clamped;
    setKnob({ ox: o.x, oy: o.y, dx, dy });

    const nx = dx / STICK_MAX;
    const ny = dy / STICK_MAX;
    const dead = 0.16;
    const shape = (v: number) => (Math.abs(v) < dead ? 0 : (v - Math.sign(v) * dead) / (1 - dead));
    // Screen up (negative y) walks away from the camera, i.e. negative world z.
    onAxis(shape(nx), shape(ny));
  };

  const release = () => {
    origin.current = null;
    setKnob(null);
    onAxis(0, 0);
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
        update(e.clientX, e.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="Move"
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
