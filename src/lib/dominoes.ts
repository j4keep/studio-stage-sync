export type Tile = [number, number];

export type DomState = {
  hands: Tile[][]; // index 0 = seat 1, index 1 = seat 2
  layout: Tile[]; // played left-to-right, ends are layout[0][0] and last[1]
  pile: Tile[];
  turn: 0 | 1;
  passes: number;
};

export function allTiles(): Tile[] {
  const out: Tile[] = [];
  for (let a = 0; a <= 6; a += 1) for (let b = a; b <= 6; b += 1) out.push([a, b]);
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function initialDominoes(): DomState {
  const deck = shuffle(allTiles());
  return {
    hands: [deck.slice(0, 7), deck.slice(7, 14)],
    layout: [],
    pile: deck.slice(14),
    turn: 0,
    passes: 0,
  };
}

export function ends(state: DomState): [number, number] | null {
  if (!state.layout.length) return null;
  return [state.layout[0][0], state.layout[state.layout.length - 1][1]];
}

export function canPlay(state: DomState, tile: Tile): boolean {
  const e = ends(state);
  if (!e) return true;
  return tile.includes(e[0]) || tile.includes(e[1]);
}

export function playableTiles(state: DomState, seat: 0 | 1): number[] {
  return state.hands[seat].map((t, i) => (canPlay(state, t) ? i : -1)).filter((i) => i >= 0);
}

/** Plays hand[index] for the seat, orienting the tile and choosing a side. */
export function playTile(state: DomState, seat: 0 | 1, index: number, side?: "left" | "right"): DomState {
  const next: DomState = JSON.parse(JSON.stringify(state));
  const tile = next.hands[seat][index];
  if (!tile) return state;
  const e = ends(next);
  next.hands[seat].splice(index, 1);
  next.passes = 0;

  if (!e) {
    next.layout = [tile];
  } else {
    const [left, right] = e;
    const preferRight = side ? side === "right" : tile.includes(right);
    if (preferRight && tile.includes(right)) {
      next.layout.push(tile[0] === right ? tile : [tile[1], tile[0]]);
    } else if (tile.includes(left)) {
      next.layout.unshift(tile[1] === left ? tile : [tile[1], tile[0]]);
    } else {
      next.layout.push(tile[0] === right ? tile : [tile[1], tile[0]]);
    }
  }
  next.turn = seat === 0 ? 1 : 0;
  return next;
}

/** Draw one tile from the pile, or pass when it is empty. */
export function drawOrPass(state: DomState, seat: 0 | 1): DomState {
  const next: DomState = JSON.parse(JSON.stringify(state));
  if (next.pile.length) {
    next.hands[seat].push(next.pile.pop() as Tile);
    return next;
  }
  next.passes += 1;
  next.turn = seat === 0 ? 1 : 0;
  return next;
}

export function pipTotal(hand: Tile[]): number {
  return hand.reduce((s, t) => s + t[0] + t[1], 0);
}

/** Returns 0 or 1 for the winning seat, "draw", or null while the game continues. */
export function dominoesResult(state: DomState): 0 | 1 | "draw" | null {
  if (!state.hands[0].length) return 0;
  if (!state.hands[1].length) return 1;
  const blocked = state.passes >= 2 && !state.pile.length;
  if (!blocked) return null;
  const a = pipTotal(state.hands[0]);
  const b = pipTotal(state.hands[1]);
  if (a === b) return "draw";
  return a < b ? 0 : 1;
}

/** Computer plays the highest-pip playable tile, otherwise draws/passes. */
export function dominoesComputerTurn(state: DomState): DomState {
  const seat: 0 | 1 = 1;
  const options = playableTiles(state, seat);
  if (!options.length) return drawOrPass(state, seat);
  const best = options.reduce((bi, i) => {
    const t = state.hands[seat][i];
    const bt = state.hands[seat][bi];
    return t[0] + t[1] > bt[0] + bt[1] ? i : bi;
  }, options[0]);
  return playTile(state, seat, best);
}
