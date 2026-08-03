/** Permanent competitive record derived from `battle_wins` (survives battle deletes). */

export type BattleWinRow = {
  id: string;
  battle_id?: string | null;
  winner_id: string;
  loser_id?: string | null;
  battle_title: string;
  winner_votes: number;
  loser_votes: number;
  media_type: string;
  winner_cover_url?: string | null;
  winner_title?: string | null;
  declared_at: string;
};

export type BattleResult = {
  id: string;
  outcome: "win" | "loss";
  title: string;
  mediaType: string;
  myVotes: number;
  theirVotes: number;
  coverUrl: string | null;
  declaredAt: string;
};

export type BattleArenaRecord = {
  wins: number;
  losses: number;
  fights: number;
  winPct: number;
  currentStreak: number;
  bestStreak: number;
  totalCrowdVotes: number;
  biggestWinMargin: number;
  byMedia: Record<string, { wins: number; losses: number }>;
  results: BattleResult[];
};

function mediaKey(mediaType?: string | null): string {
  const t = (mediaType || "audio").toLowerCase();
  if (t === "live" || t === "video" || t === "photo" || t === "audio") return t;
  return "audio";
}

/** Chronological competitive record for one competitor from permanent battle_wins rows. */
export function buildBattleArenaRecord(
  userId: string,
  rows: BattleWinRow[],
): BattleArenaRecord {
  const relevant = rows
    .filter((r) => r.winner_id === userId || r.loser_id === userId)
    .slice()
    .sort(
      (a, b) =>
        new Date(b.declared_at).getTime() - new Date(a.declared_at).getTime(),
    );

  const results: BattleResult[] = relevant.map((r) => {
    const win = r.winner_id === userId;
    return {
      id: r.id,
      outcome: win ? "win" : "loss",
      title: r.battle_title || "Battle",
      mediaType: mediaKey(r.media_type),
      myVotes: win ? r.winner_votes : r.loser_votes,
      theirVotes: win ? r.loser_votes : r.winner_votes,
      coverUrl: r.winner_cover_url || null,
      declaredAt: r.declared_at,
    };
  });

  let wins = 0;
  let losses = 0;
  let totalCrowdVotes = 0;
  let biggestWinMargin = 0;
  const byMedia: BattleArenaRecord["byMedia"] = {};

  for (const r of results) {
    const key = r.mediaType;
    if (!byMedia[key]) byMedia[key] = { wins: 0, losses: 0 };
    if (r.outcome === "win") {
      wins += 1;
      byMedia[key].wins += 1;
      totalCrowdVotes += r.myVotes + r.theirVotes;
      biggestWinMargin = Math.max(biggestWinMargin, r.myVotes - r.theirVotes);
    } else {
      losses += 1;
      byMedia[key].losses += 1;
      totalCrowdVotes += r.myVotes + r.theirVotes;
    }
  }

  let currentStreak = 0;
  for (const r of results) {
    if (r.outcome !== "win") break;
    currentStreak += 1;
  }

  let bestStreak = 0;
  let run = 0;
  // Oldest → newest for best run
  for (const r of [...results].reverse()) {
    if (r.outcome === "win") {
      run += 1;
      bestStreak = Math.max(bestStreak, run);
    } else {
      run = 0;
    }
  }

  const fights = wins + losses;
  const winPct = fights > 0 ? Math.round((wins / fights) * 100) : 0;

  return {
    wins,
    losses,
    fights,
    winPct,
    currentStreak,
    bestStreak,
    totalCrowdVotes,
    biggestWinMargin,
    byMedia,
    results,
  };
}

export function mediaTypeLabel(mediaType: string): string {
  switch (mediaType) {
    case "live":
      return "Live";
    case "video":
      return "Video";
    case "photo":
      return "Photo";
    default:
      return "Music";
  }
}

export function mediaTypeEmoji(mediaType: string): string {
  switch (mediaType) {
    case "live":
      return "📡";
    case "video":
      return "🎥";
    case "photo":
      return "📸";
    default:
      return "🎵";
  }
}
