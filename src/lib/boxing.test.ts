import { describe, expect, it } from "vitest";
import { MAX_HEALTH, MAX_STAMINA, MAX_TURNS, computerAction, initialBoxing, resolveAction } from "./boxing";

describe("boxing", () => {
  it("starts both boxers at full health and stamina, seat 0 to act", () => {
    const s = initialBoxing();
    expect(s.boxers[0].health).toBe(MAX_HEALTH);
    expect(s.boxers[1].health).toBe(MAX_HEALTH);
    expect(s.boxers[0].stamina).toBe(MAX_STAMINA);
    expect(s.turnSeat).toBe(0);
    expect(s.phase).toBe("active");
  });

  it("a guaranteed-hit jab damages the defender and passes the turn", () => {
    const s = initialBoxing();
    // rand() < accuracy always true, and never triggers the dodge-chance branch either.
    const next = resolveAction(s, 0, "jab", () => 0);
    expect(next.boxers[1].health).toBeLessThan(MAX_HEALTH);
    expect(next.boxers[0].stamina).toBeLessThan(MAX_STAMINA);
    expect(next.turnSeat).toBe(1);
    expect(next.turn).toBe(2);
    expect(next.lastAction?.hit).toBe(true);
  });

  it("a guaranteed-miss jab deals no damage", () => {
    const s = initialBoxing();
    const next = resolveAction(s, 0, "jab", () => 0.999);
    expect(next.boxers[1].health).toBe(MAX_HEALTH);
    expect(next.lastAction?.hit).toBe(false);
  });

  it("blocking sets the defender's stance and reduces the next punch's damage", () => {
    let s = initialBoxing();
    s = resolveAction(s, 1, "block", () => 0); // seat 1 guards up (turnSeat doesn't gate resolveAction itself)
    expect(s.boxers[1].stance).toBe("block");
    // Force a hit that isn't dodge-evaded (rand()=0 -> always "hits" and never within the 0.55 dodge-evade roll... but block, not dodge here).
    const blocked = resolveAction(s, 0, "hook", () => 0);
    expect(blocked.lastAction?.blocked).toBe(true);
    const unblockedBase = resolveAction(initialBoxing(), 0, "hook", () => 0);
    expect(blocked.lastAction!.damage).toBeLessThan(unblockedBase.lastAction!.damage);
  });

  it("dodging can fully evade the next punch", () => {
    let s = initialBoxing();
    s = resolveAction(s, 1, "dodge", () => 0);
    expect(s.boxers[1].stance).toBe("dodge");
    // rand()=0 satisfies the accuracy roll AND the < 0.55 dodge-evade roll, so it should evade.
    const evaded = resolveAction(s, 0, "jab", () => 0);
    expect(evaded.lastAction?.dodged).toBe(true);
    expect(evaded.lastAction?.hit).toBe(false);
    expect(evaded.boxers[1].health).toBe(MAX_HEALTH);
  });

  it("guard only protects the very next punch, not the one after", () => {
    let s = initialBoxing();
    s = resolveAction(s, 1, "block", () => 0);
    s = resolveAction(s, 0, "jab", () => 0); // consumes the block
    expect(s.boxers[1].stance).toBe("neutral");
    const again = resolveAction(s, 0, "jab", () => 0);
    expect(again.lastAction?.blocked).toBe(false);
  });

  it("ends in a knockout once a boxer's health hits zero", () => {
    let s = initialBoxing();
    s.boxers[1].health = 5;
    const next = resolveAction(s, 0, "uppercut", () => 0);
    expect(next.phase).toBe("over");
    expect(next.winnerSeat).toBe(0);
    expect(next.boxers[1].health).toBe(0);
  });

  it("goes to a decision after the turn limit without a knockout", () => {
    let s = initialBoxing();
    s.turn = MAX_TURNS;
    s.boxers[0].health = 80;
    s.boxers[1].health = 60;
    const next = resolveAction(s, 0, "block", () => 0.999); // miss/no-damage action, still ends the bout
    expect(next.phase).toBe("over");
    expect(next.decision).toBe(true);
    expect(next.winnerSeat).toBe(0);
  });

  it("computer opponent always returns a valid action", () => {
    const s = initialBoxing();
    const valid = ["jab", "hook", "uppercut", "block", "dodge"];
    for (let i = 0; i < 20; i++) {
      const a = computerAction(s, 1, () => i / 20);
      expect(valid).toContain(a);
    }
  });

  it("computer favors guarding when its stamina is very low", () => {
    const s = initialBoxing();
    s.boxers[1].stamina = 5;
    const a = computerAction(s, 1, () => 0.1);
    expect(["block", "dodge"]).toContain(a);
  });
});
