/**
 * YAJ Sugar Rush solo campaign — a level map, each level a move-limited score target (the
 * classic mode, distinct from versus mode's timed rounds). Progress (best stars per level,
 * which levels are unlocked) is saved locally per device, the same lightweight pattern this
 * app already uses for sound-mute preferences — there's no server-side "campaign" concept
 * for any game yet, so this doesn't invent a new backend surface for one game.
 */

export type Level = {
  id: number;
  gridSize: number;
  moveLimit: number;
  targetScore: number;
  starScores: [number, number, number];
};

function level(id: number, gridSize: number, moveLimit: number, targetScore: number): Level {
  return {
    id,
    gridSize,
    moveLimit,
    targetScore,
    starScores: [targetScore, Math.round(targetScore * 1.35), Math.round(targetScore * 1.75)],
  };
}

export const LEVELS: Level[] = [
  level(1, 7, 18, 600),
  level(2, 7, 16, 800),
  level(3, 7, 15, 1000),
  level(4, 8, 18, 1300),
  level(5, 8, 16, 1600),
  level(6, 8, 15, 1900),
  level(7, 8, 14, 2200),
  level(8, 8, 16, 2600),
  level(9, 8, 14, 3000),
  level(10, 9, 16, 3500),
  level(11, 9, 15, 4000),
  level(12, 9, 14, 4500),
  level(13, 9, 13, 5000),
  level(14, 9, 14, 5600),
  level(15, 9, 12, 6200),
];

export function starsForScore(lvl: Level, score: number): 0 | 1 | 2 | 3 {
  if (score >= lvl.starScores[2]) return 3;
  if (score >= lvl.starScores[1]) return 2;
  if (score >= lvl.starScores[0]) return 1;
  return 0;
}

type Progress = Record<number, number>; // levelId -> best stars

function progressKey(userId: string | undefined) {
  return `yaj.games.sugarrush.progress.${userId || "guest"}`;
}

export function loadProgress(userId: string | undefined): Progress {
  try {
    const raw = localStorage.getItem(progressKey(userId));
    return raw ? (JSON.parse(raw) as Progress) : {};
  } catch {
    return {};
  }
}

export function saveLevelStars(userId: string | undefined, levelId: number, stars: number) {
  const progress = loadProgress(userId);
  if ((progress[levelId] ?? 0) < stars) {
    progress[levelId] = stars;
    try {
      localStorage.setItem(progressKey(userId), JSON.stringify(progress));
    } catch {
      /* best effort */
    }
  }
}

/** A level unlocks once the one before it has been played at all (1+ star), first level
 *  always open. */
export function isLevelUnlocked(progress: Progress, levelId: number): boolean {
  if (levelId <= 1) return true;
  return (progress[levelId - 1] ?? 0) > 0;
}
