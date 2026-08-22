import { MAX_HEARTS, TowerState } from "./engine";
import { TOTAL_CHECKPOINTS } from "./level";

export type TowerScore = {
  base: number;
  stars: number;
  starPoints: number;
  timeBonus: number;
  heartBonus: number;
  checkpointBonus: number;
  escapeBonus: number;
  total: number;
  climbedPct: number;
  elapsedMs: number;
};

/** End-of-run scoring: stars + time left + hearts left + rooftop escape bonus. */
export function scoreRun(st: TowerState): TowerScore {
  const escaped = st.status === "escaped";
  const starPoints = st.stars * 120 + st.bonusStars * 100;
  const timeBonus = escaped && !st.noTimer ? Math.round(st.timeLeft / 1000) * 12 : 0;
  const heartBonus = st.hearts * 200;
  const checkpointBonus = st.checkpoint * 250;
  const escapeBonus = escaped ? 1500 : 0;
  const base = 0;
  const total = Math.max(0, base + starPoints + timeBonus + heartBonus + checkpointBonus + escapeBonus);
  return {
    base,
    stars: st.stars,
    starPoints,
    timeBonus,
    heartBonus,
    checkpointBonus,
    escapeBonus,
    total,
    climbedPct: Math.min(100, Math.round((st.highest / st.level.top) * 100)),
    elapsedMs: Math.round(st.t * 1000),
  };
}

export function medalFor(score: TowerScore, st: TowerState): "gold" | "silver" | "bronze" | "none" {
  if (st.status !== "escaped") return "none";
  if (st.hearts === MAX_HEARTS && score.stars >= 24) return "gold";
  if (score.stars >= 18) return "silver";
  return "bronze";
}

export function checkpointLabel(st: TowerState) {
  return `${st.checkpoint}/${TOTAL_CHECKPOINTS}`;
}

export function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
