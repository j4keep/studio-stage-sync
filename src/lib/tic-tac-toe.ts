export type Cell = "X" | "O" | null;
export type Board = Cell[];

export const EMPTY_BOARD: Board = Array(9).fill(null);

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function winningLine(board: Board): number[] | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return null;
}

export function winner(board: Board): Cell {
  const line = winningLine(board);
  return line ? board[line[0]] : null;
}

export function isDraw(board: Board): boolean {
  return !winner(board) && board.every((c) => c !== null);
}

export function isLegalMove(board: Board, index: number): boolean {
  return index >= 0 && index < 9 && board[index] === null && !winner(board);
}

/** Simple but competent computer move: win, block, center, corner, side. */
export function computerMove(board: Board, me: "X" | "O"): number {
  const them: "X" | "O" = me === "X" ? "O" : "X";
  const empty = board.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0);

  const finder = (mark: "X" | "O") => {
    for (const line of LINES) {
      const vals = line.map((i) => board[i]);
      const marks = vals.filter((v) => v === mark).length;
      const blanks = vals.filter((v) => v === null).length;
      if (marks === 2 && blanks === 1) return line[vals.indexOf(null)];
    }
    return -1;
  };

  const win = finder(me);
  if (win >= 0) return win;
  const block = finder(them);
  if (block >= 0) return block;
  if (board[4] === null) return 4;
  const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
  return empty[Math.floor(Math.random() * empty.length)] ?? -1;
}
