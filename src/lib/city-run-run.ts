/**
 * YAJ City Run as a real-time course dash: each "run" is one player traveling through a
 * hand-designed sequence of city sections — a street, a construction zone, a branching alley
 * vs. main-street choice, a park, a rooftop, a bridge, a final block — to the finish line, or
 * as far as they get before running out of stumbles. Same "attempt-based" pattern as every
 * other arcade game this session: the run itself is fully local/ephemeral, only the *result*
 * is persisted here, and possession of "whose run is next" alternates the same way turns do
 * everywhere else in this app.
 *
 * Course *structure* — section order, length, theme, difficulty, the one branch point — is
 * hand-designed below, the same way Mini Golf's holes are hand-designed. What's procedural is
 * the exact obstacle/star placement *within* each section, using the same "one item per
 * distance step, always in a single lane" generator the original flat course used (so two of
 * the three lanes are still always open — a lane change alone always works).
 */

import { POWER_UP_KINDS, PowerUpKind } from "@/lib/city-run-powerups";

export type Seat = 0 | 1;
export type Lane = 0 | 1 | 2;

export type GroundKind = "cone" | "trash" | "barrier" | "puddle" | "box" | "bike" | "roadwork" | "car";
export type OverheadKind = "sign";
export type ObstacleKind = GroundKind | OverheadKind;
export type ItemKind = ObstacleKind | "star" | PowerUpKind;

export function isPowerUpKind(kind: ItemKind): kind is PowerUpKind {
  return (POWER_UP_KINDS as string[]).includes(kind);
}


export type SectionId =
  | "street_start"
  | "construction"
  | "alley"
  | "main_street"
  | "park"
  | "rooftop"
  | "bridge"
  | "final_block";

export type Background = "street" | "construction" | "alley" | "park" | "rooftop" | "bridge" | "finalBlock";
export type Branch = "alley" | "main_street";

export type CourseItem = { distance: number; lane: Lane; kind: ItemKind; sectionId: SectionId };

export type SectionSpec = {
  id: SectionId;
  name: string;
  start: number;
  end: number;
  background: Background;
  obstacleKinds: ObstacleKind[];
  starChance: number;
  minGap: number;
  maxGap: number;
};

export const LANE_COUNT = 3;
export const ITEM_HALF_WIDTH = 3;

/** The one branch point — a fork the player chooses at, not a tree of many. */
export const JUNCTION_START = 150;
export const JUNCTION_END = 160;
// The first checkpoint sits just before the junction, not exactly on top of it — otherwise the
// "CHECKPOINT!" popup and the path-choice fork trigger in the same tick and visually collide.
export const CHECKPOINTS = [140, 320, 430];
export const FINISH_DISTANCE = 590;

export const SECTIONS: SectionSpec[] = [
  { id: "street_start", name: "Downtown Street", start: 0, end: 80, background: "street", obstacleKinds: ["cone", "trash", "puddle"], starChance: 0.3, minGap: 10, maxGap: 16 },
  { id: "construction", name: "Construction Zone", start: 80, end: JUNCTION_START, background: "construction", obstacleKinds: ["barrier", "roadwork", "cone", "sign"], starChance: 0.22, minGap: 9, maxGap: 13 },
  { id: "alley", name: "Side Alley", start: JUNCTION_END, end: 250, background: "alley", obstacleKinds: ["box", "bike", "trash"], starChance: 0.38, minGap: 8, maxGap: 12 },
  { id: "main_street", name: "Main Street", start: JUNCTION_END, end: 250, background: "street", obstacleKinds: ["car", "cone", "puddle"], starChance: 0.2, minGap: 11, maxGap: 16 },
  { id: "park", name: "City Park", start: 250, end: 320, background: "park", obstacleKinds: ["puddle", "trash", "bike"], starChance: 0.3, minGap: 11, maxGap: 15 },
  { id: "rooftop", name: "Rooftop Run", start: 340, end: 430, background: "rooftop", obstacleKinds: ["sign", "barrier", "box"], starChance: 0.32, minGap: 8, maxGap: 12 },
  { id: "bridge", name: "City Bridge", start: 450, end: 520, background: "bridge", obstacleKinds: ["car", "cone", "sign"], starChance: 0.26, minGap: 10, maxGap: 14 },
  { id: "final_block", name: "Final Block", start: 520, end: FINISH_DISTANCE, background: "finalBlock", obstacleKinds: ["barrier", "cone", "trash", "sign"], starChance: 0.28, minGap: 9, maxGap: 13 },
];

/** The section (if any) covering a given distance for the branch the player is on — null in a
 *  transitional zone (the junction fork itself, the rooftop ramp, the drop back to street). */
export function sectionAt(distance: number, branch: Branch): SectionSpec | null {
  for (const s of SECTIONS) {
    if (s.id === "alley" && branch !== "alley") continue;
    if (s.id === "main_street" && branch !== "main_street") continue;
    if (distance >= s.start && distance < s.end) return s;
  }
  return null;
}

/** Odds any one slot becomes a power-up instead of a star/obstacle. */
export const POWER_UP_CHANCE = 0.07;

/** One item per distance step, always a single lane, injectable RNG — the same generator the
 *  original flat course used, just parametrized per section. */

function generateSectionItems(spec: SectionSpec, rand: () => number): CourseItem[] {
  const items: CourseItem[] = [];
  let d = spec.start + spec.minGap;
  while (d < spec.end - spec.minGap / 2) {
    const lane = Math.floor(rand() * LANE_COUNT) as Lane;
    const roll = rand();
    const kind: ItemKind =
      roll < POWER_UP_CHANCE
        ? POWER_UP_KINDS[Math.floor(rand() * POWER_UP_KINDS.length)]
        : roll < POWER_UP_CHANCE + spec.starChance
          ? "star"
          : spec.obstacleKinds[Math.floor(rand() * spec.obstacleKinds.length)];
    items.push({ distance: d, lane, kind, sectionId: spec.id });

    d += spec.minGap + rand() * (spec.maxGap - spec.minGap);
  }
  return items;
}

/** Generates items for every section, both branches included — the board filters out whichever
 *  branch the player didn't take once the junction choice is made. */
export function generateCourse(rand: () => number = Math.random): CourseItem[] {
  let items: CourseItem[] = [];
  for (const spec of SECTIONS) items = items.concat(generateSectionItems(spec, rand));
  return items;
}

export type RunResult = {
  distance: number;
  stars: number;
  checkpoints: number;
  stumbles: number;
  finished: boolean;
  score: number;
};

export type RunLog = { seat: Seat; result: RunResult };
export type CityRunPhase = "active" | "over";

export type CityRunState = {
  scores: [number, number];
  runsPlayed: [number, number];
  finishes: [number, number];
  possession: Seat;
  maxRuns: number;
  phase: CityRunPhase;
  winnerSeat: Seat | null;
  lastRun: RunLog | null;
  runNumber: number;
};

export const MAX_RUNS_PER_SIDE = 3;
export const STUMBLE_LIVES = 3;
export const DISTANCE_POINTS = 0.3;
export const STAR_POINTS = 20;
export const CHECKPOINT_POINTS = 15;
export const FINISH_POINTS = 300;

export function initialCityRun(): CityRunState {
  return {
    scores: [0, 0],
    runsPlayed: [0, 0],
    finishes: [0, 0],
    possession: 0,
    maxRuns: MAX_RUNS_PER_SIDE,
    phase: "active",
    winnerSeat: null,
    lastRun: null,
    runNumber: 0,
  };
}

export function scoreRun(distance: number, stars: number, checkpoints: number, finished: boolean): number {
  return Math.round(
    Math.max(0, distance) * DISTANCE_POINTS + stars * STAR_POINTS + checkpoints * CHECKPOINT_POINTS + (finished ? FINISH_POINTS : 0),
  );
}

/** Applies a finished run's result and hands the next run to the other seat. */
export function applyRunResult(state: CityRunState, seat: Seat, result: RunResult): CityRunState {
  const oppSeat: Seat = seat === 0 ? 1 : 0;
  const scores: [number, number] = [...state.scores] as [number, number];
  scores[seat] += result.score;
  const runsPlayed: [number, number] = [...state.runsPlayed] as [number, number];
  runsPlayed[seat] += 1;
  const finishes: [number, number] = [...state.finishes] as [number, number];
  if (result.finished) finishes[seat] += 1;

  const bothDone = runsPlayed[0] >= state.maxRuns && runsPlayed[1] >= state.maxRuns;
  let phase: CityRunPhase = "active";
  let winnerSeat: Seat | null = null;
  let possession: Seat = state.possession;

  if (bothDone) {
    phase = "over";
    winnerSeat = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;
  } else {
    possession = runsPlayed[oppSeat] < state.maxRuns ? oppSeat : seat;
  }

  return {
    ...state,
    scores,
    runsPlayed,
    finishes,
    possession,
    phase,
    winnerSeat,
    lastRun: { seat, result },
    runNumber: state.runNumber + 1,
  };
}
