/**
 * 1v1 football: turn-based drive mechanic. Whoever has the ball calls a play —
 * run, short pass, long pass, punt, or field goal — and the outcome resolves
 * immediately against a simulated defense (no defensive input needed from the
 * other player, same "acting player resolves locally" pattern as this app's
 * other games). Possession only changes hands on a score, turnover, or punt —
 * the same team keeps driving across multiple consecutive plays otherwise.
 */

export type Seat = 0 | 1;
export type PlayType = "run" | "short_pass" | "long_pass" | "punt" | "field_goal";
export type PlayKind =
  | "gain"
  | "first_down"
  | "incomplete"
  | "interception"
  | "fumble"
  | "touchdown"
  | "safety"
  | "field_goal_good"
  | "field_goal_miss"
  | "punt"
  | "turnover_on_downs";

export type LastPlay = {
  seat: Seat;
  play: PlayType;
  yards: number;
  kind: PlayKind;
  down: number;
  play_number: number;
  message: string;
};

export type FootballPhase = "active" | "over";

export type FootballState = {
  /** Which seat currently has the ball. */
  possession: Seat;
  /** Yards from the possessing team's own goal line (0) toward the opponent's (100). */
  ballOn: number;
  down: number;
  yardsToGo: number;
  scores: [number, number];
  play: number;
  phase: FootballPhase;
  winnerSeat: Seat | null;
  decision: boolean;
  lastPlay: LastPlay | null;
  message: string | null;
};

export const MAX_PLAYS = 28;

export const PLAY_INFO: Record<
  "run" | "short_pass" | "long_pass",
  { min: number; max: number; completion: number; intChance: number; turnoverChance: number; label: string; hint: string }
> = {
  run: { min: -2, max: 9, completion: 1, intChance: 0, turnoverChance: 0.035, label: "Run", hint: "Steady, low risk" },
  short_pass: { min: 3, max: 11, completion: 0.72, intChance: 0.08, turnoverChance: 0, label: "Short Pass", hint: "Reliable gain" },
  long_pass: { min: 14, max: 32, completion: 0.42, intChance: 0.18, turnoverChance: 0, label: "Long Pass", hint: "High risk, big reward" },
};

export const ACTION_LABELS: Record<PlayType, string> = {
  run: "Run",
  short_pass: "Short Pass",
  long_pass: "Long Pass",
  punt: "Punt",
  field_goal: "Field Goal",
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function initialFootball(): FootballState {
  return {
    possession: 0,
    ballOn: 25,
    down: 1,
    yardsToGo: 10,
    scores: [0, 0],
    play: 1,
    phase: "active",
    winnerSeat: null,
    decision: false,
    lastPlay: null,
    message: null,
  };
}

/** Distance in yards the kicker must cover — field position plus snap/holder offset. */
export function kickDistance(ballOn: number) {
  return 100 - ballOn + 17;
}

/**
 * Resolves one play for the possessing team. `rand` defaults to Math.random but
 * can be injected for deterministic tests. Returns the next state — the caller
 * persists it (this function has no side effects and does no networking).
 */
export function resolvePlay(state: FootballState, seat: Seat, play: PlayType, rand: () => number = Math.random): FootballState {
  const oppSeat: Seat = seat === 0 ? 1 : 0;
  const scores: [number, number] = [...state.scores] as [number, number];
  const downBefore = state.down;
  const ballOnBefore = state.ballOn;
  let ballOn = state.ballOn;
  let down = state.down;
  let yardsToGo = state.yardsToGo;
  let possession = state.possession;
  let lastPlay: LastPlay;

  if (play === "field_goal") {
    const dist = kickDistance(ballOnBefore);
    const chance = clamp(1.15 - dist / 65, 0.05, 0.96);
    const good = rand() < chance;
    if (good) {
      scores[seat] += 3;
      lastPlay = { seat, play, yards: 0, kind: "field_goal_good", down: downBefore, play_number: state.play, message: `Field goal is GOOD from ${Math.round(dist)} yards!` };
      possession = oppSeat;
      ballOn = 25;
      down = 1;
      yardsToGo = 10;
    } else {
      lastPlay = { seat, play, yards: 0, kind: "field_goal_miss", down: downBefore, play_number: state.play, message: `Field goal attempt from ${Math.round(dist)} yards is NO GOOD.` };
      possession = oppSeat;
      ballOn = clamp(100 - ballOnBefore, 1, 99);
      down = 1;
      yardsToGo = 10;
    }
  } else if (play === "punt") {
    const dist = 30 + rand() * 18;
    lastPlay = { seat, play, yards: Math.round(dist), kind: "punt", down: downBefore, play_number: state.play, message: `Punt for ${Math.round(dist)} yards.` };
    possession = oppSeat;
    ballOn = clamp(100 - (ballOnBefore + dist), 1, 99);
    down = 1;
    yardsToGo = 10;
  } else {
    const stats = PLAY_INFO[play];
    let yards = 0;
    let turnover = false;
    let kind: PlayKind = "gain";

    if (play === "run") {
      if (rand() < stats.turnoverChance) {
        turnover = true;
        kind = "fumble";
      } else {
        yards = Math.round(stats.min + rand() * (stats.max - stats.min));
      }
    } else {
      const r = rand();
      if (r < stats.completion) {
        yards = Math.round(stats.min + rand() * (stats.max - stats.min));
      } else if (r < stats.completion + stats.intChance) {
        turnover = true;
        kind = "interception";
      } else {
        kind = "incomplete";
      }
    }

    if (turnover) {
      lastPlay = {
        seat,
        play,
        yards: 0,
        kind,
        down: downBefore,
        play_number: state.play,
        message: kind === "fumble" ? "FUMBLE! Turnover." : "INTERCEPTED! Turnover.",
      };
      possession = oppSeat;
      ballOn = clamp(100 - ballOnBefore, 1, 99);
      down = 1;
      yardsToGo = 10;
    } else {
      const newBallOn = ballOnBefore + yards;
      if (kind !== "incomplete" && newBallOn >= 100) {
        scores[seat] += 7;
        lastPlay = { seat, play, yards, kind: "touchdown", down: downBefore, play_number: state.play, message: `TOUCHDOWN! ${yards}-yard ${ACTION_LABELS[play]}!` };
        possession = oppSeat;
        ballOn = 25;
        down = 1;
        yardsToGo = 10;
      } else if (kind !== "incomplete" && newBallOn <= 0) {
        scores[oppSeat] += 2;
        lastPlay = { seat, play, yards, kind: "safety", down: downBefore, play_number: state.play, message: "SAFETY! Tackled in the end zone." };
        possession = oppSeat;
        ballOn = 25;
        down = 1;
        yardsToGo = 10;
      } else if (kind !== "incomplete" && yards >= yardsToGo) {
        ballOn = newBallOn;
        down = 1;
        yardsToGo = 10;
        lastPlay = { seat, play, yards, kind: "first_down", down: downBefore, play_number: state.play, message: `${ACTION_LABELS[play]} for ${yards} yards — FIRST DOWN!` };
      } else if (downBefore < 4) {
        const gained = kind === "incomplete" ? 0 : yards;
        ballOn = ballOnBefore + gained;
        down = downBefore + 1;
        yardsToGo = yardsToGo - gained;
        lastPlay = {
          seat,
          play,
          yards: gained,
          kind,
          down: downBefore,
          play_number: state.play,
          message: kind === "incomplete" ? "Incomplete pass." : `${ACTION_LABELS[play]} for ${gained} yards.`,
        };
      } else {
        const gained = kind === "incomplete" ? 0 : yards;
        lastPlay = { seat, play, yards: gained, kind: "turnover_on_downs", down: downBefore, play_number: state.play, message: "Turnover on downs!" };
        possession = oppSeat;
        ballOn = clamp(100 - (ballOnBefore + gained), 1, 99);
        down = 1;
        yardsToGo = 10;
      }
    }
  }

  let phase: FootballPhase = "active";
  let winnerSeat: Seat | null = null;
  let decision = false;
  if (state.play >= MAX_PLAYS) {
    phase = "over";
    decision = true;
    winnerSeat = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;
  }

  return {
    possession,
    ballOn: clamp(ballOn, 1, 99),
    down,
    yardsToGo,
    scores,
    play: state.play + 1,
    phase,
    winnerSeat,
    decision,
    lastPlay,
    message: lastPlay.message,
  };
}

/** Free-fighting computer play-caller: down-and-distance aware, sometimes aggressive on 4th down. */
export function computerPlay(state: FootballState, rand: () => number = Math.random): PlayType {
  const { down, yardsToGo, ballOn } = state;
  const dist = kickDistance(ballOn);

  if (down === 4) {
    if (dist <= 50 && rand() < 0.85) return "field_goal";
    if (ballOn < 60) return "punt";
    return yardsToGo <= 3 ? "run" : "short_pass";
  }
  if (yardsToGo <= 2) return rand() < 0.65 ? "run" : "short_pass";
  if (yardsToGo >= 8) return rand() < 0.5 ? "long_pass" : "short_pass";

  const r = rand();
  if (r < 0.45) return "run";
  if (r < 0.8) return "short_pass";
  return "long_pass";
}
