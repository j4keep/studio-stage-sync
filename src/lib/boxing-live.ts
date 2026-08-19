/**
 * Real-time boxing: no turns. Both fighters act freely and simultaneously —
 * they step in, punch on their own cooldowns, and hold a guard whenever they
 * like. Each client owns its own fighter (health / stamina / guard / position)
 * and the *attacker* resolves its own punch against the last-known guard of the
 * opponent, then broadcasts the outcome. Health totals are reconciled by
 * periodic snapshots from whoever owns the fighter.
 *
 * This module is pure: no React, no networking. The hook drives it.
 */

export type Punch = "jab" | "hook" | "uppercut";
export type Guard = "block" | "dodge";
export type LiveAction = Punch | Guard;
export type MoveDir = "in" | "out";

export const MAX_HEALTH = 100;
export const MAX_STAMINA = 100;
/** Match length in seconds before it goes to a decision. */
export const ROUND_SECONDS = 150;

/** Movement: each fighter travels 0 (own corner) → MAX_ADVANCE (center of the ring). */
export const MAX_ADVANCE = 100;
export const STEP = 34;
export const MOVE_COOLDOWN_MS = 190;
/** Free lunge distance every punch carries with it. */
export const LUNGE = 62;

export const PUNCHES: Record<Punch, { min: number; max: number; cost: number; accuracy: number; reach: number; cooldownMs: number; windupMs: number }> = {
  jab: { min: 3, max: 8, cost: 6, accuracy: 0.92, reach: 96, cooldownMs: 330, windupMs: 110 },
  hook: { min: 9, max: 16, cost: 14, accuracy: 0.78, reach: 82, cooldownMs: 620, windupMs: 170 },
  uppercut: { min: 16, max: 26, cost: 22, accuracy: 0.62, reach: 70, cooldownMs: 900, windupMs: 220 },
};

export const GUARD_MS: Record<Guard, number> = { block: 1200, dodge: 700 };
export const GUARD_COOLDOWN_MS = 380;
/** Stamina gained per second. */
export const REGEN_IDLE = 7;
export const REGEN_BLOCK = 20;
export const REGEN_DODGE = 11;

export const ACTION_LABELS: Record<LiveAction, string> = {
  jab: "Jab",
  hook: "Hook",
  uppercut: "Uppercut",
  block: "Block",
  dodge: "Dodge",
};

export type FighterLive = {
  health: number;
  stamina: number;
  /** Held guard, expires on its own. */
  guard: Guard | null;
  guardUntil: number;
  /** 0 = own corner, MAX_ADVANCE = center. */
  advance: number;
};

export function newFighter(): FighterLive {
  return { health: MAX_HEALTH, stamina: MAX_STAMINA, guard: null, guardUntil: 0, advance: 0 };
}

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/** Distance still separating the two fighters, in ring units. */
export function gapBetween(a: FighterLive, b: FighterLive) {
  return Math.max(0, 2 * MAX_ADVANCE - a.advance - b.advance);
}

export type PunchOutcome = {
  punch: Punch;
  hit: boolean;
  damage: number;
  blocked: boolean;
  dodged: boolean;
  tooFar: boolean;
  staggered: boolean;
  message: string;
};

/**
 * Resolves one punch thrown by `attacker` at `defender` using the attacker's
 * randomness. Does not mutate anything — the caller applies the outcome.
 */
export function resolvePunch(
  punch: Punch,
  attacker: FighterLive,
  defender: FighterLive,
  now: number,
  rand: () => number = Math.random,
): PunchOutcome {
  const stats = PUNCHES[punch];
  const staminaFactor = clamp(attacker.stamina / Math.max(1, stats.cost * 2), 0.35, 1);
  const gap = gapBetween(attacker, defender);
  const guardActive = defender.guard && defender.guardUntil > now ? defender.guard : null;

  if (gap > stats.reach + LUNGE) {
    return { punch, hit: false, damage: 0, blocked: false, dodged: false, tooFar: true, staggered: false, message: `${ACTION_LABELS[punch]} — too far, step in!` };
  }

  const accuracy = stats.accuracy * (0.6 + 0.4 * staminaFactor);
  if (rand() >= accuracy) {
    return { punch, hit: false, damage: 0, blocked: false, dodged: false, tooFar: false, staggered: false, message: `${ACTION_LABELS[punch]} missed.` };
  }
  if (guardActive === "dodge" && rand() < 0.6) {
    return { punch, hit: false, damage: 0, blocked: false, dodged: true, tooFar: false, staggered: false, message: `${ACTION_LABELS[punch]} — dodged!` };
  }

  let damage = stats.min + rand() * (stats.max - stats.min);
  damage *= 0.65 + 0.35 * staminaFactor;
  const blocked = guardActive === "block";
  if (blocked) damage *= 0.4;
  damage = Math.max(1, Math.round(damage));
  const staggered = punch === "uppercut" && damage >= 18;

  return {
    punch,
    hit: true,
    damage,
    blocked,
    dodged: false,
    tooFar: false,
    staggered,
    message: blocked
      ? `${ACTION_LABELS[punch]} blocked — ${damage} dmg.`
      : `${ACTION_LABELS[punch]} lands for ${damage}!${staggered ? " Staggering blow!" : ""}`,
  };
}

/** Applies per-tick stamina regen and expires a held guard. */
export function tickFighter(f: FighterLive, dtMs: number, now: number): FighterLive {
  const guardActive = f.guard && f.guardUntil > now ? f.guard : null;
  const rate = guardActive === "block" ? REGEN_BLOCK : guardActive === "dodge" ? REGEN_DODGE : REGEN_IDLE;
  return {
    ...f,
    stamina: clamp(f.stamina + (rate * dtMs) / 1000, 0, MAX_STAMINA),
    guard: guardActive,
    guardUntil: guardActive ? f.guardUntil : 0,
  };
}

/** Free-fighting computer opponent — punches, guards and steps on its own clock. */
export function computerIntent(
  me: FighterLive,
  opp: FighterLive,
  now: number,
  rand: () => number = Math.random,
): { kind: "punch"; punch: Punch } | { kind: "guard"; guard: Guard } | { kind: "move"; dir: MoveDir } | { kind: "wait" } {
  const gap = gapBetween(me, opp);
  const oppClosing = opp.advance > MAX_ADVANCE * 0.55;

  if (me.stamina < 12) return { kind: "guard", guard: rand() < 0.65 ? "block" : "dodge" };
  if (gap > PUNCHES.hook.reach + LUNGE) return { kind: "move", dir: "in" };
  if (me.health < 30 && oppClosing && rand() < 0.35) return { kind: "guard", guard: rand() < 0.6 ? "block" : "dodge" };

  const r = rand();
  if (opp.health <= 24 && me.stamina >= PUNCHES.uppercut.cost) return { kind: "punch", punch: "uppercut" };
  if (me.stamina < 28) {
    if (r < 0.4) return { kind: "guard", guard: "block" };
    if (r < 0.55) return { kind: "guard", guard: "dodge" };
    return { kind: "punch", punch: "jab" };
  }
  if (r < 0.38) return { kind: "punch", punch: "jab" };
  if (r < 0.64) return { kind: "punch", punch: "hook" };
  if (r < 0.76 && me.stamina >= PUNCHES.uppercut.cost) return { kind: "punch", punch: "uppercut" };
  if (r < 0.86) return { kind: "guard", guard: "block" };
  if (r < 0.93) return { kind: "guard", guard: "dodge" };
  return { kind: "move", dir: gap < 40 ? "out" : "in" };
}
