/**
 * Football-specific formation, route, and pass-resolution logic — purpose-built
 * for the arcade play engine, not shared with any other game in this app.
 *
 * Coordinates are in "field units": x = yards downfield from the line of
 * scrimmage (offense advances toward +x), y = lane position 0..100 across the
 * field's width (50 = the middle). Both offense and defense formations are
 * defined once and mirrored per play from wherever the line of scrimmage sits.
 */

export type FieldPos = { x: number; y: number };

export type OffenseRole = "QB" | "OL" | "RB" | "WR" | "TE";
export type DefenseRole = "DL" | "LB" | "DB";

export type FormationSlot<Role extends string> = { role: Role; number: number; offset: FieldPos };

/**
 * 11 offensive players: 5 linemen, a quarterback, a running back, two wideouts,
 * a tight end, a flanker. Lane offsets are spread wide on purpose — at this
 * viewport's scale, formation slots closer than ~15 lane-units start visually
 * overlapping player sprites and read as a blob instead of a lineup.
 */
export const OFFENSE_FORMATION: FormationSlot<OffenseRole>[] = [
  { role: "OL", number: 71, offset: { x: 0, y: 8 } },
  { role: "OL", number: 72, offset: { x: 0, y: 30 } },
  { role: "OL", number: 73, offset: { x: 0, y: 50 } },
  { role: "OL", number: 74, offset: { x: 0, y: 70 } },
  { role: "OL", number: 75, offset: { x: 0, y: 92 } },
  { role: "QB", number: 7, offset: { x: -6, y: 50 } },
  { role: "RB", number: 28, offset: { x: -10, y: 50 } },
  { role: "TE", number: 87, offset: { x: 2, y: 100 } },
  { role: "WR", number: 11, offset: { x: 2, y: 0 } },
  { role: "WR", number: 19, offset: { x: -4, y: 18 } },
  { role: "WR", number: 15, offset: { x: 2, y: 82 } },
];

/** 11 defensive players: 4 down linemen, 3 linebackers, 4 defensive backs, spread the same way. */
export const DEFENSE_FORMATION: FormationSlot<DefenseRole>[] = [
  { role: "DL", number: 90, offset: { x: 2, y: 24 } },
  { role: "DL", number: 91, offset: { x: 2, y: 42 } },
  { role: "DL", number: 92, offset: { x: 2, y: 58 } },
  { role: "DL", number: 93, offset: { x: 2, y: 76 } },
  { role: "LB", number: 50, offset: { x: 9, y: 22 } },
  { role: "LB", number: 51, offset: { x: 9, y: 50 } },
  { role: "LB", number: 52, offset: { x: 9, y: 78 } },
  { role: "DB", number: 21, offset: { x: 14, y: 0 } },
  { role: "DB", number: 24, offset: { x: 11, y: 18 } },
  { role: "DB", number: 25, offset: { x: 11, y: 82 } },
  { role: "DB", number: 22, offset: { x: 14, y: 100 } },
];

/** Only linebackers and defensive backs give chase downfield — linemen stay engaged at the LOS, same as real football. */
export function pursuingDefense(): FormationSlot<DefenseRole>[] {
  return DEFENSE_FORMATION.filter((d) => d.role !== "DL");
}

export type RouteName = "go" | "slant" | "curl";

/** Additive (dx, dy) offset from a receiver's snap position, as a function of route progress 0..1. */
export function routeOffset(route: RouteName, u: number): FieldPos {
  const cu = Math.max(0, Math.min(1, u));
  switch (route) {
    case "go":
      return { x: 34 * cu, y: 0 };
    case "slant": {
      const brk = 0.35;
      if (cu < brk) return { x: 12 * (cu / brk), y: -4 * (cu / brk) };
      const t2 = (cu - brk) / (1 - brk);
      return { x: 12 + 24 * t2, y: -4 - 18 * t2 };
    }
    case "curl": {
      const out = Math.min(cu, 0.62) / 0.62;
      const back = cu > 0.62 ? (cu - 0.62) / 0.38 : 0;
      return { x: 20 * out - 6 * back, y: 0 };
    }
  }
}

export type PassOutcome =
  | { outcome: "catch"; receiverId: string }
  | { outcome: "interception"; defenderId: string }
  | { outcome: "incomplete" };

/**
 * Resolves where a thrown ball lands: whoever is closest to the target and
 * within the catch radius comes down with it — offense first on a tie.
 */
export function resolveThrow(
  target: FieldPos,
  receivers: { id: string; pos: FieldPos }[],
  defenders: { id: string; pos: FieldPos }[],
  catchRadius = 9,
): PassOutcome {
  const dist = (p: FieldPos) => Math.hypot(p.x - target.x, p.y - target.y);
  const nearestReceiver = [...receivers].map((r) => ({ ...r, d: dist(r.pos) })).sort((a, b) => a.d - b.d)[0];
  const nearestDefender = [...defenders].map((d) => ({ ...d, d: dist(d.pos) })).sort((a, b) => a.d - b.d)[0];

  if (nearestReceiver && nearestReceiver.d <= catchRadius && (!nearestDefender || nearestReceiver.d <= nearestDefender.d)) {
    return { outcome: "catch", receiverId: nearestReceiver.id };
  }
  if (nearestDefender && nearestDefender.d <= catchRadius) {
    return { outcome: "interception", defenderId: nearestDefender.id };
  }
  return { outcome: "incomplete" };
}
