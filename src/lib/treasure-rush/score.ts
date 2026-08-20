import { MAX_HEARTS, TrState } from "./engine";

export const VALUES = {
  coin: 25,
  gem: 75,
  chest: 150,
  goldChest: 1000,
  timePerSecond: 20,
  escape: 500,
  heart: 100,
};

export type ScoreLine = { label: string; value: number };

export type ScoreBreakdown = {
  lines: ScoreLine[];
  total: number;
  secondsLeft: number;
  escaped: boolean;
};

/** ScoreManager — one place that turns a finished run into points. */
export function breakdownOf(s: TrState): ScoreBreakdown {
  const escaped = s.status === "complete";
  const secondsLeft = Math.floor(s.timeLeft / 1000);

  const lines: ScoreLine[] = [
    { label: `YAJ Coins × ${s.coins}`, value: s.coins * VALUES.coin },
    { label: `Star Gems × ${s.gems}`, value: s.gems * VALUES.gem },
    { label: `Treasure Chests × ${s.chests}`, value: s.chests * VALUES.chest },
    { label: `Gold Chests × ${s.goldChests}`, value: s.goldChests * VALUES.goldChest },
  ];

  if (escaped) {
    lines.push({ label: `Time Bonus (${secondsLeft}s left)`, value: secondsLeft * VALUES.timePerSecond });
    lines.push({ label: "Escape Bonus", value: VALUES.escape });
    lines.push({ label: `Hearts Remaining × ${s.hearts}`, value: s.hearts * VALUES.heart });
  }

  const total = lines.reduce((a, l) => a + l.value, 0);
  return { lines: lines.filter((l) => l.value > 0 || l.label.startsWith("YAJ Coins")), total, secondsLeft, escaped };
}

export function liveScore(s: TrState) {
  return s.coins * VALUES.coin + s.gems * VALUES.gem + s.chests * VALUES.chest + s.goldChests * VALUES.goldChest;
}

export function xpFor(total: number, escaped: boolean) {
  return Math.round(total / 40) + (escaped ? 25 : 5);
}

export function heartsLabel(hearts: number) {
  return `${hearts}/${MAX_HEARTS}`;
}

export function clockLabel(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
