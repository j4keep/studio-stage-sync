/** Pure UI helpers for Creators Battle — no backend changes. */

import { getBattleScheduledStartAt } from "@/lib/battle-live";

export type BattleUiStatus = "live" | "waiting" | "ending" | "ended" | "open" | "countdown";

export type BattleCategoryMeta = {
  id: string;
  label: string;
  emoji: string;
};

/** Map existing media_type to a browseable category chip (no new DB field). */
export function battleCategoryFromMedia(mediaType?: string | null): BattleCategoryMeta {
  const t = (mediaType || "audio").toLowerCase();
  if (t === "live") return { id: "live", label: "Live", emoji: "🔴" };
  if (t === "video") return { id: "video", label: "Video", emoji: "🎥" };
  if (t === "photo") return { id: "photography", label: "Photography", emoji: "📸" };
  return { id: "music", label: "Music", emoji: "🎵" };
}

export function getBattleExpiresAt(battle: {
  expires_at?: string | null;
  created_at?: string | null;
}): Date {
  if (battle.expires_at) return new Date(battle.expires_at);
  const created = battle.created_at ? new Date(battle.created_at).getTime() : Date.now();
  return new Date(created + 24 * 60 * 60 * 1000);
}

export function getBattleUiStatus(battle: {
  status?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  scheduled_start_at?: string | null;
  battle_background?: string | null;
  opponent_media_url?: string | null;
  opponent_cover_url?: string | null;
  opponent_id?: string | null;
  media_type?: string | null;
}): BattleUiStatus {
  const expiresAt = getBattleExpiresAt(battle);
  const msLeft = expiresAt.getTime() - Date.now();
  const timeEnded = msLeft <= 0;
  const status = (battle.status || "").toLowerCase();

  if (
    timeEnded ||
    status === "ended" ||
    status === "completed" ||
    status === "expired"
  ) {
    return "ended";
  }

  if (status === "open" && !battle.opponent_id) return "open";
  if (status === "pending") return "waiting";

  // Active once opponent has uploaded an entry (media and/or cover for photo/live battles)
  const hasOpponentEntry = !!(battle.opponent_media_url || battle.opponent_cover_url);
  if (status === "active" && !hasOpponentEntry) return "waiting";

  const startIso = getBattleScheduledStartAt(battle);
  const startAt = startIso ? new Date(startIso).getTime() : null;
  if (status === "active" && startAt != null && Date.now() < startAt) return "countdown";

  if (status === "active" && msLeft > 0 && msLeft <= 15 * 60 * 1000) return "ending";
  if (status === "active") return "live";

  return "waiting";
}

/** Battles that should appear in the homepage Posts feed after launch/accept. */
export function isBattleOnFeed(battle: {
  status?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  scheduled_start_at?: string | null;
  battle_background?: string | null;
  opponent_media_url?: string | null;
  opponent_cover_url?: string | null;
  opponent_id?: string | null;
  media_type?: string | null;
}): boolean {
  const ui = getBattleUiStatus(battle);
  return ui === "live" || ui === "ending" || ui === "countdown";
}

export function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return "Ended";
  const h = Math.floor(msLeft / 3600000);
  const m = Math.floor((msLeft % 3600000) / 60000);
  const s = Math.floor((msLeft % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export function firstName(name?: string | null, fallback = "Artist"): string {
  const n = (name || "").trim();
  if (!n) return fallback;
  return n.split(/\s+/)[0] || fallback;
}

export function crowdLeanText(
  leftName: string,
  rightName: string,
  leftPct: number,
  rightPct: number,
  totalVotes: number,
): string {
  if (totalVotes === 0) return "Crowd is warming up — cast the first vote";
  if (leftPct === rightPct) return "Crowd is split down the middle";
  const leader = leftPct > rightPct ? leftName : rightName;
  const lead = Math.abs(leftPct - rightPct);
  if (lead >= 20) return `Crowd is leaning hard toward ${leader}`;
  return `Crowd is leaning toward ${leader}`;
}

export type VoteMomentum = {
  leftGain: number;
  rightGain: number;
  label: string;
  trending: "left" | "right" | "tied" | "none";
};

/** True when a participant cast a vote for their own side (never allowed). */
export function isSelfBattleVote(
  vote: { voted_for?: string | null; user_id?: string | null },
  challengerId?: string | null,
  opponentId?: string | null,
): boolean {
  if (!vote.user_id || !vote.voted_for) return false;
  if (vote.user_id === challengerId && vote.voted_for === challengerId) return true;
  if (opponentId && vote.user_id === opponentId && vote.voted_for === opponentId) return true;
  return false;
}

/** Votes that count toward the score — includes cross-votes from participants. */
export function isCountableBattleVote(
  vote: { voted_for?: string | null; user_id?: string | null },
  challengerId?: string | null,
  opponentId?: string | null,
): boolean {
  if (!vote.user_id || !vote.voted_for) return false;
  return !isSelfBattleVote(vote, challengerId, opponentId);
}

export type BattleVoteTally = {
  leftVotes: number;
  rightVotes: number;
  total: number;
  leftPct: number;
  rightPct: number;
  winner: "left" | "right" | "tied" | null;
  countable: Array<{ voted_for?: string | null; user_id?: string | null; created_at?: string | null }>;
};

export function tallyBattleVotes(
  votes: Array<{ voted_for?: string | null; user_id?: string | null; created_at?: string | null }>,
  challengerId?: string | null,
  opponentId?: string | null,
): BattleVoteTally {
  const countable = votes.filter((v) => isCountableBattleVote(v, challengerId, opponentId));
  const leftVotes = challengerId ? countable.filter((v) => v.voted_for === challengerId).length : 0;
  const rightVotes = opponentId ? countable.filter((v) => v.voted_for === opponentId).length : 0;
  const total = leftVotes + rightVotes;
  const leftPct = total > 0 ? Math.round((leftVotes / total) * 100) : 50;
  const rightPct = total > 0 ? 100 - leftPct : 50;
  const winner =
    total === 0 ? null : leftVotes > rightVotes ? "left" : leftVotes < rightVotes ? "right" : "tied";
  return { leftVotes, rightVotes, total, leftPct, rightPct, winner, countable };
}

/** Participants may vote for the other side only — never themselves. */
export function canUserVoteForSide(
  userId: string | null | undefined,
  sideUserId: string | null | undefined,
  opts?: { ended?: boolean; votingOpen?: boolean },
): { allowed: boolean; reason?: string } {
  if (!userId) return { allowed: false, reason: "Sign in to vote" };
  if (opts?.ended) return { allowed: false, reason: "Voting closed — battle ended" };
  if (opts?.votingOpen === false) {
    return { allowed: false, reason: "Voting opens when both artists join" };
  }
  if (!sideUserId) return { allowed: false, reason: "Waiting for opponent" };
  if (userId === sideUserId) return { allowed: false, reason: "You can't vote for yourself" };
  return { allowed: true };
}

/** Recent vote surge from battle_votes.created_at — UI-only trend signal. */
export function computeVoteMomentum(
  votes: Array<{ voted_for?: string | null; created_at?: string | null; user_id?: string | null }>,
  leftId?: string | null,
  rightId?: string | null,
  _participantIds: string[] = [],
  windowMs = 60_000,
): VoteMomentum {
  if (!leftId && !rightId) {
    return { leftGain: 0, rightGain: 0, label: "Waiting for votes", trending: "none" };
  }
  const cutoff = Date.now() - windowMs;
  const recent = votes.filter((v) => {
    if (!v.created_at) return false;
    if (!isCountableBattleVote(v, leftId, rightId)) return false;
    return new Date(v.created_at).getTime() >= cutoff;
  });
  const leftGain = leftId ? recent.filter((v) => v.voted_for === leftId).length : 0;
  const rightGain = rightId ? recent.filter((v) => v.voted_for === rightId).length : 0;

  if (leftGain === 0 && rightGain === 0) {
    return { leftGain, rightGain, label: "Momentum building…", trending: "none" };
  }
  if (leftGain === rightGain) {
    return {
      leftGain,
      rightGain,
      label: `Both sides surged +${leftGain} in the last minute`,
      trending: "tied",
    };
  }
  if (leftGain > rightGain) {
    return {
      leftGain,
      rightGain,
      label: `🔥 Hot streak · +${leftGain} votes in the last minute`,
      trending: "left",
    };
  }
  return {
    leftGain,
    rightGain,
    label: `⚡ Comeback watch · +${rightGain} votes in the last minute`,
    trending: "right",
  };
}

/** Display-only ranking reward for the winner ceremony (not persisted). */
export function rankingPointsForWin(winnerPct: number, totalVotes: number, tied = false): number {
  if (tied || totalVotes <= 0) return 0;
  const margin = Math.max(0, winnerPct - (100 - winnerPct));
  return Math.round(12 + margin * 0.4 + Math.min(25, totalVotes / 40));
}

export function formatClockMmSs(msLeft: number): string {
  if (msLeft <= 0) return "00:00";
  const m = Math.floor(msLeft / 60000);
  const s = Math.floor((msLeft % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type BattleFeedSectionId =
  | "trending"
  | "ending_soon"
  | "new"
  | "finished"
  | "music"
  | "video"
  | "photo";

export function partitionBattleFeed<T extends {
  id: string;
  status?: string | null;
  media_type?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  opponent_media_url?: string | null;
  opponent_id?: string | null;
  views?: number | null;
  likes_count?: number | null;
}>(
  battles: T[],
  voteTotals: Record<string, number> = {},
): { id: BattleFeedSectionId; title: string; items: T[] }[] {
  const now = Date.now();

  const score = (b: T) =>
    (voteTotals[b.id] || 0) * 3 + (b.likes_count || 0) * 2 + (b.views || 0);

  const withStatus = battles.map((b) => ({ b, ui: getBattleUiStatus(b) }));

  const live = withStatus.filter(({ ui }) => ui === "live" || ui === "ending").map(({ b }) => b);
  const endingSoon = [...live]
    .filter((b) => {
      const left = getBattleExpiresAt(b).getTime() - now;
      return left > 0 && left <= 2 * 60 * 60 * 1000;
    })
    .sort((a, b) => getBattleExpiresAt(a).getTime() - getBattleExpiresAt(b).getTime());

  const trending = [...live].sort((a, b) => score(b) - score(a)).slice(0, 12);

  const newest = [...battles]
    .filter((b) => {
      const ui = getBattleUiStatus(b);
      return ui !== "ended";
    })
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
    )
    .slice(0, 12);

  const finished = battles
    .filter((b) => getBattleUiStatus(b) === "ended")
    .sort(
      (a, b) =>
        getBattleExpiresAt(b).getTime() - getBattleExpiresAt(a).getTime(),
    )
    .slice(0, 12);

  const byMedia = (type: string) =>
    battles.filter((b) => (b.media_type || "audio").toLowerCase() === type).slice(0, 12);

  const sections: { id: BattleFeedSectionId; title: string; items: T[] }[] = [
    { id: "trending", title: "🔥 Trending Battles", items: trending },
    { id: "ending_soon", title: "⏰ Ending Soon", items: endingSoon },
    { id: "new", title: "🆕 New Battles", items: newest },
    { id: "finished", title: "🏆 Recently Finished", items: finished },
    { id: "music", title: "🎵 Music", items: byMedia("audio") },
    { id: "video", title: "🎥 Video", items: byMedia("video") },
    { id: "photo", title: "📸 Photos", items: byMedia("photo") },
  ];

  return sections.filter((s) => s.items.length > 0);
}
