import { useEffect, useRef, useState } from "react";
import { Crosshair, Radar } from "lucide-react";
import { BOARD_SIZE, Fleet, Shot, SonarResult } from "@/lib/battleship";
import { BoatDraw, Fx, VIEW, cellFromPoint, damageTier, drawBoat, drawFx, drawProjectile, drawReticle, drawWater } from "./render";

const PROJECTILE_MS = 480;

/**
 * One water zone — drop-in replacement for the old FleetGrid, same prop shape (fleet / shots /
 * showShips / interactive / onTap) so BattleshipPage's wiring barely changes. Internally this
 * renders Tropical Cove art on a canvas instead of a grid of buttons, but taps still resolve to
 * the exact same (x, y) cell the hidden 10x10 grid in battleship.ts already expects.
 */
export default function OceanBoard({
  fleet,
  shots,
  showShips,
  interactive,
  onTap,
  variant = "a",
  dim = false,
  prompt,
  twoStep = false,
  confirmMode = "fire",
  sonarResult = null,
}: {
  fleet: Fleet | null;
  shots: Shot[];
  showShips: boolean;
  interactive: boolean;
  onTap?: (x: number, y: number) => void;
  variant?: "a" | "b";
  dim?: boolean;
  prompt?: string;
  /** Battle targeting: tap shows a reticle, a separate confirm tap fires or pulses. Placement
   *  instead fires immediately on tap (dropping/picking up a ship is already deliberate). */
  twoStep?: boolean;
  /** Which confirm action a twoStep tap resolves to. */
  confirmMode?: "fire" | "sonar";
  /** The most recent Sonar Pulse aimed at this zone, if any — drawn as expanding rings. */
  sonarResult?: SonarResult | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const fxRef = useRef<Fx[]>([]);
  const seenShots = useRef(0);
  const travelRef = useRef<{ x: number; y: number; start: number; result: Shot["result"] } | null>(null);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);

  // A newly appended shot plays a projectile arriving at its target, then resolves into a
  // splash/hit effect — purely visual, the underlying shot already landed in battleship.ts.
  useEffect(() => {
    if (shots.length > seenShots.current) {
      const shot = shots[shots.length - 1];
      travelRef.current = { x: shot.x, y: shot.y, start: performance.now(), result: shot.result };
    }
    seenShots.current = shots.length;
  }, [shots]);

  const seenSonarTurn = useRef<number | null>(null);
  useEffect(() => {
    if (!sonarResult || seenSonarTurn.current === sonarResult.turn) return;
    seenSonarTurn.current = sonarResult.turn;
    fxRef.current.push({
      kind: sonarResult.found ? "sonarFound" : "sonarClear",
      x: sonarResult.x,
      y: sonarResult.y,
      start: performance.now() / 1000,
    });
  }, [sonarResult]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = VIEW * dpr;
    canvas.height = VIEW * dpr;

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const g = canvas.getContext("2d");
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = now / 1000;

      drawWater(g, t, variant, dim);

      const boats: BoatDraw[] = [];
      if (showShips && fleet) {
        for (const ship of fleet) boats.push({ shipId: ship.id, cells: ship.cells, tier: damageTier(ship.hits) });
      }
      boats.sort((a, b) => a.cells[0].y - b.cells[0].y);
      boats.forEach((b) => drawBoat(g, b, t, true));

      // hit/miss marks already resolved (persisted shots)
      for (const s of shots) {
        if (travelRef.current && travelRef.current.x === s.x && travelRef.current.y === s.y && now - travelRef.current.start < PROJECTILE_MS + 700) {
          continue; // this one is still animating below
        }
        const { x, y } = s;
        const cx = (x + 0.5) * (VIEW / BOARD_SIZE);
        const cy = (y + 0.5) * (VIEW / BOARD_SIZE);
        g.save();
        if (s.result === "miss") {
          g.fillStyle = "rgba(255,255,255,0.55)";
          g.beginPath();
          g.arc(cx, cy, 3.2, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = "rgba(255,255,255,0.3)";
          g.lineWidth = 1.4;
          g.beginPath();
          g.arc(cx, cy, 8, 0, Math.PI * 2);
          g.stroke();
        } else {
          g.fillStyle = "rgba(192,73,46,0.85)";
          g.beginPath();
          g.arc(cx, cy, 6.5, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = "#fff";
          g.lineWidth = 1.6;
          const r = 3.2;
          g.beginPath();
          g.moveTo(cx - r, cy - r);
          g.lineTo(cx + r, cy + r);
          g.moveTo(cx + r, cy - r);
          g.lineTo(cx - r, cy + r);
          g.stroke();
        }
        g.restore();
      }

      // active projectile + its landing fx
      const trav = travelRef.current;
      if (trav) {
        const age = now - trav.start;
        if (age < PROJECTILE_MS) {
          drawProjectile(g, trav.x, trav.y, age / PROJECTILE_MS);
        } else {
          const fxAge = age - PROJECTILE_MS;
          const kind = trav.result === "miss" ? "splash" : "hit";
          if (fxAge < 700) drawFx(g, { kind, x: trav.x, y: trav.y, start: (trav.start + PROJECTILE_MS) / 1000 }, now / 1000);
          else travelRef.current = null;
        }
      }

      fxRef.current = fxRef.current.filter((fx) => now / 1000 - fx.start < 1.2);
      fxRef.current.forEach((fx) => drawFx(g, fx, now / 1000));

      if (pending && interactive && twoStep) drawReticle(g, pending.x, pending.y, t);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fleet, shots, variant, dim, pending, interactive, twoStep]);

  const alreadyMarked = (x: number, y: number) => shots.some((s) => s.x === x && s.y === y);

  const handleTap = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = VIEW / rect.width;
    const px = (e.clientX - rect.left) * scale;
    const py = (e.clientY - rect.top) * scale;
    const cell = cellFromPoint(px, py);
    if (!cell) return;
    if (!twoStep) {
      onTap?.(cell.x, cell.y);
      return;
    }
    if (alreadyMarked(cell.x, cell.y)) return;
    setPending(cell);
  };

  const fire = () => {
    if (!pending) return;
    onTap?.(pending.x, pending.y);
    setPending(null);
  };

  return (
    <div className="relative mx-auto" style={{ maxWidth: VIEW }}>
      <canvas
        ref={canvasRef}
        onClick={handleTap}
        style={{ width: "100%", height: "auto", aspectRatio: "1 / 1", cursor: interactive ? "crosshair" : "default" }}
        className="rounded-2xl border border-white/10 shadow-lg"
        aria-label="Water zone"
      />
      {interactive && !(twoStep && pending) && prompt && (
        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
          <span className="rounded-full bg-black/55 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white backdrop-blur">
            {prompt}
          </span>
        </div>
      )}
      {interactive && twoStep && pending && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <button
            type="button"
            onClick={fire}
            className={`pointer-events-auto flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-black text-white shadow-lg active:scale-95 ${
              confirmMode === "sonar" ? "bg-sky-500" : "bg-primary text-primary-foreground"
            }`}
          >
            {confirmMode === "sonar" ? <Radar className="h-4 w-4" /> : <Crosshair className="h-4 w-4" />}
            {confirmMode === "sonar" ? "PULSE" : "FIRE"}
          </button>
        </div>
      )}
    </div>
  );
}
