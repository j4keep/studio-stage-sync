import { IslandState, MAX_HEARTS, RUN_MS } from "./engine";

export type IslandScore = {
  survivedMs: number;
  survivedPoints: number;
  stars: number;
  starPoints: number;
  avoided: number;
  avoidPoints: number;
  heartBonus: number;
  objectivePoints: number;
  survivalBonus: number;
  total: number;
  xp: number;
};

/** Seconds survived + stars + hazards dodged + hearts left + full-survival bonus. */
export function scoreIsland(st: IslandState): IslandScore {
  const survivedMs = RUN_MS - st.timeLeft;
  const seconds = Math.floor(survivedMs / 1000);
  const survivedPoints = seconds * 10;
  const starPoints = st.stars * 120;
  const avoidPoints = st.avoided * 40;
  const heartBonus = st.hearts * 250;
  const objectivePoints = st.objectives.filter((o) => o.done).length * 300;
  const survivalBonus = st.status === "survived" ? 1500 : 0;
  const total = Math.max(
    0,
    survivedPoints + starPoints + avoidPoints + heartBonus + objectivePoints + survivalBonus,
  );
  return {
    survivedMs,
    survivedPoints,
    stars: st.stars,
    starPoints,
    avoided: st.avoided,
    avoidPoints,
    heartBonus,
    objectivePoints,
    survivalBonus,
    total,
    xp: Math.round(total / 20) + (st.status === "survived" ? 40 : 10),
  };
}

export function heartsLeftLabel(st: IslandState) {
  return `${st.hearts}/${MAX_HEARTS}`;
}

export function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
