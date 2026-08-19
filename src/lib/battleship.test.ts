import { describe, expect, it } from "vitest";
import {
  BOARD_SIZE,
  BattleshipState,
  Fleet,
  SHIP_LENGTHS,
  SHIP_ORDER,
  alreadyShot,
  canPlaceShip,
  cellsForShip,
  computerShot,
  fireShot,
  initialBattleship,
  occupiedCells,
  placeFleet,
  randomFleet,
  shipsRemaining,
  validateFleet,
} from "./battleship";

describe("battleship", () => {
  it("starts in placement with no fleets set and seat 0 up first once battle begins", () => {
    const s = initialBattleship();
    expect(s.phase).toBe("placing");
    expect(s.fleets).toEqual([null, null]);
    expect(s.turnSeat).toBe(0);
  });

  it("randomFleet always produces a valid, non-overlapping fleet", () => {
    for (let i = 0; i < 20; i++) {
      const fleet = randomFleet(() => Math.random());
      expect(validateFleet(fleet)).toBe(true);
    }
  });

  it("validateFleet rejects overlapping ships", () => {
    const fleet: Fleet = SHIP_ORDER.map((id) => ({
      id,
      cells: Array.from({ length: SHIP_LENGTHS[id] }, (_, i) => ({ x: i, y: 0 })), // every ship stacked on row 0
      hits: Array(SHIP_LENGTHS[id]).fill(false),
    }));
    expect(validateFleet(fleet)).toBe(false);
  });

  it("validateFleet rejects a ship placed out of bounds", () => {
    const fleet: Fleet = SHIP_ORDER.map((id, i) => ({
      id,
      cells: Array.from({ length: SHIP_LENGTHS[id] }, (_, j) => ({ x: BOARD_SIZE - 1 + j, y: i * 2 })),
      hits: Array(SHIP_LENGTHS[id]).fill(false),
    }));
    expect(validateFleet(fleet)).toBe(false);
  });

  it("placeFleet only starts battle once both seats have placed", () => {
    let s = initialBattleship();
    s = placeFleet(s, 0, randomFleet());
    expect(s.phase).toBe("placing");
    s = placeFleet(s, 1, randomFleet());
    expect(s.phase).toBe("battle");
  });

  it("a shot on empty water is a miss and passes the turn", () => {
    let s = initialBattleship();
    // Seat 1's whole fleet packed into the top-left corner, well clear of (9, 9).
    const cornerFleet: Fleet = SHIP_ORDER.map((id, i) => ({
      id,
      cells: Array.from({ length: SHIP_LENGTHS[id] }, (_, j) => ({ x: j, y: i * 2 })),
      hits: Array(SHIP_LENGTHS[id]).fill(false),
    }));
    s = placeFleet(s, 1, cornerFleet);
    s = placeFleet(s, 0, randomFleet());
    const next = fireShot(s, 0, 9, 9);
    expect(next.lastShot?.result).toBe("miss");
    expect(next.turnSeat).toBe(1);
    expect(next.lastShot?.seat).toBe(0);
  });

  it("firing on a ship cell registers a hit, and sinks it once every cell is hit", () => {
    let s = initialBattleship();
    const oppFleet: Fleet = SHIP_ORDER.map((id, i) => ({
      id,
      cells: Array.from({ length: SHIP_LENGTHS[id] }, (_, j) => ({ x: j, y: i * 2 })),
      hits: Array(SHIP_LENGTHS[id]).fill(false),
    }));
    s = placeFleet(s, 1, oppFleet);
    s = placeFleet(s, 0, randomFleet());

    const destroyer = oppFleet.find((sh) => sh.id === "destroyer")!;
    let next = s;
    destroyer.cells.forEach((c, i) => {
      next = fireShot(next, 0, c.x, c.y);
      if (i < destroyer.cells.length - 1) {
        // hand the turn back to seat 0 for the test's sake by firing again as seat 0
        expect(next.lastShot?.result).toBe("hit");
      }
    });
    expect(next.lastShot?.result).toBe("sunk");
    expect(next.lastShot?.shipId).toBe("destroyer");
  });

  it("re-firing on an already-shot cell is a no-op", () => {
    let s = initialBattleship();
    s = placeFleet(s, 0, randomFleet());
    s = placeFleet(s, 1, randomFleet());
    const first = fireShot(s, 0, 3, 3);
    const again = fireShot(first, 0, 3, 3);
    expect(again).toBe(first); // unchanged reference — true no-op
    expect(alreadyShot(first, 0, 3, 3)).toBe(true);
  });

  it("sinking every ship in the opposing fleet ends the game", () => {
    let s = initialBattleship();
    const tinyFleet: Fleet = SHIP_ORDER.map((id, i) => ({
      id,
      cells: Array.from({ length: SHIP_LENGTHS[id] }, (_, j) => ({ x: j, y: i * 2 })),
      hits: Array(SHIP_LENGTHS[id]).fill(false),
    }));
    s = placeFleet(s, 1, tinyFleet);
    s = placeFleet(s, 0, randomFleet());

    let next: BattleshipState = s;
    for (const ship of tinyFleet) {
      for (const c of ship.cells) next = fireShot(next, 0, c.x, c.y);
    }
    expect(next.phase).toBe("over");
    expect(next.winnerSeat).toBe(0);
    expect(shipsRemaining(next.fleets[1])).toBe(0);
  });

  it("computer shot always targets a cell that hasn't been fired on yet", () => {
    let s = initialBattleship();
    s = placeFleet(s, 0, randomFleet());
    s = placeFleet(s, 1, randomFleet());
    let seat1Shots = s.shotsAt[1];
    for (let i = 0; i < 15; i++) {
      const shot = computerShot(s, 1, () => Math.random());
      expect(alreadyShot(s, 1, shot.x, shot.y)).toBe(false);
      s = fireShot(s, 1, shot.x, shot.y);
    }
  });

  it("computer hunts adjacent cells after landing a hit instead of firing randomly", () => {
    let s = initialBattleship();
    const oppFleet: Fleet = [
      { id: "carrier", cells: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }], hits: [false, false, false, false, false] },
      ...SHIP_ORDER.filter((id) => id !== "carrier").map((id, i) => ({
        id,
        cells: Array.from({ length: SHIP_LENGTHS[id] }, (_, j) => ({ x: j, y: i })),
        hits: Array(SHIP_LENGTHS[id]).fill(false),
      })),
    ] as Fleet;
    s = placeFleet(s, 0, oppFleet);
    s = placeFleet(s, 1, randomFleet());
    // Seat 1 lands a hit on the carrier at (5,5) without sinking it.
    s = fireShot(s, 1, 5, 5);
    expect(s.lastShot?.result).toBe("hit");
    const next = computerShot(s, 1, () => 0);
    const isAdjacent = (Math.abs(next.x - 5) === 1 && next.y === 5) || (next.x === 5 && Math.abs(next.y - 5) === 1);
    expect(isAdjacent).toBe(true);
  });

  it("canPlaceShip allows an empty spot and rejects out-of-bounds placement", () => {
    expect(canPlaceShip([], "destroyer", 0, 0, "H")).toBe(true);
    expect(canPlaceShip([], "carrier", 8, 0, "H")).toBe(false); // 5-length ship, only room for 2
    expect(canPlaceShip([], "destroyer", 9, 9, "V")).toBe(false); // runs off the bottom edge
  });

  it("canPlaceShip rejects overlapping an already-placed ship", () => {
    const fleet: Fleet = [{ id: "destroyer", cells: cellsForShip(0, 0, 2, "H"), hits: [false, false] }];
    expect(canPlaceShip(fleet, "submarine", 1, 0, "V")).toBe(false); // shares cell (1,0)
    expect(canPlaceShip(fleet, "submarine", 2, 0, "V")).toBe(true); // clear of the destroyer
  });

  it("occupiedCells reflects every ship placed so far", () => {
    const fleet: Fleet = [
      { id: "destroyer", cells: cellsForShip(0, 0, 2, "H"), hits: [false, false] },
      { id: "submarine", cells: cellsForShip(3, 3, 3, "V"), hits: [false, false, false] },
    ];
    const occ = occupiedCells(fleet);
    expect(occ.has("0,0")).toBe(true);
    expect(occ.has("1,0")).toBe(true);
    expect(occ.has("3,5")).toBe(true);
    expect(occ.has("5,5")).toBe(false);
  });
});
