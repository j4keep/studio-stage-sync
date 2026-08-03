/** Helpers for LiveKit-powered live debate battles. */

export function battleLiveRoomId(battleId: string): string {
  return `battle-${battleId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100)}`;
}

export type LiveBattlePhase = "waiting" | "countdown" | "live" | "ended";

type LiveMeta = {
  scheduled_start_at?: string | null;
  /** When cameras/recording stop (chosen debate length). */
  debate_ends_at?: string | null;
  /** @deprecated use debate_ends_at — kept for older rows */
  expires_at?: string | null;
  replay_media_url?: string | null;
  duration_min?: number | null;
  /** Voting window length in minutes (creator preset). */
  vote_window_minutes?: number | null;
};

type BattleLiveFields = {
  media_type?: string | null;
  status?: string | null;
  scheduled_start_at?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  opponent_cover_url?: string | null;
  opponent_media_url?: string | null;
  replay_media_url?: string | null;
  battle_background?: string | null;
  max_duration_minutes?: number | null;
};

/** Live schedule/replay stored in battle_background when DB columns are not yet migrated. */
export function parseLiveBattleMeta(battleBackground?: string | null): LiveMeta {
  if (!battleBackground) return {};
  try {
    const parsed = JSON.parse(battleBackground);
    if (!parsed || typeof parsed !== "object") return {};
    const live = (parsed as { live?: LiveMeta }).live;
    if (!live || typeof live !== "object") return {};
    return {
      scheduled_start_at: live.scheduled_start_at ? String(live.scheduled_start_at) : null,
      debate_ends_at: live.debate_ends_at
        ? String(live.debate_ends_at)
        : live.expires_at
          ? String(live.expires_at)
          : null,
      expires_at: live.expires_at ? String(live.expires_at) : null,
      replay_media_url: live.replay_media_url ? String(live.replay_media_url) : null,
      duration_min:
        typeof live.duration_min === "number" && Number.isFinite(live.duration_min)
          ? live.duration_min
          : null,
      vote_window_minutes:
        typeof live.vote_window_minutes === "number" && Number.isFinite(live.vote_window_minutes)
          ? live.vote_window_minutes
          : null,
    };
  } catch {
    return {};
  }
}

export function buildLiveBattleBackground(meta: LiveMeta, existingBackground?: string | null): string {
  let base: Record<string, unknown> = {};
  if (existingBackground) {
    try {
      const parsed = JSON.parse(existingBackground);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        base = { ...(parsed as Record<string, unknown>) };
      }
    } catch {
      base = {};
    }
  }
  const prev = (base.live && typeof base.live === "object" ? base.live : {}) as LiveMeta;
  base.live = {
    ...prev,
    ...meta,
  };
  return JSON.stringify(base);
}

export function getBattleScheduledStartAt(battle: {
  scheduled_start_at?: string | null;
  battle_background?: string | null;
}): string | null {
  if (battle.scheduled_start_at) return battle.scheduled_start_at;
  return parseLiveBattleMeta(battle.battle_background).scheduled_start_at || null;
}

export function getBattleReplayMediaUrl(battle: {
  replay_media_url?: string | null;
  battle_background?: string | null;
}): string | null {
  if (battle.replay_media_url) return battle.replay_media_url;
  return parseLiveBattleMeta(battle.battle_background).replay_media_url || null;
}

/**
 * When the FaceTime-style debate call stops (chosen length).
 * Independent from battles.expires_at (24h voting window).
 */
export function getLiveDebateEndsAt(battle: {
  expires_at?: string | null;
  created_at?: string | null;
  battle_background?: string | null;
  max_duration_minutes?: number | null;
  scheduled_start_at?: string | null;
}): Date {
  const meta = parseLiveBattleMeta(battle.battle_background);
  if (meta.debate_ends_at) return new Date(meta.debate_ends_at);
  // Older rows stored debate end as live.expires_at
  if (meta.expires_at) return new Date(meta.expires_at);

  const startIso = getBattleScheduledStartAt(battle);
  const durationMin =
    meta.duration_min ??
    (typeof battle.max_duration_minutes === "number" && battle.max_duration_minutes > 0
      ? battle.max_duration_minutes
      : null);

  if (startIso && durationMin) {
    return new Date(new Date(startIso).getTime() + durationMin * 60 * 1000);
  }

  // Fallback: if we only have DB expires_at and it looks like a short window, use it.
  if (battle.expires_at && startIso) {
    const exp = new Date(battle.expires_at).getTime();
    const start = new Date(startIso).getTime();
    if (exp > start && exp - start <= 3 * 60 * 60 * 1000) {
      return new Date(exp);
    }
  }

  // Last resort: 10 min debate
  const start = startIso ? new Date(startIso).getTime() : Date.now();
  return new Date(start + 10 * 60 * 1000);
}

/** @deprecated use getLiveDebateEndsAt */
export const getLiveBattleEndsAt = getLiveDebateEndsAt;

export function getLiveBattlePhase(battle: BattleLiveFields, now = Date.now()): LiveBattlePhase {
  if ((battle.media_type || "").toLowerCase() !== "live") return "waiting";

  const status = (battle.status || "").toLowerCase();
  const debateEndsAt = getLiveDebateEndsAt(battle).getTime();
  const startIso = getBattleScheduledStartAt(battle);
  const startAt = startIso ? new Date(startIso).getTime() : null;
  const hasOpponent =
    !!(battle.opponent_cover_url || battle.opponent_media_url);
  const hasReplay = !!getBattleReplayMediaUrl(battle);

  // Call is over once debate clock hits zero (voting may still be open for 24h).
  if (hasOpponent && startAt != null && now >= debateEndsAt) {
    return "ended";
  }
  if (hasReplay && (status === "completed" || status === "ended")) {
    return "ended";
  }

  if (status === "expired" && now >= debateEndsAt) return "ended";

  if (status !== "active" || !hasOpponent) {
    if (status === "pending") return "waiting";
    if (!hasOpponent) return "waiting";
  }

  if (status === "pending") return "waiting";
  // No start stamp yet → countdown shell (covers).
  if (startAt == null) return "countdown";
  if (now < startAt) return "countdown";
  if (now < debateEndsAt) return "live";
  return "ended";
}

export function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Practice pre-start countdown after both sides accept (seconds). */
export const LIVE_PRACTICE_COUNTDOWN_SEC = 30;

export function defaultLiveStartLocal(): string {
  return toDatetimeLocalValue(new Date(Date.now() + LIVE_PRACTICE_COUNTDOWN_SEC * 1000));
}

/** Creator presets for when voting closes (not free-form). */
export const BATTLE_VOTE_WINDOW_PRESETS = [
  { minutes: 15, label: "Flash Battle", emoji: "⚡", blurb: "15 minutes" },
  { minutes: 60, label: "Quick Battle", emoji: "🔥", blurb: "1 hour" },
  { minutes: 360, label: "Daily Challenge", emoji: "🌙", blurb: "6 hours" },
  { minutes: 1440, label: "Featured Battle", emoji: "⭐", blurb: "24 hours" },
] as const;

export const DEFAULT_VOTE_WINDOW_MINUTES = 1440;

export function normalizeVoteWindowMinutes(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_VOTE_WINDOW_MINUTES;
  const match = BATTLE_VOTE_WINDOW_PRESETS.find((p) => p.minutes === n);
  return match ? match.minutes : DEFAULT_VOTE_WINDOW_MINUTES;
}

export function getBattleVoteWindowMinutes(battle: {
  battle_background?: string | null;
}): number {
  const meta = parseLiveBattleMeta(battle.battle_background);
  return normalizeVoteWindowMinutes(meta.vote_window_minutes);
}

/**
 * On accept:
 * - debate starts after practice countdown
 * - debate ends after chosen length
 * - voting window uses creator preset (column expires_at)
 */
export function liveScheduleFromAccept(
  durationMin: number,
  now = Date.now(),
  voteWindowMin: number = DEFAULT_VOTE_WINDOW_MINUTES,
) {
  const mins = Math.max(1, durationMin || 10);
  const voteMins = normalizeVoteWindowMinutes(voteWindowMin);
  const startMs = now + LIVE_PRACTICE_COUNTDOWN_SEC * 1000;
  const debateEndMs = startMs + mins * 60 * 1000;
  const voteEndMs = now + voteMins * 60 * 1000;
  return {
    scheduledStartAt: new Date(startMs).toISOString(),
    debateEndsAt: new Date(debateEndMs).toISOString(),
    voteExpiresAt: new Date(voteEndMs).toISOString(),
    durationMin: mins,
    voteWindowMin: voteMins,
  };
}

export const LIVE_BATTLE_DURATIONS_MIN = [5, 10, 15, 30, 45, 60] as const;

/** True when PostgREST error is the missing live-battle columns schema cache miss. */
export function isMissingLiveBattleColumnError(err: { message?: string } | null | undefined): boolean {
  const msg = (err?.message || "").toLowerCase();
  return (
    msg.includes("scheduled_start_at") ||
    msg.includes("replay_media_url")
  ) && (msg.includes("schema cache") || msg.includes("could not find"));
}
