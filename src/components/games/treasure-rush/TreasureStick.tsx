import { useRef, useState } from "react";

/** Analog thumbstick — free 360° movement, unlike City Run's lane switcher. */
export default function TreasureStick({ onAxis }: { onAxis: (ax: number, az: number) => void }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = (clientX: number, clientY: number) => {
    const el = base.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const max = r.width / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, max);
    dx = (dx / len) * clamped;
    dy = (dy / len) * clamped;
    setKnob({ x: dx, y: dy });

    const nx = dx / max;
    const ny = dy / max;
    const dead = 0.16;
    const shape = (v: number) => (Math.abs(v) < dead ? 0 : (v - Math.sign(v) * dead) / (1 - dead));
    // Screen up (negative y) walks away from the camera, i.e. negative world z.
    onAxis(shape(nx), shape(ny));
  };

  const release = () => {
    setKnob({ x: 0, y: 0 });
    onAxis(0, 0);
  };

  return (
    <div
      ref={base}
      onPointerDown={(e) => {
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 0 && e.pointerType === "mouse") return;
        update(e.clientX, e.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      aria-label="Move"
      className="relative h-36 w-36 touch-none rounded-full border border-white/25 bg-white/10 backdrop-blur-md"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 rounded-full border border-white/40 bg-white/70"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}
