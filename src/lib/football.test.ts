import { describe, expect, it } from "vitest";
import { MAX_PLAYS, FootballState, computerPlay, initialFootball, resolvePlay } from "./football";

function seq(values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("football", () => {
  it("kicks off with seat 0 possessing at their own 25, first and ten", () => {
    const s = initialFootball();
    expect(s.possession).toBe(0);
    expect(s.ballOn).toBe(25);
    expect(s.down).toBe(1);
    expect(s.yardsToGo).toBe(10);
    expect(s.scores).toEqual([0, 0]);
    expect(s.phase).toBe("active");
  });

  it("a completed short pass gains yards and keeps possession on 1st down", () => {
    const s = initialFootball();
    const next = resolvePlay(s, 0, "short_pass", seq([0, 0])); // r=0 completes, yardage roll t=0 -> min yards
    expect(next.lastPlay?.kind).toBe("gain");
    expect(next.possession).toBe(0);
    expect(next.down).toBe(2);
    expect(next.play).toBe(2);
  });

  it("a big enough gain converts a first down and resets the count", () => {
    const s = initialFootball();
    const next = resolvePlay(s, 0, "short_pass", seq([0, 1])); // complete, yardage roll t=1 -> max yards (11)
    expect(next.lastPlay?.kind).toBe("first_down");
    expect(next.down).toBe(1);
    expect(next.yardsToGo).toBe(10);
    expect(next.ballOn).toBe(36);
  });

  it("an incomplete pass burns a down with no yardage", () => {
    const s = initialFootball();
    const next = resolvePlay(s, 0, "long_pass", () => 0.99); // beyond completion + int chance
    expect(next.lastPlay?.kind).toBe("incomplete");
    expect(next.ballOn).toBe(25);
    expect(next.down).toBe(2);
  });

  it("an interception turns the ball over at the spot", () => {
    const s = initialFootball();
    const next = resolvePlay(s, 0, "long_pass", () => 0.5); // between completion(.42) and completion+int(.6)
    expect(next.lastPlay?.kind).toBe("interception");
    expect(next.possession).toBe(1);
    expect(next.down).toBe(1);
    expect(next.ballOn).toBe(75);
  });

  it("a fumble on a run turns the ball over", () => {
    const s = initialFootball();
    const next = resolvePlay(s, 0, "run", () => 0); // 0 < turnoverChance
    expect(next.lastPlay?.kind).toBe("fumble");
    expect(next.possession).toBe(1);
  });

  it("failing to convert on 4th down turns the ball over on downs", () => {
    let s = initialFootball();
    s = { ...s, down: 4, yardsToGo: 10, ballOn: 50 };
    const next = resolvePlay(s, 0, "run", seq([0.5, 0])); // no fumble, yards = min (-2)
    expect(next.lastPlay?.kind).toBe("turnover_on_downs");
    expect(next.possession).toBe(1);
    expect(next.down).toBe(1);
    expect(next.ballOn).toBe(52);
  });

  it("reaching the opponent's goal line scores a touchdown and flips possession", () => {
    let s = initialFootball();
    s = { ...s, ballOn: 95 };
    const next = resolvePlay(s, 0, "long_pass", seq([0, 0])); // complete, min yards (14) -> 95+14=109
    expect(next.lastPlay?.kind).toBe("touchdown");
    expect(next.scores[0]).toBe(7);
    expect(next.possession).toBe(1);
    expect(next.ballOn).toBe(25);
    expect(next.down).toBe(1);
  });

  it("getting stuffed behind your own goal line is a safety", () => {
    let s = initialFootball();
    s = { ...s, ballOn: 1 };
    const next = resolvePlay(s, 0, "run", seq([0.5, 0])); // no fumble, yards = min (-2) -> 1-2=-1
    expect(next.lastPlay?.kind).toBe("safety");
    expect(next.scores[1]).toBe(2);
    expect(next.possession).toBe(1);
  });

  it("a made field goal scores 3 and hands the ball to the other team at their 25", () => {
    let s = initialFootball();
    s = { ...s, ballOn: 80 }; // kickDistance ~37, well within range
    const next = resolvePlay(s, 0, "field_goal", () => 0);
    expect(next.lastPlay?.kind).toBe("field_goal_good");
    expect(next.scores[0]).toBe(3);
    expect(next.possession).toBe(1);
    expect(next.ballOn).toBe(25);
  });

  it("a missed field goal turns the ball over at the spot", () => {
    const s = initialFootball(); // kickDistance ~92, essentially unmakeable
    const next = resolvePlay(s, 0, "field_goal", () => 0.5);
    expect(next.lastPlay?.kind).toBe("field_goal_miss");
    expect(next.possession).toBe(1);
    expect(next.scores).toEqual([0, 0]);
  });

  it("a punt flips possession downfield", () => {
    const s = initialFootball();
    const next = resolvePlay(s, 0, "punt", () => 0); // dist = 30
    expect(next.lastPlay?.kind).toBe("punt");
    expect(next.possession).toBe(1);
    expect(next.ballOn).toBe(45);
    expect(next.down).toBe(1);
  });

  it("ends in a decision at the play limit, favoring the higher score", () => {
    let s: FootballState = { ...initialFootball(), play: MAX_PLAYS, scores: [17, 10] };
    const next = resolvePlay(s, 0, "run", () => 0.99);
    expect(next.phase).toBe("over");
    expect(next.decision).toBe(true);
    expect(next.winnerSeat).toBe(0);
  });

  it("a tied score at the play limit is a draw", () => {
    let s: FootballState = { ...initialFootball(), play: MAX_PLAYS, scores: [14, 14] };
    const next = resolvePlay(s, 0, "run", () => 0.99);
    expect(next.winnerSeat).toBeNull();
  });

  it("computer play-caller always returns a valid play", () => {
    const s = initialFootball();
    const valid = ["run", "short_pass", "long_pass", "punt", "field_goal"];
    for (let i = 0; i < 20; i++) {
      expect(valid).toContain(computerPlay(s, () => i / 20));
    }
  });

  it("computer favors kicking or punting on 4th down instead of always going for it", () => {
    const s: FootballState = { ...initialFootball(), down: 4, yardsToGo: 10, ballOn: 55 };
    const p = computerPlay(s, () => 0.1);
    expect(["field_goal", "punt"]).toContain(p);
  });
});
