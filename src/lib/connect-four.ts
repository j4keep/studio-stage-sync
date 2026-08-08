export type C4Cell = "R" | "Y" | null;
export type C4Board = C4Cell[]; // 6 rows x 7 cols, index = row * 7 + col

export const C4_ROWS = 6;
export const C4_COLS = 7;
export const C4_EMPTY: C4Board = Array(C4_ROWS * C4_COLS).fill(null);

const idx = (r: number, c: number) => r * C4_COLS + c;

export function dropRow(board: C4Board, col: number): number {
  for (let r = C4_ROWS - 1; r >= 0; r -= 1) if (board[idx(r, col)] === null) return r;
  return -1;
}

export function canDrop(board: C4Board, col: number): boolean {
  return !c4Winner(board) && dropRow(board, col) >= 0;
}

export function drop(board: C4Board, col: number, mark: "R" | "Y"): C4Board | null {
  const r = dropRow(board, col);
  if (r < 0) return null;
  const next = [...board];
  next[idx(r, col)] = mark;
  return next;
}

export function c4WinningLine(board: C4Board): number[] | null {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < C4_ROWS; r += 1) {
    for (let c = 0; c < C4_COLS; c += 1) {
      const v = board[idx(r, c)];
      if (!v) continue;
      for (const [dr, dc] of dirs) {
        const line = [idx(r, c)];
        for (let k = 1; k < 4; k += 1) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= C4_ROWS || cc < 0 || cc >= C4_COLS) break;
          if (board[idx(rr, cc)] !== v) break;
          line.push(idx(rr, cc));
        }
        if (line.length === 4) return line;
      }
    }
  }
  return null;
}

export function c4Winner(board: C4Board): C4Cell {
  const line = c4WinningLine(board);
  return line ? board[line[0]] : null;
}

export function c4IsDraw(board: C4Board): boolean {
  return !c4Winner(board) && board.every((c) => c !== null);
}

/** Win, block, prefer center. */
export function c4ComputerMove(board: C4Board, me: "R" | "Y"): number {
  const them: "R" | "Y" = me === "R" ? "Y" : "R";
  const cols = Array.from({ length: C4_COLS }, (_, i) => i).filter((c) => dropRow(board, c) >= 0);
  if (!cols.length) return -1;

  for (const mark of [me, them] as const) {
    for (const c of cols) {
      const test = drop(board, c, mark);
      if (test && c4Winner(test) === mark) return c;
    }
  }
  const order = [3, 2, 4, 1, 5, 0, 6].filter((c) => cols.includes(c));
  return order[0] ?? cols[0];
}
