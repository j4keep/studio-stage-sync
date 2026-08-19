/**
 * Heads-up Texas Hold'em. Two players, fixed blinds, best cumulative stack
 * after a hand cap (or whoever busts the other first) wins the match. Whoever
 * acts resolves their own action locally and writes the result — same
 * "acting player persists the outcome" pattern as every other game here.
 *
 * Hidden information (hole cards) is stored in the same shared game_state as
 * everything else and only hidden client-side by the UI, the same trade-off
 * already made for Battleship's ship placement in this app.
 */

export type Seat = 0 | 1;
export type Suit = "s" | "h" | "d" | "c";
export type Card = { rank: number; suit: Suit }; // rank 2..14 (14 = Ace)

export const SUITS: Suit[] = ["s", "h", "d", "c"];
export const RANK_LABEL: Record<number, string> = {
  2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K", 14: "A",
};

export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (let rank = 2; rank <= 14; rank++) deck.push({ rank, suit });
  return deck;
}

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---- Hand evaluation ----

export type HandRank = { category: number; tiebreak: number[]; label: string };

const CATEGORY_LABELS = ["High Card", "Pair", "Two Pair", "Three of a Kind", "Straight", "Flush", "Full House", "Four of a Kind", "Straight Flush"];

function evaluate5(cards: Card[]): HandRank {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const isFlush = cards.every((c) => c.suit === cards[0].suit);

  const uniqueRanks = Array.from(new Set(ranks)).sort((a, b) => b - a);
  let straightHigh = 0;
  if (uniqueRanks.length === 5) {
    if (uniqueRanks[0] - uniqueRanks[4] === 4) straightHigh = uniqueRanks[0];
    else if (uniqueRanks.join(",") === "14,5,4,3,2") straightHigh = 5; // wheel: A-2-3-4-5
  }

  const counts: Record<number, number> = {};
  ranks.forEach((r) => (counts[r] = (counts[r] || 0) + 1));
  const groups = Object.entries(counts)
    .map(([r, c]) => ({ rank: Number(r), count: c }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  const cat = (n: number, tiebreak: number[]): HandRank => ({ category: n, tiebreak, label: CATEGORY_LABELS[n] });

  if (straightHigh && isFlush) return cat(8, [straightHigh]);
  if (groups[0].count === 4) return cat(7, [groups[0].rank, groups[1].rank]);
  if (groups[0].count === 3 && groups[1]?.count === 2) return cat(6, [groups[0].rank, groups[1].rank]);
  if (isFlush) return cat(5, ranks);
  if (straightHigh) return cat(4, [straightHigh]);
  if (groups[0].count === 3) return cat(3, [groups[0].rank, ...groups.slice(1).map((g) => g.rank)]);
  if (groups[0].count === 2 && groups[1]?.count === 2) {
    const [hi, lo] = [groups[0].rank, groups[1].rank].sort((a, b) => b - a);
    return cat(2, [hi, lo, groups[2].rank]);
  }
  if (groups[0].count === 2) return cat(1, [groups[0].rank, ...groups.slice(1).map((g) => g.rank)]);
  return cat(0, ranks);
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

/** Best 5-card hand out of 5..7 cards. */
export function bestHand(cards: Card[]): HandRank {
  const combos = cards.length === 5 ? [cards] : combinations(cards, 5);
  return combos.map(evaluate5).reduce((best, h) => (compareHands(h, best) > 0 ? h : best));
}

/** >0 if a beats b, <0 if b beats a, 0 if tied. */
export function compareHands(a: HandRank, b: HandRank): number {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
    const diff = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// ---- Match / hand state ----

export const STARTING_STACK = 500;
export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;
export const MAX_HANDS = 12;

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";
export type PokerAction = "fold" | "check" | "call" | "raise" | "all_in";

export type LastAction = { seat: Seat; action: PokerAction; amount: number; message: string };
export type HandResult = { winnerSeat: Seat | null; potWon: number; reason: "fold" | "showdown"; winningHand?: string } | null;

export type PokerState = {
  deck: Card[];
  holeCards: [Card[], Card[]];
  community: Card[];
  street: Street;
  pot: number;
  stacks: [number, number];
  bets: [number, number];
  folded: [boolean, boolean];
  allIn: [boolean, boolean];
  actedThisStreet: [boolean, boolean];
  /** Seat holding the button this hand — heads-up, the button posts the small blind and acts first preflop. */
  button: Seat;
  turnSeat: Seat;
  handNumber: number;
  phase: "active" | "over";
  winnerSeat: Seat | null;
  lastAction: LastAction | null;
  lastHandResult: HandResult;
};

function dealHand(stacks: [number, number], button: Seat, handNumber: number, rand: () => number): PokerState {
  const deck = shuffle(makeDeck(), rand);
  const holeCards: [Card[], Card[]] = [
    [deck[0], deck[2]],
    [deck[1], deck[3]],
  ];
  const remaining = deck.slice(4);
  const sb: Seat = button;
  const bb: Seat = button === 0 ? 1 : 0;

  const stacksAfterBlinds: [number, number] = [...stacks] as [number, number];
  const bets: [number, number] = [0, 0];
  const postBlind = (seat: Seat, amount: number) => {
    const pay = Math.min(amount, stacksAfterBlinds[seat]);
    stacksAfterBlinds[seat] -= pay;
    bets[seat] += pay;
  };
  postBlind(sb, SMALL_BLIND);
  postBlind(bb, BIG_BLIND);

  return {
    deck: remaining,
    holeCards,
    community: [],
    street: "preflop",
    pot: bets[0] + bets[1],
    stacks: stacksAfterBlinds,
    bets,
    folded: [false, false],
    allIn: [stacksAfterBlinds[0] === 0, stacksAfterBlinds[1] === 0],
    actedThisStreet: [false, false],
    button,
    turnSeat: sb, // heads-up: the button (small blind) acts first preflop
    handNumber,
    phase: "active",
    winnerSeat: null,
    lastAction: null,
    lastHandResult: null,
  };
}

export function initialPoker(rand: () => number = Math.random): PokerState {
  return dealHand([STARTING_STACK, STARTING_STACK], 0, 1, rand);
}

function roundComplete(s: PokerState): boolean {
  // A player all-in for less than the opponent's bet can never literally match it —
  // their commitment is final regardless, so that counts as "settled" too.
  const settled = s.bets[0] === s.bets[1] || s.allIn[0] || s.allIn[1];
  return settled && s.actedThisStreet[0] && s.actedThisStreet[1];
}

function dealStreet(state: PokerState, rand: () => number): PokerState {
  let deck = [...state.deck];
  let community = [...state.community];
  let street = state.street;

  if (street === "preflop") {
    community = [deck[0], deck[1], deck[2]];
    deck = deck.slice(3);
    street = "flop";
  } else if (street === "flop") {
    community = [...community, deck[0]];
    deck = deck.slice(1);
    street = "turn";
  } else if (street === "turn") {
    community = [...community, deck[0]];
    deck = deck.slice(1);
    street = "river";
  } else {
    street = "showdown";
  }

  const bothAllIn = state.allIn[0] || state.allIn[1];
  const next: PokerState = {
    ...state,
    deck,
    community,
    street,
    bets: [0, 0],
    actedThisStreet: [false, false],
    // heads-up postflop: the non-button acts first.
    turnSeat: state.button === 0 ? 1 : 0,
  };

  if (street === "showdown") return resolveShowdown(next);
  // If either side is already all-in and covered, there's no one left to bet against — run it out.
  if (bothAllIn) return dealStreet(next, rand);
  return next;
}

function resolveShowdown(state: PokerState): PokerState {
  const h0 = bestHand([...state.holeCards[0], ...state.community]);
  const h1 = bestHand([...state.holeCards[1], ...state.community]);
  const cmp = compareHands(h0, h1);
  const handWinner: Seat | null = cmp === 0 ? null : cmp > 0 ? 0 : 1;
  return awardPot(state, handWinner, "showdown", handWinner !== null ? (handWinner === 0 ? h0.label : h1.label) : h0.label);
}

function awardPot(state: PokerState, winner: Seat | null, reason: "fold" | "showdown", winningHand?: string): PokerState {
  const stacks: [number, number] = [...state.stacks] as [number, number];
  if (winner === null) {
    // split pot
    stacks[0] += Math.floor(state.pot / 2);
    stacks[1] += state.pot - Math.floor(state.pot / 2);
  } else {
    stacks[winner] += state.pot;
  }

  const matchOver = stacks[0] <= 0 || stacks[1] <= 0 || state.handNumber >= MAX_HANDS;
  const matchWinner: Seat | null = !matchOver ? null : stacks[0] === stacks[1] ? null : stacks[0] > stacks[1] ? 0 : 1;

  return {
    ...state,
    stacks,
    pot: 0,
    street: "showdown",
    phase: matchOver ? "over" : "active",
    winnerSeat: matchWinner,
    lastHandResult: { winnerSeat: winner, potWon: state.pot, reason, winningHand },
  };
}

/** Starts the next hand, alternating the button. No-ops if the match is already over. */
export function nextHand(state: PokerState, rand: () => number = Math.random): PokerState {
  if (state.phase === "over") return state;
  const nextButton: Seat = state.button === 0 ? 1 : 0;
  return dealHand(state.stacks, nextButton, state.handNumber + 1, rand);
}

const ACTION_LABEL: Record<PokerAction, string> = { fold: "Folds", check: "Checks", call: "Calls", raise: "Raises to", all_in: "All in for" };

/**
 * Resolves one action for `seat`. `amount` is only used for "raise" and is the
 * TOTAL bet-to for the street (not the delta). Does not check whose turn it
 * is — the caller (the page) gates that, same as this app's other games.
 */
export function applyAction(state: PokerState, seat: Seat, action: PokerAction, amount = 0, rand: () => number = Math.random): PokerState {
  const opp: Seat = seat === 0 ? 1 : 0;
  const stacks: [number, number] = [...state.stacks] as [number, number];
  const bets: [number, number] = [...state.bets] as [number, number];
  const folded: [boolean, boolean] = [...state.folded] as [boolean, boolean];
  const allIn: [boolean, boolean] = [...state.allIn] as [boolean, boolean];
  const actedThisStreet: [boolean, boolean] = [...state.actedThisStreet] as [boolean, boolean];
  let pot = state.pot;
  let lastAction: LastAction;

  if (action === "fold") {
    folded[seat] = true;
    const withFold: PokerState = { ...state, folded, lastAction: { seat, action, amount: 0, message: `${ACTION_LABEL.fold}` } };
    return awardPot(withFold, opp, "fold");
  }

  if (action === "check") {
    actedThisStreet[seat] = true;
    lastAction = { seat, action, amount: 0, message: ACTION_LABEL.check };
  } else if (action === "call") {
    const toCall = Math.max(0, bets[opp] - bets[seat]);
    const pay = Math.min(toCall, stacks[seat]);
    stacks[seat] -= pay;
    bets[seat] += pay;
    pot += pay;
    if (stacks[seat] === 0) allIn[seat] = true;
    actedThisStreet[seat] = true;
    lastAction = { seat, action, amount: pay, message: `${ACTION_LABEL.call} ${pay}` };
  } else {
    // raise or all_in: `amount`/stack-cap is the TOTAL bet-to for this street.
    const target = action === "all_in" ? bets[seat] + stacks[seat] : amount;
    const pay = Math.min(Math.max(0, target - bets[seat]), stacks[seat]);
    stacks[seat] -= pay;
    bets[seat] += pay;
    pot += pay;
    if (stacks[seat] === 0) allIn[seat] = true;
    actedThisStreet[seat] = true;
    actedThisStreet[opp] = false; // opponent must respond to the raise
    lastAction = { seat, action, amount: bets[seat], message: `${stacks[seat] === 0 ? ACTION_LABEL.all_in : ACTION_LABEL.raise} ${bets[seat]}` };
  }

  let next: PokerState = { ...state, stacks, bets, folded, allIn, actedThisStreet, pot, lastAction, turnSeat: opp };

  if (roundComplete(next)) {
    next = dealStreet(next, rand);
  }

  return next;
}

/** Legal actions for the seat to act, and the min/max raise-to amounts. */
export function legalActions(state: PokerState, seat: Seat) {
  const opp: Seat = seat === 0 ? 1 : 0;
  const toCall = Math.max(0, state.bets[opp] - state.bets[seat]);
  const canCheck = toCall === 0;
  const canRaise = state.stacks[seat] > toCall;
  const minRaiseTo = state.bets[seat] + toCall + Math.max(BIG_BLIND, toCall);
  const maxRaiseTo = state.bets[seat] + state.stacks[seat];
  return { toCall, canCheck, canRaise, minRaiseTo: Math.min(minRaiseTo, maxRaiseTo), maxRaiseTo };
}

/** Simple heuristic computer: plays hand strength vs. pot pressure, bluffs rarely. */
export function computerAction(state: PokerState, seat: Seat, rand: () => number = Math.random): { action: PokerAction; amount?: number } {
  const { toCall, canCheck, canRaise, maxRaiseTo } = legalActions(state, seat);
  const knownCards = [...state.holeCards[seat], ...state.community];
  const strength = handStrength(knownCards, state.community.length);

  if (canCheck) {
    if (strength > 0.72 && canRaise && rand() < 0.6) {
      const raiseTo = Math.min(maxRaiseTo, state.bets[seat] + Math.round(Math.max(BIG_BLIND, state.pot * 0.7)));
      return { action: raiseTo >= maxRaiseTo ? "all_in" : "raise", amount: raiseTo };
    }
    return { action: "check" };
  }

  const potOdds = toCall / Math.max(1, state.pot + toCall);
  if (strength < potOdds * 0.85 && rand() < 0.85) return { action: "fold" };
  if (strength > 0.8 && canRaise && rand() < 0.5) {
    const raiseTo = Math.min(maxRaiseTo, state.bets[seat] + toCall + Math.round(Math.max(BIG_BLIND, state.pot * 0.8)));
    return { action: raiseTo >= maxRaiseTo ? "all_in" : "raise", amount: raiseTo };
  }
  return { action: "call" };
}

/** Live hand read for the strength meter shown in the UI — cosmetic only, not used by any game logic. */
export function liveHandInfo(hole: Card[], community: Card[]): { label: string; strength: number } {
  if (community.length === 0) {
    const [a, b] = hole.map((c) => c.rank).sort((x, y) => y - x);
    const pair = a === b;
    const suited = hole[0].suit === hole[1].suit;
    const label = pair ? "Pocket Pair" : suited ? "Suited" : "High Card";
    let s = (a + b) / 28;
    if (pair) s += 0.3;
    if (suited) s += 0.05;
    return { label, strength: Math.min(1, s) };
  }
  const hand = bestHand([...hole, ...community]);
  return { label: hand.label, strength: Math.min(1, hand.category / 8 + hand.tiebreak[0] / 140) };
}

/** Rough 0..1 hand-strength heuristic used only by the computer's decisions. */
function handStrength(cards: Card[], communityCount: number): number {
  if (communityCount === 0) {
    const [a, b] = cards.map((c) => c.rank).sort((x, y) => y - x);
    const pair = a === b;
    const suited = cards[0].suit === cards[1].suit;
    let s = (a + b) / 28;
    if (pair) s += 0.3;
    if (suited) s += 0.05;
    if (a - b <= 2 && !pair) s += 0.05;
    return Math.min(1, s);
  }
  const hand = bestHand(cards);
  return Math.min(1, hand.category / 8 + hand.tiebreak[0] / 140);
}
