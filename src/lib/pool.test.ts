import { describe, expect, it } from "vitest";
import {
  BALL_R,
  POCKETS,
  TABLE_H,
  TABLE_W,
  canPlaceCueBall,
  computerShot,
  groupClearedInBalls,
  initialPool,
  placeCueBall,
  resolveShot,
  simulateShot,
} from "./pool";

/** Lines the cue ball up directly behind `target` on the target→pocket line, guaranteeing a pot. */
function aimIntoPocket(target: { x: number; y: number }, cue: { x: number; y: number }, pocket = POCKETS[0]) {
  const dx = pocket.x - target.x;
  const dy = pocket.y - target.y;
  const dist = Math.hypot(dx, dy);
  const ux = dx / dist;
  const uy = dy / dist;
  cue.x = target.x - ux * BALL_R * 4;
  cue.y = target.y - uy * BALL_R * 4;
  return Math.atan2(target.y - cue.y, target.x - cue.x);
}

describe("pool", () => {
  it("racks 16 balls with the cue ball at the head spot", () => {
    const state = initialPool();
    expect(state.balls).toHaveLength(16);
    const cue = state.balls.find((b) => b.id === 0)!;
    expect(cue.x).toBeCloseTo(TABLE_W * 0.25);
    expect(cue.y).toBeCloseTo(TABLE_H / 2);
    const eight = state.balls.find((b) => b.id === 8)!;
    expect(eight.x).toBeCloseTo(TABLE_W * 0.75 + BALL_R * Math.sqrt(3) * 2);
  });

  it("simulates a break shot and eventually stops all balls", () => {
    const state = initialPool();
    const sim = simulateShot(state.balls, 0, 1);
    expect(sim.finalBalls.every((b) => b.potted || (b.vx === 0 && b.vy === 0))).toBe(true);
    expect(sim.firstContact).toBe(1);
  });

  it("resolves a foul when the cue ball contacts nothing", () => {
    const state = initialPool();
    state.phase = "playing";
    // Aim straight off to the side, away from every ball.
    const sim = simulateShot(state.balls, -Math.PI / 2, 0.2);
    const res = resolveShot(state, 0, -Math.PI / 2, 0.2, sim, 1);
    expect(res.foul).toBe(true);
    expect(res.nextState.ballInHand).toBe(true);
  });

  it("assigns a group on the first legal pot with an open table", () => {
    const state = initialPool();
    state.phase = "playing";
    // Manufacture a shot: place a solid ball right at a pocket mouth and the
    // cue ball right behind it so contact + pocketing are guaranteed.
    const solid = state.balls.find((b) => b.id === 1)!;
    solid.x = 150;
    solid.y = 150;
    const cue = state.balls.find((b) => b.id === 0)!;
    const angle = aimIntoPocket(solid, cue);
    const sim = simulateShot(state.balls, angle, 0.9);
    const res = resolveShot(state, 0, angle, 0.9, sim, 1);
    expect(res.nextState.groups[0]).toBe("solids");
    expect(res.nextState.groups[1]).toBe("stripes");
    expect(res.turnContinues).toBe(true);
  });

  it("declares a loss for pocketing the 8-ball early", () => {
    const state = initialPool();
    state.phase = "playing";
    state.groups = ["solids", "stripes"];
    const eight = state.balls.find((b) => b.id === 8)!;
    eight.x = 150;
    eight.y = 150;
    const cue = state.balls.find((b) => b.id === 0)!;
    const angle = aimIntoPocket(eight, cue);
    const sim = simulateShot(state.balls, angle, 0.9);
    const res = resolveShot(state, 0, angle, 0.9, sim, 1);
    expect(res.winnerSeat).toBe(1);
    expect(res.foul).toBe(true);
  });

  it("declares a win for legally pocketing the 8-ball once the group is cleared", () => {
    const state = initialPool();
    state.phase = "playing";
    state.groups = ["solids", "stripes"];
    // Mark every solid ball as already potted.
    for (const id of [1, 2, 3, 4, 5, 6, 7]) {
      state.balls.find((b) => b.id === id)!.potted = true;
    }
    expect(groupClearedInBalls("solids", state.balls)).toBe(true);
    const eight = state.balls.find((b) => b.id === 8)!;
    eight.x = 150;
    eight.y = 150;
    const cue = state.balls.find((b) => b.id === 0)!;
    const angle = aimIntoPocket(eight, cue);
    const sim = simulateShot(state.balls, angle, 0.9);
    const res = resolveShot(state, 0, angle, 0.9, sim, 1);
    expect(res.winnerSeat).toBe(0);
    expect(res.foul).toBe(false);
  });

  it("keeps cue ball placement within the table and away from other balls", () => {
    const state = initialPool();
    expect(canPlaceCueBall(state.balls, TABLE_W / 2, TABLE_H / 2)).toBe(true);
    const eight = state.balls.find((b) => b.id === 8)!;
    expect(canPlaceCueBall(state.balls, eight.x, eight.y)).toBe(false);
    expect(canPlaceCueBall(state.balls, -10, -10)).toBe(false);
    const placed = placeCueBall(state, 500, 250);
    const cue = placed.balls.find((b) => b.id === 0)!;
    expect(cue.x).toBe(500);
    expect(cue.y).toBe(250);
    expect(cue.potted).toBe(false);
    expect(placed.ballInHand).toBe(false);
  });

  it("computer opponent always returns a finite angle and clamped power", () => {
    const state = initialPool();
    const shot = computerShot(state, 1);
    expect(Number.isFinite(shot.angle)).toBe(true);
    expect(shot.power).toBeGreaterThanOrEqual(0);
    expect(shot.power).toBeLessThanOrEqual(1);
  });
});
