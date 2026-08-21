import { useEffect, useRef, useState } from "react";
import { Crosshair, Radar } from "lucide-react";
import { BOARD_SIZE, Fleet, Shot, SonarResult } from "@/lib/battleship";
import {
  BoatDraw,
  Fx,
  PLAYER_TOP,
  VIEW_H,
  VIEW_W,
  cellFromPoint,
  damageTier,
  drawBoat,
  drawCrewFlash,
  drawFx,
  drawMark,
  drawProjectile,
  drawReticle,
  drawScene,
  toPx,
} from "./render";

const PROJECTILE_MS = 620;
const MY_MUZZLE = { x: VIEW_W / 2, y: PLAYER_TOP };
const ENEMY_MUZZLE = { x: VIEW_W / 2, y: 230 };

/**
 * The whole battle in one canvas: a hazy enemy horizon up top, open water and reef in the
 * middle, your own clear fleet at the bottom — one continuous ocean, not two boards. Taps in
 * the enemy band target; taps in the player band place your fleet during setup. Both are still
 * backed by the exact hidden 10x10 grids in src/lib/battleship.ts.
 */
export default function OceanBattlefield({
  myFleet,
  shotsOnEnemy,
  shotsOnMe,
  enemyInteractive,
  placementInteractive,
  onTargetConfirm,
  onPlaceTap,
  confirmMode = "fire",
  sonarResult = null,
  sonarResultOnMe = null,
  computerAim = null,
  hitFlashAt = null,
  prompt,
  showBoatsInPlayerBand = true,
}: {
  myFleet: Fleet | null;
  shotsOnEnemy: Shot[];
  shotsOnMe: Shot[];
  enemyInteractive: boolean;
  placementInteractive: boolean;
  onTargetConfirm?: (x: number, y: number) => void;
  onPlaceTap?: (x: number, y: number) => void;
  confirmMode?: "fire" | "sonar";
  /** My own Sonar Pulse against the enemy — drawn in the enemy band. */
  sonarResult?: SonarResult | null;
  /** The opponent's Sonar Pulse against my fleet (multiplayer) — drawn in the player band. */
  sonarResultOnMe?: SonarResult | null;
  /** The computer's chosen target, shown as a red telegraph before it actually fires. */
  computerAim?: { x: number; y: number } | null;
  /** Briefly show a small crew reaction at a hit cell in the enemy band, without revealing the boat. */
  hitFlashAt?: { x: number; y: number; start: number } | null;
  prompt?: string;
  showBoatsInPlayerBand?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const fxRef = useRef<Fx[]>([]);
  const seenEnemyShots = useRef(0);
  const seenMyShots = useRef(0);
  const seenSonarTurn = useRef<number | null>(null);
  const seenSonarOnMeTurn = useRef<number | null>(null);
  const travelRef = useRef<{ band: "enemy" | "player"; x: number; y: number; start: number; result: Shot["result"] } | null>(null);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const duckPulse = useRef(0);

  // A newly appended shot on either side launches a projectile flying across the open water.
  useEffect(() => {
    if (shotsOnEnemy.length > seenEnemyShots.current) {
      const shot = shotsOnEnemy[shotsOnEnemy.length - 1];
      travelRef.current = { band: "enemy", x: shot.x, y: shot.y, start: performance.now(), result: shot.result };
    }
    seenEnemyShots.current = shotsOnEnemy.length;
  }, [shotsOnEnemy]);

  useEffect(() => {
    if (shotsOnMe.length > seenMyShots.current) {
      const shot = shotsOnMe[shotsOnMe.length - 1];
      travelRef.current = { band: "player", x: shot.x, y: shot.y, start: performance.now(), result: shot.result };
      if (shot.result !== "miss") duckPulse.current = performance.now();
    }
    seenMyShots.current = shotsOnMe.length;
  }, [shotsOnMe]);

  useEffect(() => {
    if (!sonarResult || seenSonarTurn.current === sonarResult.turn) return;
    seenSonarTurn.current = sonarResult.turn;
    fxRef.current.push({
      kind: sonarResult.found ? "sonarFound" : "sonarClear",
      band: "enemy",
      x: sonarResult.x,
      y: sonarResult.y,
      start: performance.now() / 1000,
    });
  }, [sonarResult]);

  useEffect(() => {
    if (!sonarResultOnMe || seenSonarOnMeTurn.current === sonarResultOnMe.turn) return;
    seenSonarOnMeTurn.current = sonarResultOnMe.turn;
    fxRef.current.push({
      kind: sonarResultOnMe.found ? "sonarFound" : "sonarClear",
      band: "player",
      x: sonarResultOnMe.x,
      y: sonarResultOnMe.y,
      start: performance.now() / 1000,
    });
  }, [sonarResultOnMe]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = VIEW_W * dpr;
    canvas.height = VIEW_H * dpr;

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const g = canvas.getContext("2d");
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = now / 1000;

      drawScene(g, t);

      if (showBoatsInPlayerBand && myFleet) {
        const boats: BoatDraw[] = myFleet.map((ship) => ({ shipId: ship.id, cells: ship.cells, tier: damageTier(ship.hits) }));
        boats.sort((a, b) => a.cells[0].y - b.cells[0].y);
        const ducking = now - duckPulse.current < 900;
        boats.forEach((b) => drawBoat(g, "player", b, t, true, ducking ? "duck" : b.tier === "critical" ? "duck" : "idle"));
      }

      const trav = travelRef.current;
      for (const s of shotsOnEnemy) {
        if (trav && trav.band === "enemy" && trav.x === s.x && trav.y === s.y && now - trav.start < PROJECTILE_MS + 650) continue;
        drawMark(g, "enemy", s.x, s.y, s.result === "miss" ? "miss" : "hit", s.x * 7 + s.y * 13);
      }
      for (const s of shotsOnMe) {
        if (trav && trav.band === "player" && trav.x === s.x && trav.y === s.y && now - trav.start < PROJECTILE_MS + 650) continue;
        drawMark(g, "player", s.x, s.y, s.result === "miss" ? "miss" : "hit", s.x * 7 + s.y * 13);
      }

      if (trav) {
        const age = now - trav.start;
        const from = trav.band === "enemy" ? MY_MUZZLE : ENEMY_MUZZLE;
        const to = toPx(trav.band, trav.x + 0.5, trav.y + 0.5);
        if (age < PROJECTILE_MS) {
          drawProjectile(g, from, to, age / PROJECTILE_MS);
        } else {
          const fxAge = age - PROJECTILE_MS;
          const kind = trav.result === "miss" ? "splash" : "hit";
          if (fxAge < 650) drawFx(g, { kind, band: trav.band, x: trav.x, y: trav.y, start: (trav.start + PROJECTILE_MS) / 1000 }, now / 1000);
          else travelRef.current = null;
        }
      }

      if (computerAim) drawReticle(g, "player", computerAim.x, computerAim.y, t, "#ff6b5b");

      if (hitFlashAt && now / 1000 - hitFlashAt.start < 0.9) {
        drawCrewFlash(g, "enemy", hitFlashAt.x, hitFlashAt.y, t, hitFlashAt.x + hitFlashAt.y);
      }

      fxRef.current = fxRef.current.filter((fx) => now / 1000 - fx.start < 1.2);
      fxRef.current.forEach((fx) => drawFx(g, fx, now / 1000));

      if (pending && enemyInteractive) drawReticle(g, "enemy", pending.x, pending.y, t);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myFleet, shotsOnEnemy, shotsOnMe, pending, enemyInteractive, computerAim, showBoatsInPlayerBand, hitFlashAt]);

  const alreadyMarked = (x: number, y: number) => shotsOnEnemy.some((s) => s.x === x && s.y === y);

  const handleTap = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = VIEW_W / rect.width;
    const px = (e.clientX - rect.left) * scale;
    const py = (e.clientY - rect.top) * scale;
    const cell = cellFromPoint(px, py);
    if (!cell) return;
    if (cell.band === "player" && placementInteractive) {
      onPlaceTap?.(cell.x, cell.y);
      return;
    }
    if (cell.band === "enemy" && enemyInteractive) {
      if (alreadyMarked(cell.x, cell.y)) return;
      setPending({ x: cell.x, y: cell.y });
    }
  };

  const confirm = () => {
    if (!pending) return;
    onTargetConfirm?.(pending.x, pending.y);
    setPending(null);
  };

  return (
    <div className="relative mx-auto" style={{ maxWidth: VIEW_W }}>
      <canvas
        ref={canvasRef}
        onClick={handleTap}
        style={{ width: "100%", height: "auto", aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
        className="rounded-2xl border border-white/10 shadow-lg"
        aria-label="Ocean battlefield"
      />
      {enemyInteractive && !pending && prompt && (
        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
          <span className="rounded-full bg-black/55 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white backdrop-blur">
            {prompt}
          </span>
        </div>
      )}
      {enemyInteractive && pending && (
        <div
          className="pointer-events-none absolute inset-x-0 flex justify-center"
          style={{ top: `${(230 / VIEW_H) * 100}%` }}
        >
          <button
            type="button"
            onClick={confirm}
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
