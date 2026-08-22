import { describe, expect, it } from "vitest";
import { buildCandyCity } from "./sugar-rush-map";
import {
  MAX_HEARTS,
  RUSH_DURATION,
  cavityWorldPos,
  initialSugarRushMaze,
  playerWorldPos,
  retryFromCheckpoint,
  scoreRun,
  step,
} from "./sugar-rush-maze";

const desired = (d: "n" | "s" | "e" | "w" | null) => ({ desired: d });

function firstOpenDir(map = buildCandyCity(), cell = map.start) {
  const cellData = map.cells[cell.r * map.cols + cell.c];
  const dirs = ["n", "s", "e", "w"] as const;
  for (const d of dirs) if (cellData.open[d]) return d;
  throw new Error("start cell has no open edge — generator bug");
}

describe("Candy City map generation", () => {
  it("produces a full grid with in-bounds landmarks", () => {
    const map = buildCandyCity();
    expect(map.cells).toHaveLength(map.cols * map.rows);
    for (const cell of [map.start, map.exit, map.cavitySpawn, ...map.shopPlaza]) {
      expect(cell.c).toBeGreaterThanOrEqual(0);
      expect(cell.c).toBeLessThan(map.cols);
      expect(cell.r).toBeGreaterThanOrEqual(0);
      expect(cell.r).toBeLessThan(map.rows);
    }
    expect(map.collectibles.filter((c) => c.kind === "frostingGem")).toHaveLength(3);
  });

  it("is deterministic across builds", () => {
    const a = buildCandyCity();
    const b = buildCandyCity();
    expect(a).toBe(b); // cached singleton, same layout every time
  });
});

describe("player movement", () => {
  it("moves along an open edge and only turns at a cell center", () => {
    const map = buildCandyCity();
    const dir = firstOpenDir(map);
    let st = initialSugarRushMaze();
    const startPos = playerWorldPos(st);

    st = step(st, desired(dir), 50);
    const midPos = playerWorldPos(st);
    expect(Math.hypot(midPos.x - startPos.x, midPos.y - startPos.y)).toBeGreaterThan(0);

    // Feeding an arbitrary (possibly closed) direction mid-corridor must not instantly
    // redirect the player — the heading can only change once a cell center is reached.
    const otherDirs = (["n", "s", "e", "w"] as const).filter((d) => d !== dir);
    st = step(st, desired(otherDirs[0]), 10);
    expect(st.player.heading).toBe(dir);
  });

  it("never has a heading pointing through a closed wall", () => {
    const map = buildCandyCity();
    let st = initialSugarRushMaze();
    const dir = firstOpenDir(map);
    for (let i = 0; i < 300; i++) st = step(st, desired(dir), 40);
    // Whatever it ended up doing, the edge it's currently traversing (or parked at) must
    // be a real open edge of the map.
    if (st.player.heading) {
      const from = st.player.from;
      expect(map.cells[from.r * map.cols + from.c].open[st.player.heading]).toBe(true);
    }
  });
});

describe("collectibles and the Sugar Meter", () => {
  it("picking up a treat increases treats/score and fills the meter", () => {
    const map = buildCandyCity();
    const item = map.collectibles.find((c) => c.kind === "gummy" || c.kind === "candyDrop")!;
    let st = initialSugarRushMaze();
    st.player = { from: map.start, to: item, edgeT: 0.9, heading: "n" };

    st = step(st, desired(null), 200);

    expect(st.taken[item.id]).toBe(true);
    expect(st.treatsCollected).toBe(1);
    expect(st.score).toBeGreaterThan(0);
    expect(st.sugarMeter).toBeGreaterThan(0);
  });

  it("activates Sugar Rush Mode at a full meter, forces Dr. Cavity to retreat, then expires", () => {
    let st = initialSugarRushMaze();
    st.sugarMeter = 100;
    st = step(st, desired(null), 16);

    expect(st.rushActive).toBe(true);
    expect(st.rushActivations).toBe(1);
    expect(st.sugarMeter).toBe(0);
    expect(st.cavity.mode).toBe("retreat");

    const ticks = Math.ceil(((RUSH_DURATION + 1) * 1000) / 100);
    for (let i = 0; i < ticks; i++) st = step(st, desired(null), 100);
    expect(st.rushActive).toBe(false);
  });
});

describe("Dr. Cavity AI", () => {
  it("closes distance on the player while chasing (plain BFS, no ML)", () => {
    const map = buildCandyCity();
    let st = initialSugarRushMaze();
    // Park the player somewhere fixed and put Cavity a few cells away, forced into chase.
    st.player = { from: map.start, to: map.start, edgeT: 0, heading: null };
    st.cavity = { ...st.cavity, from: map.cavitySpawn, to: map.cavitySpawn, edgeT: 0, heading: null, mode: "chase" };

    const before = Math.hypot(
      cavityWorldPos(st).x - playerWorldPos(st).x,
      cavityWorldPos(st).y - playerWorldPos(st).y,
    );
    for (let i = 0; i < 200; i++) {
      st = step(st, desired(null), 40);
      st.cavity.mode = "chase"; // keep it committed to chasing for this test
    }
    const after = Math.hypot(
      cavityWorldPos(st).x - playerWorldPos(st).x,
      cavityWorldPos(st).y - playerWorldPos(st).y,
    );
    expect(after).toBeLessThan(before);
  });
});

describe("hazards", () => {
  it("a sour patch reverses the next queued direction for a few seconds", () => {
    const map = buildCandyCity();
    const sour = map.hazards.find((h) => h.kind === "sourPatch")! as any;
    const cell = sour.cells[0];
    let st = initialSugarRushMaze();
    st.player = { from: map.start, to: cell, edgeT: 0.9, heading: "n" };

    st = step(st, desired(null), 200);
    expect(st.reversedControls).toBeGreaterThan(0);

    st = step(st, desired("e"), 10);
    expect(st.queuedHeading).toBe("w");
  });

  it("syrup slows the player's movement through it", () => {
    const map = buildCandyCity();
    const syrup = map.hazards.find((h) => h.kind === "syrup")! as any;
    const cell = syrup.cells[0];

    let inSyrup = initialSugarRushMaze();
    inSyrup.player = { from: cell, to: cell, edgeT: 0, heading: null };
    // Fabricate an open heading regardless of the real maze topology at this cell —
    // we only care about the speed multiplier, not real pathing here.
    (inSyrup.player as any).heading = null;
    inSyrup = step(inSyrup, desired(firstOpenDir(map, cell)), 100);

    let outside = initialSugarRushMaze();
    outside.player = { from: map.start, to: map.start, edgeT: 0, heading: null };
    outside = step(outside, desired(firstOpenDir(map, map.start)), 100);

    expect(inSyrup.player.edgeT).toBeLessThan(outside.player.edgeT);
  });
});

describe("power-ups", () => {
  it("a shield blocks exactly one hit instead of costing a heart", () => {
    let st = initialSugarRushMaze();
    st.activePowerups = [{ kind: "shield", timeLeft: 999 }];
    st.cavity = { ...st.cavity, from: st.player.to, to: st.player.to, edgeT: 0, heading: null, mode: "chase", stunTimer: 0 };

    st = step(st, desired(null), 16);

    expect(st.hearts).toBe(MAX_HEARTS);
    expect(st.activePowerups.find((p) => p.kind === "shield")).toBeUndefined();
  });

  it("a magnet auto-collects nearby treats", () => {
    const map = buildCandyCity();
    const item = map.collectibles.find((c) => c.kind === "gummy")!;
    let st = initialSugarRushMaze();
    st.player = { from: item, to: item, edgeT: 0, heading: null };
    st.activePowerups = [{ kind: "magnet", timeLeft: 8 }];

    st = step(st, desired(null), 16);
    expect(st.taken[item.id]).toBe(true);
  });
});

describe("hearts, checkpoints and respawn", () => {
  it("losing a heart respawns at the last checkpoint, not the map start", () => {
    const map = buildCandyCity();
    const cp = map.checkpoints[0];
    let st = initialSugarRushMaze();
    st.checkpoint = cp.index;
    st.checkpointCell = { c: cp.c, r: cp.r };
    st.player = { from: map.start, to: map.start, edgeT: 0, heading: null };
    st.cavity = { ...st.cavity, from: map.start, to: map.start, edgeT: 0, heading: null, mode: "chase", stunTimer: 0 };

    st = step(st, desired(null), 16);

    expect(st.hearts).toBe(MAX_HEARTS - 1);
    expect(st.status).toBe("playing");
    expect(st.player.to).toEqual({ c: cp.c, r: cp.r });
  });

  it("runs out of hearts and fails after enough hits", () => {
    const map = buildCandyCity();
    let st = initialSugarRushMaze();
    for (let i = 0; i < MAX_HEARTS; i++) {
      st.invuln = 0;
      st.player = { from: map.start, to: map.start, edgeT: 0, heading: null };
      st.cavity = { ...st.cavity, from: map.start, to: map.start, edgeT: 0, heading: null, mode: "chase", stunTimer: 0 };
      st = step(st, desired(null), 16);
    }
    expect(st.status).toBe("failed");
  });

  it("retryFromCheckpoint restores full hearts and repositions at the checkpoint", () => {
    const map = buildCandyCity();
    const cp = map.checkpoints[0];
    let st = initialSugarRushMaze();
    st.status = "failed";
    st.hearts = 0;
    st.checkpoint = cp.index;
    st.checkpointCell = { c: cp.c, r: cp.r };

    const restored = retryFromCheckpoint(st);
    expect(restored.status).toBe("playing");
    expect(restored.hearts).toBe(MAX_HEARTS);
    expect(restored.player.to).toEqual({ c: cp.c, r: cp.r });
  });
});

describe("objective and exit", () => {
  it("collecting all frosting gems unlocks the exit, then reaching it completes the run", () => {
    const map = buildCandyCity();
    const gems = map.collectibles.filter((c) => c.kind === "frostingGem");
    let st = initialSugarRushMaze();

    for (const gem of gems) {
      st.player = { from: map.start, to: gem, edgeT: 0.9, heading: "n" };
      st = step(st, desired(null), 200);
    }
    expect(st.objectiveProgress).toBe(3);
    expect(st.exitUnlocked).toBe(true);
    expect(st.status).toBe("playing");

    st.player = { from: map.start, to: map.exit, edgeT: 0.9, heading: "n" };
    st = step(st, desired(null), 200);
    expect(st.status).toBe("complete");
  });

  it("reaching the exit before the objective is done does not end the run", () => {
    const map = buildCandyCity();
    let st = initialSugarRushMaze();
    st.player = { from: map.start, to: map.exit, edgeT: 0.9, heading: "n" };
    st = step(st, desired(null), 200);
    expect(st.status).toBe("playing");
  });
});

describe("scoreRun", () => {
  it("summarizes the run stats", () => {
    let st = initialSugarRushMaze();
    st.score = 1234;
    st.treatsCollected = 7;
    st.rushActivations = 2;
    st.hearts = 2;
    for (let i = 0; i < 50; i++) st = step(st, desired(null), 100);
    const summary = scoreRun(st);
    expect(summary.score).toBe(1234);
    expect(summary.treatsCollected).toBe(7);
    expect(summary.rushActivations).toBe(2);
    expect(summary.heartsRemaining).toBe(2);
    expect(summary.elapsedMs).toBeGreaterThanOrEqual(5000);
  });
});
