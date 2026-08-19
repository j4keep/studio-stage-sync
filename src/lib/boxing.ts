/**
 * 1v1 boxing: turn-based, alternating-action rules engine.
 *
 * Each turn the active boxer either throws a punch (jab/hook/uppercut — damage
 * scaled by their own stamina and the opponent's current guard) or holds a
 * guard (block/dodge), which reduces or can fully evade the *next* incoming
 * punch. Whoever is acting resolves the outcome locally (using their own
 * randomness) and writes the result — no shared RNG needs to travel over the
 * network, only the outcome does, same pattern as this app's other games.
 */

export type Seat = 0 | 1;
export type PunchType = "jab" | "hook" | "uppercut";
export type GuardType = "block" | "dodge";
export type Action = PunchType | GuardType;
export type Stance = "neutral" | GuardType;

export type Boxer = {
  health: number;
  stamina: number;
  stance: Stance;
  totalDamageDealt: number;
};

export type BoxingPhase = "active" | "over";

export type LastAction = {
  seat: Seat;
  action: Action;
  hit: boolean;
  damage: number;
  blocked: boolean;
  dodged: boolean;
  staggered: boolean;
  turn: number;
};

export type BoxingState = {
  boxers: [Boxer, Boxer];
  turnSeat: Seat;
  turn: number;
  phase: BoxingPhase;
  winnerSeat: Seat | null;
  decision: boolean;
  lastAction: LastAction | null;
  message: string | null;
};

export const MAX_HEALTH = 100;
export const MAX_STAMINA = 100;
export const MAX_TURNS = 40;

export const PUNCH_STATS: Record<PunchType, { min: number; max: number; cost: number; accuracy: number }> = {
  jab: { min: 3, max: 8, cost: 6, accuracy: 0.92 },
  hook: { min: 9, max: 16, cost: 14, accuracy: 0.76 },
  uppercut: { min: 16, max: 26, cost: 22, accuracy: 0.6 },
};

export const GUARD_RECOVERY: Record<GuardType, number> = {
  block: 16,
  dodge: 9,
};

export const ACTION_LABELS: Record<Action, string> = {
  jab: "Jab",
  hook: "Hook",
  uppercut: "Uppercut",
  block: "Block",
  dodge: "Dodge",
};

function newBoxer(): Boxer {
  return { health: MAX_HEALTH, stamina: MAX_STAMINA, stance: "neutral", totalDamageDealt: 0 };
}

export function initialBoxing(): BoxingState {
  return {
    boxers: [newBoxer(), newBoxer()],
    turnSeat: 0,
    turn: 1,
    phase: "active",
    winnerSeat: null,
    decision: false,
    lastAction: null,
    message: null,
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function isPunch(a: Action): a is PunchType {
  return a === "jab" || a === "hook" || a === "uppercut";
}

/**
 * Resolves one turn. `rand` defaults to Math.random but can be injected for
 * deterministic tests. Returns the next state — the caller is responsible for
 * persisting it (this function has no side effects and does no networking).
 */
export function resolveAction(state: BoxingState, seat: Seat, action: Action, rand: () => number = Math.random): BoxingState {
  const oppSeat: Seat = seat === 0 ? 1 : 0;
  const boxers: [Boxer, Boxer] = [{ ...state.boxers[0] }, { ...state.boxers[1] }];
  const attacker = boxers[seat];
  const defender = boxers[oppSeat];

  let lastAction: LastAction;
  let message: string;

  if (isPunch(action)) {
    const stats = PUNCH_STATS[action];
    const staminaFactor = clamp(attacker.stamina / stats.cost, 0.35, 1);
    attacker.stamina = clamp(attacker.stamina - stats.cost, 0, MAX_STAMINA);

    const accuracy = stats.accuracy * (0.55 + 0.45 * staminaFactor);
    const swings = rand() < accuracy;

    let hit = false;
    let dodged = false;
    let blocked = false;
    let damage = 0;

    if (swings) {
      hit = true;
      if (defender.stance === "dodge" && rand() < 0.55) {
        hit = false;
        dodged = true;
      } else {
        damage = stats.min + rand() * (stats.max - stats.min);
        damage *= 0.6 + 0.4 * staminaFactor;
        if (defender.stance === "block") {
          blocked = true;
          damage *= 0.42;
        }
        damage = Math.round(damage);
      }
    }

    const staggered = hit && action === "uppercut" && damage >= 18;
    if (hit) {
      defender.health = clamp(defender.health - damage, 0, MAX_HEALTH);
      attacker.totalDamageDealt += damage;
    }
    defender.stance = "neutral"; // a held guard only protects the very next punch
    attacker.stance = "neutral";

    lastAction = { seat, action, hit, damage, blocked, dodged, staggered, turn: state.turn };
    message = !hit
      ? dodged
        ? `${ACTION_LABELS[action]} — dodged!`
        : `${ACTION_LABELS[action]} missed.`
      : blocked
        ? `${ACTION_LABELS[action]} blocked — ${damage} dmg.`
        : `${ACTION_LABELS[action]} lands for ${damage}!${staggered ? " Staggering blow!" : ""}`;
  } else {
    const recover = GUARD_RECOVERY[action];
    attacker.stamina = clamp(attacker.stamina + recover, 0, MAX_STAMINA);
    attacker.stance = action;
    lastAction = { seat, action, hit: false, damage: 0, blocked: false, dodged: false, staggered: false, turn: state.turn };
    message = `${ACTION_LABELS[action]} — guard up.`;
  }

  // Passive recovery for whoever didn't just spend stamina attacking.
  boxers[oppSeat].stamina = clamp(boxers[oppSeat].stamina + 2, 0, MAX_STAMINA);

  let phase: BoxingPhase = "active";
  let winnerSeat: Seat | null = null;
  let decision = false;

  if (boxers[oppSeat].health <= 0) {
    phase = "over";
    winnerSeat = seat;
    message += ` Knockout!`;
  } else if (boxers[seat].health <= 0) {
    // Only possible from recoil/self-effects, kept for safety — not currently reachable.
    phase = "over";
    winnerSeat = oppSeat;
  } else if (state.turn >= MAX_TURNS) {
    phase = "over";
    decision = true;
    if (boxers[0].health !== boxers[1].health) {
      winnerSeat = boxers[0].health > boxers[1].health ? 0 : 1;
    } else if (boxers[0].totalDamageDealt !== boxers[1].totalDamageDealt) {
      winnerSeat = boxers[0].totalDamageDealt > boxers[1].totalDamageDealt ? 0 : 1;
    } else {
      winnerSeat = null; // a true draw
    }
    message += " Goes the distance — decision!";
  }

  return {
    boxers,
    turnSeat: phase === "over" ? state.turnSeat : oppSeat,
    turn: state.turn + 1,
    phase,
    winnerSeat,
    decision,
    lastAction,
    message,
  };
}

/** Simple computer opponent: leans defensive when hurt/tired, aggressive when the opponent is low. */
export function computerAction(state: BoxingState, seat: Seat, rand: () => number = Math.random): Action {
  const oppSeat: Seat = seat === 0 ? 1 : 0;
  const me = state.boxers[seat];
  const opp = state.boxers[oppSeat];

  if (me.stamina < 12) return rand() < 0.7 ? "block" : "dodge";
  if (opp.health <= 22 && me.stamina >= PUNCH_STATS.uppercut.cost) return "uppercut";

  const r = rand();
  if (me.stamina < 25) {
    if (r < 0.45) return "block";
    if (r < 0.7) return "dodge";
    return "jab";
  }
  if (r < 0.4) return "jab";
  if (r < 0.7) return "hook";
  if (r < 0.85 && me.stamina >= PUNCH_STATS.uppercut.cost) return "uppercut";
  if (r < 0.93) return "block";
  return "dodge";
}
