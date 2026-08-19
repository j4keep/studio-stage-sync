import { describe, expect, it } from "vitest";
import { DEFENSE_FORMATION, OFFENSE_FORMATION, pursuingDefense, resolveThrow, routeOffset } from "./football-formations";

describe("football-formations", () => {
  it("fields exactly eleven players on each side", () => {
    expect(OFFENSE_FORMATION).toHaveLength(11);
    expect(DEFENSE_FORMATION).toHaveLength(11);
  });

  it("keeps the offensive line at the line of scrimmage and skill players off it", () => {
    const ol = OFFENSE_FORMATION.filter((p) => p.role === "OL");
    expect(ol.every((p) => p.offset.x === 0)).toBe(true);
    const qb = OFFENSE_FORMATION.find((p) => p.role === "QB")!;
    expect(qb.offset.x).toBeLessThan(0);
  });

  it("only linebackers and defensive backs pursue downfield, not the line", () => {
    const pursuers = pursuingDefense();
    expect(pursuers.every((p) => p.role === "LB" || p.role === "DB")).toBe(true);
    expect(pursuers).toHaveLength(7);
  });

  it("a go route runs straight downfield with no lateral drift", () => {
    const end = routeOffset("go", 1);
    expect(end.x).toBeGreaterThan(0);
    expect(end.y).toBe(0);
  });

  it("a slant route breaks inside partway through", () => {
    const early = routeOffset("slant", 0.1);
    const late = routeOffset("slant", 0.9);
    expect(early.y).toBeLessThan(0); // already angling in
    expect(late.y).toBeLessThan(early.y); // continues breaking after the cut
  });

  it("a curl route comes back toward the quarterback near the end", () => {
    const peak = routeOffset("curl", 0.62);
    const end = routeOffset("curl", 1);
    expect(end.x).toBeLessThan(peak.x);
  });

  it("resolves a catch when a receiver is closest to the target", () => {
    const r = resolveThrow(
      { x: 20, y: 50 },
      [{ id: "wr1", pos: { x: 20, y: 50 } }],
      [{ id: "db1", pos: { x: 20, y: 65 } }],
    );
    expect(r.outcome).toBe("catch");
    expect((r as any).receiverId).toBe("wr1");
  });

  it("resolves an interception when a defender beats every receiver to the ball", () => {
    const r = resolveThrow(
      { x: 20, y: 50 },
      [{ id: "wr1", pos: { x: 20, y: 65 } }],
      [{ id: "db1", pos: { x: 20, y: 50 } }],
    );
    expect(r.outcome).toBe("interception");
    expect((r as any).defenderId).toBe("db1");
  });

  it("resolves incomplete when nobody is within the catch radius", () => {
    const r = resolveThrow(
      { x: 20, y: 50 },
      [{ id: "wr1", pos: { x: 20, y: 90 } }],
      [{ id: "db1", pos: { x: 20, y: 5 } }],
    );
    expect(r.outcome).toBe("incomplete");
  });

  it("gives the offense the ball on an exact tie in distance", () => {
    const r = resolveThrow(
      { x: 20, y: 50 },
      [{ id: "wr1", pos: { x: 20, y: 55 } }],
      [{ id: "db1", pos: { x: 20, y: 55 } }],
    );
    expect(r.outcome).toBe("catch");
  });
});
