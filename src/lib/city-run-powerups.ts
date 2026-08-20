/**
 * YAJ Adventures — shared power-up system.
 *
 * Deliberately engine-agnostic and pure so the other planned YAJ Adventures games (Treasure
 * Rush, Tower Escape, Survival Island, Neighborhood Adventure) can reuse the same three
 * pickups without importing anything City Run specific: MAGNET pulls nearby collectibles in,
 * SHIELD eats exactly one hazard hit, BOOST briefly speeds you up and pays bonus points.
 *
 * State is a plain record of remaining seconds per kind, so a game loop just calls
 * `tickPowerUps(state, dt)` each frame and reads the helpers.
 */

export type PowerUpKind = "magnet" | "shield" | "boost";

export const POWER_UP_KINDS: PowerUpKind[] = ["magnet", "shield", "boost"];

/** Seconds each power-up stays active once picked up (shield is until it's spent). */
export const POWER_UP_DURATION: Record<PowerUpKind, number> = {
  magnet: 7,
  shield: 12,
  boost: 5,
};

export const POWER_UP_LABEL: Record<PowerUpKind, string> = {
  magnet: "MAGNET",
  shield: "SHIELD",
  boost: "BOOST",
};

export const POWER_UP_BLURB: Record<PowerUpKind, string> = {
  magnet: "Pulls nearby YAJ Stars to you",
  shield: "Absorbs one obstacle hit",
  boost: "Faster running + bonus points",
};

/** Distance (in course units) a magnet vacuums stars from. */
export const MAGNET_RANGE = 26;
/** Lane spread the magnet reaches across — 2 covers the whole 3-lane street. */
export const MAGNET_LANE_REACH = 2;
/** Speed multiplier while boosting. */
export const BOOST_SPEED = 1.55;
/** Bonus points per second of boost. */
export const BOOST_POINTS_PER_SECOND = 12;
/** Points awarded just for grabbing a power-up. */
export const POWER_UP_POINTS = 10;

export type PowerUpState = Record<PowerUpKind, number>;

export function initialPowerUps(): PowerUpState {
  return { magnet: 0, shield: 0, boost: 0 };
}

export function activatePowerUp(state: PowerUpState, kind: PowerUpKind): PowerUpState {
  return { ...state, [kind]: POWER_UP_DURATION[kind] };
}

/** Advances every timer by `dt` seconds. */
export function tickPowerUps(state: PowerUpState, dt: number): PowerUpState {
  return {
    magnet: Math.max(0, state.magnet - dt),
    shield: Math.max(0, state.shield - dt),
    boost: Math.max(0, state.boost - dt),
  };
}

export function isActive(state: PowerUpState, kind: PowerUpKind) {
  return state[kind] > 0;
}

/** Spends the shield charge — returns null when there was nothing to spend. */
export function consumeShield(state: PowerUpState): PowerUpState | null {
  if (state.shield <= 0) return null;
  return { ...state, shield: 0 };
}

export function activeList(state: PowerUpState): { kind: PowerUpKind; secondsLeft: number }[] {
  return POWER_UP_KINDS.filter((k) => state[k] > 0).map((k) => ({ kind: k, secondsLeft: state[k] }));
}

/** Bonus points accumulated from time spent boosting. */
export function boostBonus(secondsBoosted: number) {
  return Math.round(secondsBoosted * BOOST_POINTS_PER_SECOND);
}
