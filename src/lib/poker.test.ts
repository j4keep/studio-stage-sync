import { describe, expect, it } from "vitest";
import {
  BIG_BLIND,
  Card,
  PokerState,
  STARTING_STACK,
  applyAction,
  bestHand,
  compareHands,
  computerAction,
  initialPoker,
  legalActions,
  makeDeck,
  nextHand,
  shuffle,
} from "./poker";

function c(rank: number, suit: "s" | "h" | "d" | "c"): Card {
  return { rank, suit };
}

describe("poker — deck", () => {
  it("makes a standard 52-card deck with no duplicates", () => {
    const deck = makeDeck();
    expect(deck).toHaveLength(52);
    const keys = new Set(deck.map((card) => `${card.rank}${card.suit}`));
    expect(keys.size).toBe(52);
  });

  it("shuffle is a permutation, not a resample", () => {
    const deck = makeDeck();
    const shuffled = shuffle(deck, () => 0.5);
    expect(shuffled).toHaveLength(52);
    expect(new Set(shuffled.map((card) => `${card.rank}${card.suit}`)).size).toBe(52);
  });
});

describe("poker — hand evaluation", () => {
  it("ranks a pair above high card", () => {
    const pair = bestHand([c(10, "s"), c(10, "h"), c(2, "d"), c(5, "c"), c(9, "s")]);
    const high = bestHand([c(10, "s"), c(4, "h"), c(2, "d"), c(5, "c"), c(9, "s")]);
    expect(compareHands(pair, high)).toBeGreaterThan(0);
  });

  it("ranks two pair above one pair", () => {
    const twoPair = bestHand([c(10, "s"), c(10, "h"), c(4, "d"), c(4, "c"), c(9, "s")]);
    const onePair = bestHand([c(10, "s"), c(10, "h"), c(4, "d"), c(6, "c"), c(9, "s")]);
    expect(compareHands(twoPair, onePair)).toBeGreaterThan(0);
  });

  it("recognizes a straight, including the wheel (A-2-3-4-5)", () => {
    const straight = bestHand([c(9, "s"), c(8, "h"), c(7, "d"), c(6, "c"), c(5, "s")]);
    expect(straight.category).toBe(4);
    const wheel = bestHand([c(14, "s"), c(2, "h"), c(3, "d"), c(4, "c"), c(5, "s")]);
    expect(wheel.category).toBe(4);
    expect(wheel.tiebreak[0]).toBe(5); // wheel plays as a 5-high straight, not ace-high
  });

  it("recognizes a flush and ranks it above a straight", () => {
    const flush = bestHand([c(2, "s"), c(5, "s"), c(9, "s"), c(11, "s"), c(13, "s")]);
    const straight = bestHand([c(9, "h"), c(8, "d"), c(7, "c"), c(6, "s"), c(5, "h")]);
    expect(flush.category).toBe(5);
    expect(compareHands(flush, straight)).toBeGreaterThan(0);
  });

  it("recognizes a full house above a flush", () => {
    const fullHouse = bestHand([c(10, "s"), c(10, "h"), c(10, "d"), c(4, "c"), c(4, "s")]);
    const flush = bestHand([c(2, "s"), c(5, "s"), c(9, "s"), c(11, "s"), c(13, "s")]);
    expect(fullHouse.category).toBe(6);
    expect(compareHands(fullHouse, flush)).toBeGreaterThan(0);
  });

  it("recognizes four of a kind and a straight flush at the top", () => {
    const quads = bestHand([c(7, "s"), c(7, "h"), c(7, "d"), c(7, "c"), c(2, "s")]);
    const straightFlush = bestHand([c(9, "h"), c(8, "h"), c(7, "h"), c(6, "h"), c(5, "h")]);
    expect(quads.category).toBe(7);
    expect(straightFlush.category).toBe(8);
    expect(compareHands(straightFlush, quads)).toBeGreaterThan(0);
  });

  it("picks the best 5 of 7 cards", () => {
    // Trip 10s plus a made pair of 4s among 7 cards should read as a full house.
    const hand = bestHand([c(10, "s"), c(10, "h"), c(10, "d"), c(4, "c"), c(4, "s"), c(2, "h"), c(2, "d")]);
    expect(hand.category).toBe(6); // full house, 10s over 4s
    expect(hand.tiebreak).toEqual([10, 4]);
  });

  it("breaks ties correctly between two pair hands with the same pairs by kicker", () => {
    const better = bestHand([c(10, "s"), c(10, "h"), c(4, "d"), c(4, "c"), c(9, "s")]);
    const worse = bestHand([c(10, "s"), c(10, "h"), c(4, "d"), c(4, "c"), c(3, "s")]);
    expect(compareHands(better, worse)).toBeGreaterThan(0);
  });
});

describe("poker — hand/betting flow", () => {
  it("deals a fresh match with blinds posted and the button acting first preflop", () => {
    const s = initialPoker(() => 0.5);
    expect(s.stacks[0] + s.bets[0]).toBe(STARTING_STACK);
    expect(s.stacks[1] + s.bets[1]).toBe(STARTING_STACK);
    expect(s.bets[0]).toBeLessThan(s.bets[1]); // button/seat0 posts the smaller blind
    expect(s.turnSeat).toBe(0);
    expect(s.street).toBe("preflop");
    expect(s.holeCards[0]).toHaveLength(2);
    expect(s.holeCards[1]).toHaveLength(2);
  });

  it("a call that matches the big blind and a subsequent check advances to the flop", () => {
    let s = initialPoker(() => 0.9);
    s = applyAction(s, 0, "call", 0, () => 0.9); // button calls up to the big blind
    expect(s.street).toBe("preflop");
    s = applyAction(s, 1, "check", 0, () => 0.9); // big blind checks their option
    expect(s.street).toBe("flop");
    expect(s.community).toHaveLength(3);
    expect(s.bets).toEqual([0, 0]);
  });

  it("folding immediately awards the pot to the other seat", () => {
    let s = initialPoker(() => 0.5);
    const bbCommitted = s.bets[1]; // big blind already in the pot before the fold
    const potBefore = s.bets[0] + s.bets[1];
    s = applyAction(s, 0, "fold");
    expect(s.lastHandResult?.reason).toBe("fold");
    expect(s.lastHandResult?.winnerSeat).toBe(1);
    // Seat 1 gets back their own blind plus everything seat 0 put in.
    expect(s.stacks[1]).toBe(STARTING_STACK - bbCommitted + potBefore);
  });

  it("a raise requires the opponent to act again even though blinds made bets look settled once matched", () => {
    let s = initialPoker(() => 0.5);
    const raiseTo = s.bets[1] + BIG_BLIND * 2;
    s = applyAction(s, 0, "raise", raiseTo, () => 0.5);
    expect(s.street).toBe("preflop"); // opponent hasn't responded yet
    expect(s.turnSeat).toBe(1);
  });

  it("legalActions reports no call needed once bets are matched", () => {
    let s = initialPoker(() => 0.9);
    s = applyAction(s, 0, "call", 0, () => 0.9);
    const legal = legalActions(s, 1);
    expect(legal.canCheck).toBe(true);
    expect(legal.toCall).toBe(0);
  });

  it("runs straight to showdown once both players are all-in", () => {
    let s: PokerState = { ...initialPoker(() => 0.5), stacks: [40, 40] as [number, number] };
    s = applyAction(s, 0, "all_in", 0, () => 0.3);
    expect(s.street).toBe("preflop");
    s = applyAction(s, 1, "call", 0, () => 0.3);
    // Both all-in — hand should run all the way to a resolved showdown, not pause on later streets.
    expect(s.street).toBe("showdown");
    expect(s.community).toHaveLength(5);
    expect(s.lastHandResult?.reason).toBe("showdown");
  });

  it("nextHand alternates the button and deals fresh cards", () => {
    const s = initialPoker(() => 0.5);
    const n = nextHand(s, () => 0.5);
    expect(n.button).toBe(1);
    expect(n.handNumber).toBe(2);
    expect(n.street).toBe("preflop");
  });

  it("ends the match once a stack is busted", () => {
    // Hand-crafted river state with a guaranteed winner (seat 1's trip kings beat
    // seat 0's king-high) so the short-stacked loser is deterministically busted.
    let s: PokerState = {
      deck: [],
      holeCards: [
        [c(4, "h"), c(5, "d")],
        [c(13, "h"), c(13, "d")],
      ],
      community: [c(2, "s"), c(3, "h"), c(7, "d"), c(9, "c"), c(13, "s")],
      street: "river",
      pot: 40,
      stacks: [5, 380],
      bets: [0, 0],
      folded: [false, false],
      allIn: [false, false],
      actedThisStreet: [false, false],
      button: 0,
      turnSeat: 0,
      handNumber: 1,
      phase: "active",
      winnerSeat: null,
      lastAction: null,
      lastHandResult: null,
    };
    s = applyAction(s, 0, "all_in", 0, () => 0.5);
    s = applyAction(s, 1, "call", 0, () => 0.5);
    expect(s.street).toBe("showdown");
    expect(s.stacks[0]).toBe(0);
    expect(s.phase).toBe("over");
    expect(s.winnerSeat).toBe(1);
  });

  it("computerAction always returns a legal action", () => {
    const s = initialPoker(() => 0.5);
    const legal = legalActions(s, 1);
    const { action } = computerAction(s, 1, () => 0.5);
    if (!legal.canCheck) expect(["fold", "call", "raise", "all_in"]).toContain(action);
    else expect(["check", "raise", "all_in"]).toContain(action);
  });
});
