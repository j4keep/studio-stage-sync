/**
 * YAJ Sugar Rush — a tile-swap match-3 engine (the same genre as the well-known candy game,
 * with its own name, art, and candy set). Pure/local: an entire round plays out client-side
 * on one device, the same way a Pop Shot round or a Driving run does — only the *result*
 * (score reached) gets persisted for versus mode, and level star ratings get persisted for
 * the solo campaign. Nothing here talks to the network.
 */

export const GRID_SIZE = 8;
export const COLOR_COUNT = 6;

export type CandyColor = 0 | 1 | 2 | 3 | 4 | 5;
export type Special = "striped-h" | "striped-v" | "wrapped" | "bomb" | null;

export type Cell = { id: number; color: CandyColor; special: Special };
export type Board = (Cell | null)[][]; // board[row][col]

export type Pos = { r: number; c: number };

let uid = 0;
function nextId() {
  return ++uid;
}

export function randomColor(): CandyColor {
  return Math.floor(Math.random() * COLOR_COUNT) as CandyColor;
}

export function makeCell(color: CandyColor, special: Special = null): Cell {
  return { id: nextId(), color, special };
}

/** A fresh board with no color guaranteed to already be safe from an immediate match, and at
 *  least one legal move available (regenerates from scratch on the rare dead board). */
export function generateBoard(size = GRID_SIZE): Board {
  for (let attempt = 0; attempt < 20; attempt++) {
    const board: Board = [];
    for (let r = 0; r < size; r++) {
      const row: (Cell | null)[] = [];
      for (let c = 0; c < size; c++) {
        let color: CandyColor;
        let tries = 0;
        do {
          color = randomColor();
          tries++;
        } while (
          tries < 30 &&
          ((c >= 2 && row[c - 1]?.color === color && row[c - 2]?.color === color) ||
            (r >= 2 && board[r - 1][c]?.color === color && board[r - 2][c]?.color === color))
        );
        row.push(makeCell(color));
      }
      board.push(row);
    }
    if (hasLegalMove(board)) return board;
  }
  // Astronomically unlikely fallthrough — just return the last attempt.
  return generateBoardUnchecked(size);
}

function generateBoardUnchecked(size: number): Board {
  const board: Board = [];
  for (let r = 0; r < size; r++) {
    const row: (Cell | null)[] = [];
    for (let c = 0; c < size; c++) row.push(makeCell(randomColor()));
    board.push(row);
  }
  return board;
}

export function inBounds(board: Board, r: number, c: number) {
  return r >= 0 && r < board.length && c >= 0 && c < board[0].length;
}

export function areAdjacent(a: Pos, b: Pos) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

export function swapCells(board: Board, a: Pos, b: Pos): Board {
  const next = board.map((row) => row.slice());
  const tmp = next[a.r][a.c];
  next[a.r][a.c] = next[b.r][b.c];
  next[b.r][b.c] = tmp;
  return next;
}

export type Match = { cells: Pos[]; color: CandyColor; horizontal: boolean };

/** Every run of 3+ same-color candies in a row or column, right now, on this board. */
export function findMatches(board: Board): Match[] {
  const rows = board.length;
  const cols = board[0].length;
  const matches: Match[] = [];

  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const cell = board[r][c];
      if (!cell) {
        c++;
        continue;
      }
      let end = c;
      while (end + 1 < cols && board[r][end + 1] && board[r][end + 1]!.color === cell.color) end++;
      const len = end - c + 1;
      if (len >= 3) {
        matches.push({ cells: Array.from({ length: len }, (_, i) => ({ r, c: c + i })), color: cell.color, horizontal: true });
      }
      c = end + 1;
    }
  }

  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      const cell = board[r][c];
      if (!cell) {
        r++;
        continue;
      }
      let end = r;
      while (end + 1 < rows && board[end + 1][c] && board[end + 1][c]!.color === cell.color) end++;
      const len = end - r + 1;
      if (len >= 3) {
        matches.push({ cells: Array.from({ length: len }, (_, i) => ({ r: r + i, c })), color: cell.color, horizontal: false });
      }
      r = end + 1;
    }
  }

  return matches;
}

/** True if swapping any adjacent pair anywhere on the board would create a match — used to
 *  keep freshly generated boards from being unplayable dead ends. */
export function hasLegalMove(board: Board): boolean {
  const rows = board.length;
  const cols = board[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols) {
        const swapped = swapCells(board, { r, c }, { r, c: c + 1 });
        if (findMatches(swapped).length > 0) return true;
      }
      if (r + 1 < rows) {
        const swapped = swapCells(board, { r, c }, { r: r + 1, c });
        if (findMatches(swapped).length > 0) return true;
      }
    }
  }
  return false;
}

export function applyGravity(board: Board): Board {
  const rows = board.length;
  const cols = board[0].length;
  const next: Board = board.map((row) => row.slice());
  for (let c = 0; c < cols; c++) {
    let write = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      if (next[r][c]) {
        if (write !== r) {
          next[write][c] = next[r][c];
          next[r][c] = null;
        }
        write--;
      }
    }
    for (let r = write; r >= 0; r--) next[r][c] = null;
  }
  return next;
}

export function refill(board: Board): Board {
  const rows = board.length;
  const cols = board[0].length;
  const next: Board = board.map((row) => row.slice());
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (!next[r][c]) next[r][c] = makeCell(randomColor());
    }
  }
  return next;
}

export const BASE_POINTS = 10;
export const CASCADE_MULTIPLIER = 1.5;


export type LegalMove = { a: Pos; b: Pos };

/** All adjacent swaps that create a normal match or trigger a special candy. */
export function findLegalMoves(board: Board): LegalMove[] {
  const moves: LegalMove[] = [];
  const rows = board.length;
  const cols = board[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (const b of [{ r, c: c + 1 }, { r: r + 1, c }]) {
        if (!inBounds(board, b.r, b.c)) continue;
        const a = { r, c };
        const swapped = swapCells(board, a, b);
        const ca = board[r][c];
        const cb = board[b.r][b.c];
        if (ca?.special || cb?.special || findMatches(swapped).length > 0) moves.push({ a, b });
      }
    }
  }
  return moves;
}

export type ClearStep = { board: Board; cleared: number; scoreGained: number; matched: Pos[] };

/** Resolve only the CLEAR portion of one cascade. Gravity/refill are deliberately separate
 * so the UI can animate pop -> fall -> refill instead of jumping to the final board. */
export function clearOneMatchStep(board: Board, cascadeDepth = 1): ClearStep {
  const matches = findMatches(board);
  if (matches.length === 0) return { board, cleared: 0, scoreGained: 0, matched: [] };
  const current = board.map((row) => row.slice());
  const clearSet = new Set<string>();
  const specialsToPlace: { r: number; c: number; special: Special; color: CandyColor }[] = [];

  for (const m of matches) {
    m.cells.forEach(({ r, c }) => clearSet.add(`${r},${c}`));
    const pivot = m.cells[Math.floor(m.cells.length / 2)];
    if (m.cells.length >= 5) specialsToPlace.push({ r: pivot.r, c: pivot.c, special: "bomb", color: m.color });
    else if (m.cells.length === 4) specialsToPlace.push({ r: pivot.r, c: pivot.c, special: m.horizontal ? "striped-h" : "striped-v", color: m.color });
  }

  const matched: Pos[] = [];
  let cleared = 0;
  for (const key of clearSet) {
    const [r, c] = key.split(",").map(Number);
    if (current[r][c]) { cleared++; matched.push({ r, c }); }
    current[r][c] = null;
  }
  for (const sp of specialsToPlace) current[sp.r][sp.c] = makeCell(sp.color, sp.special);
  const scoreGained = Math.round(cleared * BASE_POINTS * Math.pow(CASCADE_MULTIPLIER, cascadeDepth - 1));
  return { board: current, cleared, scoreGained, matched };
}

export type CascadeResult = { board: Board; scoreGained: number; cascades: number; cleared: number };

/** Repeatedly clears whatever matches exist, drops candies down, refills from the top, and
 *  clears again — a cascade — awarding more per candy the deeper the chain goes. Matches of
 *  4 leave behind a striped candy (clears its row/column); 5+ leaves a color bomb (clears
 *  every candy of one color). */
export function resolveCascades(board: Board): CascadeResult {
  let current = board.map((row) => row.slice());
  let scoreGained = 0;
  let cascades = 0;
  let clearedTotal = 0;

  while (true) {
    const matches = findMatches(current);
    if (matches.length === 0) break;
    cascades++;

    const clearSet = new Set<string>();
    const specialsToPlace: { r: number; c: number; special: Special; color: CandyColor }[] = [];

    for (const m of matches) {
      m.cells.forEach(({ r, c }) => clearSet.add(`${r},${c}`));
      const pivot = m.cells[Math.floor(m.cells.length / 2)];
      if (m.cells.length >= 5) {
        specialsToPlace.push({ r: pivot.r, c: pivot.c, special: "bomb", color: m.color });
      } else if (m.cells.length === 4) {
        specialsToPlace.push({ r: pivot.r, c: pivot.c, special: m.horizontal ? "striped-h" : "striped-v", color: m.color });
      }
    }

    let clearedThisStep = 0;
    for (const key of clearSet) {
      const [r, c] = key.split(",").map(Number);
      if (current[r][c]) clearedThisStep++;
      current[r][c] = null;
    }
    clearedTotal += clearedThisStep;
    scoreGained += Math.round(clearedThisStep * BASE_POINTS * Math.pow(CASCADE_MULTIPLIER, cascades - 1));

    for (const sp of specialsToPlace) {
      current[sp.r][sp.c] = makeCell(sp.color, sp.special);
    }

    current = refill(applyGravity(current));
  }

  return { board: current, scoreGained, cascades, cleared: clearedTotal };
}

/** Clears whatever a special candy hits when it's swapped (not matched) — the candy itself
 *  is consumed too. Returns the board with those cells emptied and how many were cleared. */
function activateSpecial(board: Board, pos: Pos, cell: Cell): { board: Board; cleared: number } {
  const rows = board.length;
  const cols = board[0].length;
  const next = board.map((row) => row.slice());
  let cleared = 0;
  const clear = (r: number, c: number) => {
    if (inBounds(next, r, c) && next[r][c]) {
      next[r][c] = null;
      cleared++;
    }
  };

  if (cell.special === "striped-h") {
    for (let c = 0; c < cols; c++) clear(pos.r, c);
  } else if (cell.special === "striped-v") {
    for (let r = 0; r < rows; r++) clear(r, pos.c);
  } else if (cell.special === "wrapped") {
    for (let r = pos.r - 1; r <= pos.r + 1; r++) for (let c = pos.c - 1; c <= pos.c + 1; c++) clear(r, c);
  } else if (cell.special === "bomb") {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (next[r][c]?.color === cell.color) clear(r, c);
  }
  if (next[pos.r][pos.c]) {
    next[pos.r][pos.c] = null;
    cleared++;
  }
  return { board: next, cleared };
}

export type SwapOutcome = { valid: boolean; board: Board; result?: CascadeResult };

/** Attempts to swap two adjacent candies. A swap is only kept if it forms a match, or if
 *  either candy involved is a special (specials always trigger, no match needed). Otherwise
 *  the board is returned unchanged (the caller animates a snap-back). */
export function trySwap(board: Board, a: Pos, b: Pos): SwapOutcome {
  if (!areAdjacent(a, b)) return { valid: false, board };
  const swapped = swapCells(board, a, b);
  const atB = swapped[b.r][b.c]; // the candy that started at a
  const atA = swapped[a.r][a.c]; // the candy that started at b

  if (atB?.special || atA?.special) {
    let working = swapped;
    let cleared = 0;
    if (atB?.special) {
      const r = activateSpecial(working, b, atB);
      working = r.board;
      cleared += r.cleared;
    }
    if (atA?.special) {
      const r = activateSpecial(working, a, atA);
      working = r.board;
      cleared += r.cleared;
    }
    working = refill(applyGravity(working));
    const cascade = resolveCascades(working);
    return {
      valid: true,
      board: cascade.board,
      result: {
        board: cascade.board,
        scoreGained: cleared * BASE_POINTS + cascade.scoreGained,
        cascades: cascade.cascades + 1,
        cleared: cleared + cascade.cleared,
      },
    };
  }

  const matches = findMatches(swapped);
  if (matches.length === 0) return { valid: false, board };
  const cascade = resolveCascades(swapped);
  return { valid: true, board: cascade.board, result: cascade };
}
