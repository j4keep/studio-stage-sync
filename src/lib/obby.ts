/**
 * YAJ Obby — a Roblox-style obstacle course.
 *
 * The course itself is pure data so the renderer, the physics step and the
 * multiplayer sync all agree on where every platform is at a given moment.
 */

export type PlatKind = "start" | "static" | "moving" | "lava" | "checkpoint" | "finish";

export type Plat = {
  id: number;
  /** Centre of the platform (y is the TOP surface). */
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  kind: PlatKind;
  hue: number;
  /** Moving platforms slide back and forth forever. */
  mv?: { axis: "x" | "y" | "z"; amp: number; speed: number; phase: number };
};

export const PLAYER_RADIUS = 0.42;
export const GRAVITY = 26;
export const JUMP_V = 9.6;
export const RUN_SPEED = 7.2;
export const AIR_CONTROL = 0.75;
export const FALL_DEATH_Y = -14;
export const PLAT_THICKNESS = 0.7;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds the (fixed, deterministic) course every player races on. */
function buildCourse(): Plat[] {
  const rnd = mulberry32(0x0bby7);
  const out: Plat[] = [];
  let id = 0;
  let z = 0;
  let y = 0;

  const push = (p: Omit<Plat, "id">) => {
    out.push({ ...p, id: id++ });
  };

  // Spawn pad
  push({ x: 0, y: 0, z: 0, w: 9, d: 9, kind: "start", hue: 150 });
  z = 7;

  const SEGMENTS = 9;
  for (let s = 0; s < SEGMENTS; s++) {
    const steps = 3 + Math.floor(rnd() * 2);
    for (let i = 0; i < steps; i++) {
      const gap = 3.4 + rnd() * 2.1;
      z += gap + 2.4;
      y += (rnd() - 0.35) * 1.1;
      const x = (rnd() - 0.5) * 7;
      const roll = rnd();
      const hue = (s * 41 + i * 17) % 360;

      if (roll > 0.78) {
        // Sliding platform
        push({
          x,
          y,
          z,
          w: 3.4,
          d: 3.4,
          kind: "moving",
          hue,
          mv: {
            axis: rnd() > 0.35 ? "x" : "y",
            amp: 2.6 + rnd() * 2.4,
            speed: 0.5 + rnd() * 0.5,
            phase: rnd() * Math.PI * 2,
          },
        });
      } else if (roll > 0.62) {
        // Narrow beam + a lava block beside it to punish sloppy lines
        push({ x, y, z, w: 1.7, d: 6.5, kind: "static", hue });
        push({ x: x + (rnd() > 0.5 ? 3.6 : -3.6), y, z, w: 3, d: 3, kind: "lava", hue: 12 });
        z += 2;
      } else {
        push({ x, y, z, w: 3.6 + rnd() * 1.6, d: 3.6, kind: "static", hue });
      }
    }

    // Checkpoint pad closes every segment
    z += 5.6;
    y += 0.4;
    push({ x: 0, y, z, w: 6, d: 5, kind: "checkpoint", hue: 190 });
  }

  z += 7;
  push({ x: 0, y, z, w: 10, d: 8, kind: "finish", hue: 48 });
  return out;
}

export const COURSE: Plat[] = buildCourse();
export const FINISH = COURSE[COURSE.length - 1];
export const CHECKPOINTS: Plat[] = COURSE.filter((p) => p.kind === "checkpoint" || p.kind === "start");
export const COURSE_LENGTH = FINISH.z;

/** Live world position of a platform at time `t` (seconds). */
export function platPos(p: Plat, t: number): [number, number, number] {
  if (!p.mv) return [p.x, p.y, p.z];
  const o = Math.sin(t * p.mv.speed * Math.PI * 2 * 0.35 + p.mv.phase) * p.mv.amp;
  return [p.x + (p.mv.axis === "x" ? o : 0), p.y + (p.mv.axis === "y" ? o : 0), p.z + (p.mv.axis === "z" ? o : 0)];
}

export function platColor(p: Plat) {
  switch (p.kind) {
    case "start":
      return "#3ddc84";
    case "checkpoint":
      return "#37c8ff";
    case "finish":
      return "#ffd23f";
    case "lava":
      return "#ff4d1c";
    case "moving":
      return `hsl(${p.hue} 85% 62%)`;
    default:
      return `hsl(${p.hue} 70% 58%)`;
  }
}

/** Which platform (if any) the player is standing on / touching from above. */
export function platformUnder(
  px: number,
  py: number,
  pz: number,
  t: number,
  tolerance = 0.45,
): { plat: Plat; top: number } | null {
  let best: { plat: Plat; top: number } | null = null;
  for (const p of COURSE) {
    const [x, y, z] = platPos(p, t);
    if (Math.abs(px - x) > p.w / 2 + PLAYER_RADIUS) continue;
    if (Math.abs(pz - z) > p.d / 2 + PLAYER_RADIUS) continue;
    if (py < y - 0.2 || py > y + tolerance) continue;
    if (!best || y > best.top) best = { plat: p, top: y };
  }
  return best;
}

export function nearestCheckpoint(z: number): Plat {
  let best = CHECKPOINTS[0];
  for (const c of CHECKPOINTS) if (c.z <= z + 0.5 && c.z >= best.z) best = c;
  return best;
}

export function progressPct(z: number) {
  return Math.max(0, Math.min(100, Math.round((z / COURSE_LENGTH) * 100)));
}

export function formatMs(ms: number) {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return m > 0 ? `${m}:${r.toFixed(2).padStart(5, "0")}` : `${r.toFixed(2)}s`;
}

export type ObbyState = {
  /** Race outcome, stored on the game row so both phones agree. */
  winnerSeat: 0 | 1 | null;
  times: [number | null, number | null];
  phase: "racing" | "over";
};

export function initialObby(): ObbyState {
  return { winnerSeat: null, times: [null, null], phase: "racing" };
}
