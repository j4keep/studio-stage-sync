import { describe, expect, it } from "vitest";
import { EMPTY_BOARD, computerMove, isDraw, isLegalMove, winner } from "./tic-tac-toe";

describe("tic-tac-toe", () => {
  it("detects a win", () => {
    expect(winner(["X","X","X",null,null,null,null,null,null])).toBe("X");
    expect(winner(["O",null,null,"O",null,null,"O",null,null])).toBe("O");
  });
  it("detects a draw", () => {
    expect(isDraw(["X","O","X","X","O","O","O","X","X"])).toBe(true);
  });
  it("rejects illegal moves", () => {
    expect(isLegalMove(["X",...Array(8).fill(null)] as any, 0)).toBe(false);
    expect(isLegalMove(EMPTY_BOARD, 4)).toBe(true);
  });
  it("computer takes the win", () => {
    expect(computerMove(["O","O",null,null,null,null,null,null,null], "O")).toBe(2);
  });
  it("computer blocks", () => {
    expect(computerMove(["X","X",null,null,"O",null,null,null,null], "O")).toBe(2);
  });
});
