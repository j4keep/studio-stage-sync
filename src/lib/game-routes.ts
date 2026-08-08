import { GameType } from "@/lib/games";
import { EMPTY_BOARD } from "@/lib/tic-tac-toe";
import { C4_EMPTY } from "@/lib/connect-four";
import { initialCheckers } from "@/lib/checkers";
import { initialDominoes } from "@/lib/dominoes";
import { pickQuestions } from "@/lib/trivia";

export const GAME_PATHS: Record<GameType, string> = {
  tic_tac_toe: "tic-tac-toe",
  connect_four: "connect-four",
  checkers: "checkers",
  dominoes: "dominoes",
  trivia: "trivia",
  yaj_dash: "dash",
};

export function gameRoute(type: GameType, id?: string) {
  const base = `/games/${GAME_PATHS[type]}`;
  return id ? `${base}/${id}` : base;
}

export function initialStateFor(type: GameType): any {
  switch (type) {
    case "tic_tac_toe":
      return { board: EMPTY_BOARD, moveNumber: 0 };
    case "connect_four":
      return { board: C4_EMPTY, moveNumber: 0 };
    case "checkers":
      return { board: initialCheckers(), moveNumber: 0 };
    case "dominoes":
      return { dom: initialDominoes(), moveNumber: 0 };
    case "trivia":
      return { questions: pickQuestions(), i: 0, scores: [0, 0], moveNumber: 0 };
    default:
      return { moveNumber: 0 };
  }
}
