/**
 * Football as a real-time dodge-run: each "drive" is one player dragging their
 * ball carrier downfield, juking defenders, until they're tackled or reach the
 * end zone. The run itself is fully local/ephemeral (like a shot in Pool) — only
 * the *result* of a drive is persisted here, and possession of "whose drive is
 * next" alternates the same way turns do in every other game in this app.
 */

export type Seat = 0 | 1;

export type DriveResult = {
  yards: number;
  touchdown: boolean;
  dodges: number;
  score: number;
};

export type DriveLog = { seat: Seat; result: DriveResult };

export type FootballRunPhase = "active" | "over";

export type FootballRunState = {
  scores: [number, number];
  drivesPlayed: [number, number];
  /** Whose drive is up next. */
  possession: Seat;
  maxDrives: number;
  phase: FootballRunPhase;
  winnerSeat: Seat | null;
  lastDrive: DriveLog | null;
  driveNumber: number;
};

export const MAX_DRIVES_PER_SIDE = 3;
export const YARD_POINTS = 1;
export const DODGE_POINTS = 50;
export const TOUCHDOWN_POINTS = 500;

export function initialFootballRun(): FootballRunState {
  return {
    scores: [0, 0],
    drivesPlayed: [0, 0],
    possession: 0,
    maxDrives: MAX_DRIVES_PER_SIDE,
    phase: "active",
    winnerSeat: null,
    lastDrive: null,
    driveNumber: 0,
  };
}

export function scoreDrive(yards: number, dodges: number, touchdown: boolean): number {
  return Math.round(Math.max(0, yards) * YARD_POINTS + dodges * DODGE_POINTS + (touchdown ? TOUCHDOWN_POINTS : 0));
}

/** Applies a finished drive's result and hands possession to whoever runs next. */
export function applyDriveResult(state: FootballRunState, seat: Seat, result: DriveResult): FootballRunState {
  const oppSeat: Seat = seat === 0 ? 1 : 0;
  const scores: [number, number] = [...state.scores] as [number, number];
  scores[seat] += result.score;
  const drivesPlayed: [number, number] = [...state.drivesPlayed] as [number, number];
  drivesPlayed[seat] += 1;

  const bothDone = drivesPlayed[0] >= state.maxDrives && drivesPlayed[1] >= state.maxDrives;
  let phase: FootballRunPhase = "active";
  let winnerSeat: Seat | null = null;
  let possession: Seat = state.possession;

  if (bothDone) {
    phase = "over";
    winnerSeat = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;
  } else {
    possession = drivesPlayed[oppSeat] < state.maxDrives ? oppSeat : seat;
  }

  return {
    ...state,
    scores,
    drivesPlayed,
    possession,
    phase,
    winnerSeat,
    lastDrive: { seat, result },
    driveNumber: state.driveNumber + 1,
  };
}

export type DefenderSpawn = { yardLine: number; laneX: number };

/** Evenly spread defenders downfield with lateral jitter, injectable RNG for tests. */
export function spawnDefenders(count: number, rand: () => number = Math.random): DefenderSpawn[] {
  const spawns: DefenderSpawn[] = [];
  const span = 92 / count;
  for (let i = 0; i < count; i++) {
    const yardLine = 10 + i * span + rand() * span * 0.6;
    const laneX = 15 + rand() * 70;
    spawns.push({ yardLine, laneX });
  }
  return spawns;
}
