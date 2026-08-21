/**
 * Battleship: each player places a fleet on their own hidden 10x10 board, then
 * turns alternate firing single shots at the opponent's board until one side's
 * whole fleet is sunk. Whoever fires resolves the shot against the opponent's
 * fleet locally and writes the result — same "acting player resolves and
 * persists the outcome" pattern as every other game in this app.
 */

export type Seat = 0 | 1;
export type Orientation = "H" | "V";
export type Cell = { x: number; y: number };

export const BOARD_SIZE = 10;

export type ShipId = "carrier" | "battleship" | "cruiser" | "submarine" | "destroyer";
export const SHIP_ORDER: ShipId[] = ["carrier", "battleship", "cruiser", "submarine", "destroyer"];
export const SHIP_LENGTHS: Record<ShipId, number> = {
  carrier: 5,
  battleship: 4,
  cruiser: 3,
  submarine: 3,
  destroyer: 2,
};
/** Original YAJ boat class names — these are the only user-facing ship names; the `ShipId`
 *  keys above are internal identifiers left unchanged so persisted game_state never breaks. */
export const SHIP_LABELS: Record<ShipId, string> = {
  carrier: "Voyager",
  battleship: "Clipper",
  cruiser: "Skimmer",
  submarine: "Runner",
  destroyer: "Skiff",
};

export type ShipPlacement = { id: ShipId; cells: Cell[]; hits: boolean[] };
export type Fleet = ShipPlacement[];

export type ShotResult = "miss" | "hit" | "sunk";
export type Shot = { x: number; y: number; seat: Seat; result: ShotResult; shipId?: ShipId };

export type BattleshipPhase = "placing" | "battle" | "over";

export const SONAR_USES = 2;
export type SonarResult = { seat: Seat; x: number; y: number; found: boolean; turn: number };

export type BattleshipState = {
  phase: BattleshipPhase;
  fleets: [Fleet | null, Fleet | null];
  /** shotsAt[seat] = every shot that seat has fired (landing on the other seat's board). */
  shotsAt: [Shot[], Shot[]];
  turnSeat: Seat;
  winnerSeat: Seat | null;
  turn: number;
  lastShot: Shot | null;
  /** Sonar Pulse charges remaining per seat — starts at SONAR_USES each. */
  sonarUses: [number, number];
  lastSonar: SonarResult | null;
};

export function initialBattleship(): BattleshipState {
  return {
    phase: "placing",
    fleets: [null, null],
    shotsAt: [[], []],
    turnSeat: 0,
    winnerSeat: null,
    turn: 1,
    lastShot: null,
    sonarUses: [SONAR_USES, SONAR_USES],
    lastSonar: null,
  };
}

export function inBounds(c: Cell) {
  return c.x >= 0 && c.x < BOARD_SIZE && c.y >= 0 && c.y < BOARD_SIZE;
}

export function cellsForShip(x: number, y: number, length: number, orientation: Orientation): Cell[] {
  const cells: Cell[] = [];
  for (let i = 0; i < length; i++) cells.push(orientation === "H" ? { x: x + i, y } : { x, y: y + i });
  return cells;
}

/** Every cell occupied by any ship already in a (possibly partial) fleet-in-progress. */
export function occupiedCells(fleet: Fleet): Set<string> {
  const set = new Set<string>();
  fleet.forEach((ship) => ship.cells.forEach((c) => set.add(`${c.x},${c.y}`)));
  return set;
}

/**
 * Whether a ship of `id` can be placed at (x, y, orientation) — in bounds and
 * not overlapping any ship already placed in `fleet`. Used by the interactive
 * placement UI to validate a tap before committing it.
 */
export function canPlaceShip(fleet: Fleet, id: ShipId, x: number, y: number, orientation: Orientation): boolean {
  const cells = cellsForShip(x, y, SHIP_LENGTHS[id], orientation);
  const occupied = occupiedCells(fleet);
  return cells.every((c) => inBounds(c) && !occupied.has(`${c.x},${c.y}`));
}

/** A fleet is valid if it has exactly the standard five ships, correctly sized, in bounds, with no overlaps. */
export function validateFleet(fleet: Fleet): boolean {
  if (fleet.length !== SHIP_ORDER.length) return false;
  const ids = [...fleet.map((s) => s.id)].sort();
  const expected = [...SHIP_ORDER].sort();
  if (ids.join() !== expected.join()) return false;

  const seen = new Set<string>();
  for (const ship of fleet) {
    if (ship.cells.length !== SHIP_LENGTHS[ship.id]) return false;
    if (ship.hits.length !== ship.cells.length) return false;
    for (const c of ship.cells) {
      if (!inBounds(c)) return false;
      const key = `${c.x},${c.y}`;
      if (seen.has(key)) return false;
      seen.add(key);
    }
  }
  return true;
}

/** Randomly places a full, valid fleet — used for the "shuffle" placement flow and the computer's board. */
export function randomFleet(rand: () => number = Math.random): Fleet {
  const fleet: Fleet = [];
  const occupied = new Set<string>();
  for (const id of SHIP_ORDER) {
    const length = SHIP_LENGTHS[id];
    let placed = false;
    for (let attempt = 0; attempt < 500 && !placed; attempt++) {
      const orientation: Orientation = rand() < 0.5 ? "H" : "V";
      const maxX = orientation === "H" ? BOARD_SIZE - length : BOARD_SIZE - 1;
      const maxY = orientation === "V" ? BOARD_SIZE - length : BOARD_SIZE - 1;
      const x = Math.floor(rand() * (maxX + 1));
      const y = Math.floor(rand() * (maxY + 1));
      const cells = cellsForShip(x, y, length, orientation);
      if (cells.every((c) => inBounds(c) && !occupied.has(`${c.x},${c.y}`))) {
        cells.forEach((c) => occupied.add(`${c.x},${c.y}`));
        fleet.push({ id, cells, hits: cells.map(() => false) });
        placed = true;
      }
    }
    if (!placed) throw new Error("Could not place fleet — this should never happen on a 10x10 board");
  }
  return fleet;
}

/** Sets a seat's fleet; battle begins automatically once both seats are ready. */
export function placeFleet(state: BattleshipState, seat: Seat, fleet: Fleet): BattleshipState {
  const fleets: [Fleet | null, Fleet | null] = [state.fleets[0], state.fleets[1]];
  fleets[seat] = fleet;
  const bothReady = fleets[0] !== null && fleets[1] !== null;
  return { ...state, fleets, phase: bothReady ? "battle" : "placing" };
}

/** Whether (x, y) has already been fired on by this seat — the caller should block re-firing on it. */
export function alreadyShot(state: BattleshipState, seat: Seat, x: number, y: number): boolean {
  return state.shotsAt[seat].some((s) => s.x === x && s.y === y);
}

/**
 * Resolves one shot fired by `seat` at (x, y) on the opponent's board. No-ops
 * (returns the same state) if that cell was already fired on. Does not check
 * whose turn it is — the caller (the page) gates that, same as this app's
 * other turn-based games.
 */
export function fireShot(state: BattleshipState, seat: Seat, x: number, y: number): BattleshipState {
  if (alreadyShot(state, seat, x, y)) return state;
  const oppSeat: Seat = seat === 0 ? 1 : 0;
  const oppFleet = state.fleets[oppSeat];
  if (!oppFleet) return state;

  const fleets: [Fleet | null, Fleet | null] = [state.fleets[0], state.fleets[1]];
  const newOppFleet = oppFleet.map((ship) => ({ ...ship, hits: [...ship.hits] }));
  fleets[oppSeat] = newOppFleet;

  let result: ShotResult = "miss";
  let shipId: ShipId | undefined;
  for (const ship of newOppFleet) {
    const idx = ship.cells.findIndex((c) => c.x === x && c.y === y);
    if (idx !== -1) {
      ship.hits[idx] = true;
      shipId = ship.id;
      result = ship.hits.every((h) => h) ? "sunk" : "hit";
      break;
    }
  }

  const shot: Shot = { x, y, seat, result, shipId };
  const shotsAt: [Shot[], Shot[]] = [[...state.shotsAt[0]], [...state.shotsAt[1]]];
  shotsAt[seat] = [...shotsAt[seat], shot];

  const allSunk = newOppFleet.every((ship) => ship.hits.every((h) => h));
  const phase: BattleshipPhase = allSunk ? "over" : "battle";
  const winnerSeat: Seat | null = allSunk ? seat : null;
  const turnSeat: Seat = allSunk ? state.turnSeat : oppSeat;

  return { ...state, fleets, shotsAt, turnSeat, winnerSeat, phase, turn: state.turn + 1, lastShot: shot };
}

/** Charges left for a seat — defensive default for any game_state persisted before Sonar
 *  Pulse existed. */
export function sonarUsesLeft(state: BattleshipState, seat: Seat): number {
  return (state.sonarUses ?? [SONAR_USES, SONAR_USES])[seat];
}

/**
 * Sonar Pulse: spends one charge to check a small plus-shaped zone (the tapped cell and its
 * 4 neighbors) against the opponent's fleet — reveals only whether a boat exists somewhere in
 * that zone, never which exact tile. Costs the turn, same as firing, so the turn structure
 * stays a single simple loop. No-ops if the seat has no charges left.
 */
export function useSonar(state: BattleshipState, seat: Seat, x: number, y: number): BattleshipState {
  if (state.phase !== "battle") return state;
  if (sonarUsesLeft(state, seat) <= 0) return state;
  const oppSeat: Seat = seat === 0 ? 1 : 0;
  const oppFleet = state.fleets[oppSeat];
  if (!oppFleet) return state;

  const zone = [
    { x, y },
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ].filter(inBounds);
  const zoneKeys = new Set(zone.map((c) => `${c.x},${c.y}`));
  const found = oppFleet.some((ship) => ship.cells.some((c) => zoneKeys.has(`${c.x},${c.y}`)));

  const sonarUses: [number, number] = [...(state.sonarUses ?? [SONAR_USES, SONAR_USES])] as [number, number];
  sonarUses[seat] -= 1;
  const turn = state.turn + 1;

  return {
    ...state,
    sonarUses,
    lastSonar: { seat, x, y, found, turn },
    turnSeat: oppSeat,
    turn,
  };
}

/** How many ships (out of five) a seat still has afloat. */
export function shipsRemaining(fleet: Fleet | null): number {
  if (!fleet) return SHIP_ORDER.length;
  return fleet.filter((ship) => !ship.hits.every((h) => h)).length;
}

/**
 * Simple hunt-and-target AI: after a hit that hasn't sunk the ship, fire at an
 * adjacent cell; otherwise fire at random among cells not already shot.
 */
export function computerShot(state: BattleshipState, seat: Seat, rand: () => number = Math.random): Cell {
  const shots = state.shotsAt[seat];
  const shotSet = new Set(shots.map((s) => `${s.x},${s.y}`));

  for (let i = shots.length - 1; i >= 0; i--) {
    if (shots[i].result !== "hit") continue;
    const h = shots[i];
    const neighbors = [
      { x: h.x + 1, y: h.y },
      { x: h.x - 1, y: h.y },
      { x: h.x, y: h.y + 1 },
      { x: h.x, y: h.y - 1 },
    ].filter((c) => inBounds(c) && !shotSet.has(`${c.x},${c.y}`));
    if (neighbors.length) return neighbors[Math.floor(rand() * neighbors.length)];
  }

  let x = 0;
  let y = 0;
  for (let tries = 0; tries < 300; tries++) {
    x = Math.floor(rand() * BOARD_SIZE);
    y = Math.floor(rand() * BOARD_SIZE);
    if (!shotSet.has(`${x},${y}`)) return { x, y };
  }
  return { x, y };
}
