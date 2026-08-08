export type Piece = "r" | "R" | "b" | "B" | null;
export type CBoard = Piece[]; // 64, index = row * 8 + col

export const C_SIZE = 8;
const idx = (r: number, c: number) => r * C_SIZE + c;
const inBoard = (r: number, c: number) => r >= 0 && r < C_SIZE && c >= 0 && c < C_SIZE;

export type Side = "r" | "b";
export type Move = { from: number; to: number; capture: number | null };

export function initialCheckers(): CBoard {
  const b: CBoard = Array(64).fill(null);
  for (let r = 0; r < 3; r += 1)
    for (let c = 0; c < 8; c += 1) if ((r + c) % 2 === 1) b[idx(r, c)] = "b";
  for (let r = 5; r < 8; r += 1)
    for (let c = 0; c < 8; c += 1) if ((r + c) % 2 === 1) b[idx(r, c)] = "r";
  return b;
}

export const sideOf = (p: Piece): Side | null => (p ? (p.toLowerCase() as Side) : null);
const isKing = (p: Piece) => p === "R" || p === "B";

function dirsFor(p: Piece): number[] {
  if (isKing(p)) return [-1, 1];
  return sideOf(p) === "r" ? [-1] : [1];
}

export function legalMoves(board: CBoard, side: Side): Move[] {
  const jumps: Move[] = [];
  const steps: Move[] = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = board[idx(r, c)];
      if (!p || sideOf(p) !== side) continue;
      for (const dr of dirsFor(p)) {
        for (const dc of [-1, 1]) {
          const r1 = r + dr;
          const c1 = c + dc;
          if (!inBoard(r1, c1)) continue;
          const t1 = board[idx(r1, c1)];
          if (!t1) {
            steps.push({ from: idx(r, c), to: idx(r1, c1), capture: null });
            continue;
          }
          if (sideOf(t1) === side) continue;
          const r2 = r + dr * 2;
          const c2 = c + dc * 2;
          if (inBoard(r2, c2) && !board[idx(r2, c2)]) {
            jumps.push({ from: idx(r, c), to: idx(r2, c2), capture: idx(r1, c1) });
          }
        }
      }
    }
  }
  return jumps.length ? jumps : steps;
}

export function applyMove(board: CBoard, move: Move): { board: CBoard; againFrom: number | null } {
  const next = [...board];
  const piece = next[move.from];
  next[move.from] = null;
  if (move.capture !== null) next[move.capture] = null;
  const row = Math.floor(move.to / 8);
  let placed = piece;
  if (piece === "r" && row === 0) placed = "R";
  if (piece === "b" && row === 7) placed = "B";
  next[move.to] = placed;

  // chain jump available with the same piece?
  let againFrom: number | null = null;
  if (move.capture !== null) {
    const more = legalMoves(next, sideOf(placed)!).filter((m) => m.from === move.to && m.capture !== null);
    if (more.length) againFrom = move.to;
  }
  return { board: next, againFrom };
}

export function checkersWinner(board: CBoard): Side | null {
  const r = legalMoves(board, "r").length;
  const b = legalMoves(board, "b").length;
  const rCount = board.filter((p) => sideOf(p) === "r").length;
  const bCount = board.filter((p) => sideOf(p) === "b").length;
  if (rCount === 0 || r === 0) return "b";
  if (bCount === 0 || b === 0) return "r";
  return null;
}

/** Prefers captures, then advancing, otherwise random. */
export function checkersComputerMove(board: CBoard, side: Side): Move | null {
  const moves = legalMoves(board, side);
  if (!moves.length) return null;
  const caps = moves.filter((m) => m.capture !== null);
  const pool = caps.length ? caps : moves;
  const scored = pool.map((m) => {
    const row = Math.floor(m.to / 8);
    const advance = side === "r" ? 7 - row : row;
    return { m, score: advance + Math.random() };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].m;
}
