import { GameType } from "@/lib/games";
import { EMPTY_BOARD } from "@/lib/tic-tac-toe";
import { C4_EMPTY } from "@/lib/connect-four";
import { initialCheckers } from "@/lib/checkers";
import { initialDominoes } from "@/lib/dominoes";
import { pickQuestions } from "@/lib/trivia";
import { initialPool } from "@/lib/pool";
import { initialBoxing } from "@/lib/boxing";
import { initialBattleship, placeFleet, randomFleet } from "@/lib/battleship";
import { initialDrivingRun } from "@/lib/driving-run";
import { initialPoker } from "@/lib/poker";
import { initialPopShot } from "@/lib/pop-shot-run";
import { initialKnockHockey } from "@/lib/knock-hockey-run";
import { initialBingo } from "@/lib/bingo-run";
import { initialWordLink } from "@/lib/word-link-run";
import { initialMiniGolf } from "@/lib/mini-golf-run";
import { initialSnakeRoyale } from "@/lib/snake-royale-run";
import { initialObby } from "@/lib/obby";

export const GAME_PATHS: Record<GameType, string> = {
  tic_tac_toe: "tic-tac-toe",
  connect_four: "connect-four",
  checkers: "checkers",
  dominoes: "dominoes",
  trivia: "trivia",
  yaj_dash: "dash",
  pool: "pool",
  boxing: "boxing",
  battleship: "battleship",
  driving: "driving",
  poker: "poker",
  pop_shot: "pop-shot",
  knock_hockey: "knock-hockey",
  bingo: "bingo",
  word_link: "word-link",
  mini_golf: "mini-golf",
  snake_royale: "snake-royale",
  obby: "obby",
  city_run: "city-run",
  treasure_rush: "treasure-rush",
  tower_escape: "tower-escape",
  survival_island: "survival-island",
  neighborhood: "neighborhood",
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
    case "pool":
      return { pool: initialPool(), moveNumber: 0 };
    case "boxing":
      return { boxing: initialBoxing(), moveNumber: 0 };
    case "battleship":
      // Solo mode only reaches this path (see below) — pre-place the computer's fleet.
      return { battleship: placeFleet(initialBattleship(), 1, randomFleet()), moveNumber: 0 };
    case "driving":
      return { drivingRun: initialDrivingRun(), moveNumber: 0 };
    case "poker":
      return { poker: initialPoker(), moveNumber: 0 };
    case "pop_shot":
      return { popShot: initialPopShot(), moveNumber: 0 };
    case "knock_hockey":
      return { knockHockey: initialKnockHockey(), moveNumber: 0 };
    case "bingo":
      return { bingo: initialBingo(), moveNumber: 0 };
    case "word_link":
      return { wordLink: initialWordLink(), moveNumber: 0 };
    case "mini_golf":
      return { miniGolf: initialMiniGolf(), moveNumber: 0 };
    case "snake_royale":
      return { snakeRoyale: initialSnakeRoyale(), moveNumber: 0 };
    case "treasure_rush":
    case "tower_escape":
    case "survival_island":
    case "neighborhood":
      return { moveNumber: 0 };
    case "obby":
    case "city_run":
      return { obby: initialObby(), moveNumber: 0 };
    default:
      return { moveNumber: 0 };
  }
}
