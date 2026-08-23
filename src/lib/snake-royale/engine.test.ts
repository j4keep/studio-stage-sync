import { describe, expect, it } from "vitest";
import { MAX_HEARTS, NO_INPUT, RUN_MS, initialSnakeRoyale, step } from "./engine";
import { spawnSnake, DEN_AWARENESS_RANGE, EMERGE_DURATION, RETREAT_DURATION, STRIKE_LUNGE, STRIKE_WINDUP } from "./hazards";
import type { ImpactHazard } from "./hazards";
import { GRID_W, walkable } from "./map";

// step() clamps its own per-call physics delta to 50ms regardless of the dtMs passed in
// (matching Survival Island's engine) — the one exception is timeLeft, which is
// decremented by the raw dtMs directly. Anything driven by `t` (hazard warn timers,
// snake state timers, wave escalation) needs many small calls, not one huge one.
const FRAME_MS = 40;
function tick(st: ReturnType<typeof initialSnakeRoyale>, input = NO_INPUT, ms = FRAME_MS) {
  return step(st, input, ms);
}
function ticks(st: ReturnType<typeof initialSnakeRoyale>, count: number, input = NO_INPUT, ms = FRAME_MS) {
  for (let i = 0; i < count; i++) tick(st, input, ms);
}

function freshState(endless = false) {
  const st = initialSnakeRoyale(1, endless);
  // isolate from the procedurally-placed dens/hazards/wildlife/pickups so each test
  // controls exactly what's active — natural spawn timing is covered indirectly by the
  // den/impact tests.
  st.snakes = [];
  st.impacts = [];
  st.animals = [];
  st.pickups = [];
  return st;
}

function findTile(st: ReturnType<typeof freshState>, terrain: string) {
  const i = st.map.tiles.findIndex((t) => t === terrain);
  expect(i).toBeGreaterThanOrEqual(0);
  const tx = i % GRID_W;
  const ty = Math.floor(i / GRID_W);
  return { tx, ty, x: tx * 44 + 22, y: ty * 44 + 22 };
}

describe("snake royale engine — movement", () => {
  it("never lets the player end a step standing on water", () => {
    const st = freshState();
    ticks(st, 400, { mx: 1, my: 0.4 });
    expect(walkable(st.map, st.x, st.y)).toBe(true);
  });

  it("mud slows the player relative to open grass", () => {
    const grass = findTile(freshState(), "grass");
    const mud = findTile(freshState(), "mud");

    const onGrass = freshState();
    onGrass.x = grass.x;
    onGrass.y = grass.y;
    ticks(onGrass, 40, { mx: 1, my: 0 });

    const onMud = freshState();
    onMud.x = mud.x;
    onMud.y = mud.y;
    ticks(onMud, 40, { mx: 1, my: 0 });

    expect(Math.abs(onMud.vx)).toBeLessThan(Math.abs(onGrass.vx));
  });
});

describe("snake royale engine — snake hazard", () => {
  it("emerges, strikes when the player gets close, and deals damage", () => {
    const st = freshState();
    st.map.denSpots = []; // isolate from the map's own procedurally-placed dens
    const den = { x: 1000, y: 1000, kind: "bush" as const };
    const sn = spawnSnake(den, 0);
    st.snakes.push(sn);
    st.x = den.x + 150; // within awareness range but outside strike range — stays "active"
    st.y = den.y;

    // emerging -> active
    ticks(st, Math.ceil((EMERGE_DURATION + 0.1) / (FRAME_MS / 1000)));
    expect(st.snakes[0].state).toBe("active");

    // bring the player on top of the den to force a strike
    st.x = den.x;
    st.y = den.y;
    tick(st);
    expect(st.snakes[0].state).toBe("striking");

    const heartsBefore = st.hearts;
    // advance through the windup + lunge — player hasn't moved, guaranteed contact
    ticks(st, Math.ceil((STRIKE_WINDUP + STRIKE_LUNGE + 0.1) / (FRAME_MS / 1000)));
    expect(st.hearts).toBe(heartsBefore - 1);
  });

  it("retreats and is removed once it gives up the chase", () => {
    const st = freshState();
    st.map.denSpots = []; // isolate from the map's own procedurally-placed dens
    const den = { x: 1000, y: 1000, kind: "log" as const };
    const sn = spawnSnake(den, 0);
    sn.state = "retreating";
    sn.t = 0;
    sn.x = den.x + 5;
    sn.y = den.y + 5;
    st.snakes.push(sn);
    st.x = den.x + DEN_AWARENESS_RANGE * 3;
    st.y = den.y;

    ticks(st, Math.ceil((RETREAT_DURATION * 3 + 0.5) / (FRAME_MS / 1000)));
    expect(st.snakes.length).toBe(0);
    expect(st.denCooldowns[0]).toBeGreaterThan(0);
  });
});

describe("snake royale engine — impact hazards", () => {
  function makeImpact(x: number, y: number): ImpactHazard {
    return { id: 999, kind: "rock", x, y, radius: 26, warn: 0.15, age: 0, impacted: false, linger: 0, hitPlayer: false };
  }

  it("counts a dodge when the player is clear of the impact radius", () => {
    const st = freshState();
    st.x = 0;
    st.y = 0;
    st.impacts.push(makeImpact(5000, 5000));
    const heartsBefore = st.hearts;
    ticks(st, 10);
    expect(st.dodged).toBe(1);
    expect(st.hearts).toBe(heartsBefore);
  });

  it("costs a heart when the player is standing in the impact radius", () => {
    const st = freshState();
    st.x = 500;
    st.y = 500;
    st.impacts.push(makeImpact(500, 500));
    const heartsBefore = st.hearts;
    ticks(st, 10);
    expect(st.hearts).toBe(heartsBefore - 1);
  });
});

describe("snake royale engine — croc water & hearts", () => {
  it("ticks damage while standing in shallow croc water", () => {
    const shallow = findTile(freshState(), "shallow");
    const st = freshState();
    st.x = shallow.x;
    st.y = shallow.y;
    const heartsBefore = st.hearts;
    ticks(st, 200);
    expect(st.hearts).toBeLessThan(heartsBefore);
  });

  it("ends the run the same way (status over) whether timed or endless", () => {
    const timed = freshState(false);
    timed.hearts = 1;
    timed.impacts.push({ id: 1, kind: "branch", x: timed.x, y: timed.y, radius: 40, warn: 0.05, age: 0, impacted: false, linger: 0, hitPlayer: false });
    ticks(timed, 5);
    expect(timed.status).toBe("over");

    const endless = freshState(true);
    endless.hearts = 1;
    endless.impacts.push({ id: 2, kind: "branch", x: endless.x, y: endless.y, radius: 40, warn: 0.05, age: 0, impacted: false, linger: 0, hitPlayer: false });
    ticks(endless, 5);
    expect(endless.status).toBe("over");
  });
});

describe("snake royale engine — timer", () => {
  it("a timed run ends once RUN_MS elapses without escaping", () => {
    const st = freshState(false);
    const iterations = Math.ceil(RUN_MS / 5000) + 2;
    for (let i = 0; i < iterations; i++) {
      st.snakes = [];
      st.impacts = [];
      step(st, NO_INPUT, 5000); // timeLeft is decremented by the raw dtMs, by design
    }
    expect(st.timeLeft).toBe(0);
    // Running out of the clock is always a loss now — "survived" only comes from
    // actually escaping via the extraction jeep (tickJeep), which this run never reaches.
    expect(st.status).toBe("over");
  });

  it("an endless (solo) run never auto-completes from the clock", () => {
    const st = freshState(true);
    for (let i = 0; i < RUN_MS / 1000 / 0.05 + 200; i++) {
      st.snakes = [];
      st.impacts = [];
      step(st, NO_INPUT, 50); // 50ms so the internal 50ms clamp doesn't waste any of it
    }
    expect(st.status).toBe("alive");
    expect(st.t).toBeGreaterThan(RUN_MS / 1000);
  });
});

describe("snake royale engine — hearts constant sanity", () => {
  it("starts with MAX_HEARTS", () => {
    expect(initialSnakeRoyale(1, false).hearts).toBe(MAX_HEARTS);
  });
});
