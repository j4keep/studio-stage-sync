/** Helpers for LiveKit-powered live debate battles. */

export function battleLiveRoomId(battleId: string): string {
  return `battle-${battleId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100)}`;
}

export type LiveBattlePhase = "waiting" | "countdown" | "live" | "ended";

type LiveMeta = {
  scheduled_start_at?: string | null;
  expires_at?: string | null;
  replay_media_url?: string | null;
  duration_min?: number | null;
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
      expires_at: live.expires_at ? String(live.expires_at) : null,
      replay_media_url: live.replay_media_url ? String(live.replay_media_url) : null,
      duration_min:
        typeof live.duration_min === "number" && Number.isFinite(live.duration_min)
          ? live.duration_min
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

/** Prefer live meta expires_at (set on accept) over stale create-time +24h. */
export function getLiveBattleEndsAt(battle: {
  expires_at?: string | null;
  created_at?: string | null;
  battle_background?: string | null;
  max_duration_minutes?: number | null;
  scheduled_start_at?: string | null;
}): Date {
  const meta = parseLiveBattleMeta(battle.battle_background);
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

  if (battle.expires_at) {
    const exp = new Date(battle.expires_at);
    // If expires looks like the default create+24h trigger and we have a short duration, ignore it.
    if (battle.created_at && durationMin && durationMin <= 60) {
      const created = new Date(battle.created_at).getTime();
      const almostDay = Math.abs(exp.getTime() - (created + 24 * 60 * 60 * 1000)) < 2 * 60 * 1000;
      if (almostDay && startIso) {
        return new Date(new Date(startIso).getTime() + durationMin * 60 * 1000);
      }
    }
    return exp;
  }

  const created = battle.created_at ? new Date(battle.created_at).getTime() : Date.now();
  return new Date(created + 24 * 60 * 60 * 1000);
}

export function getLiveBattlePhase(battle: BattleLiveFields, now = Date.now()): LiveBattlePhase {
  if ((battle.media_type || "").toLowerCase() !== "live") return "waiting";

  const status = (battle.status || "").toLowerCase();
  const expiresAt = getLiveBattleEndsAt(battle).getTime();
  const startIso = getBattleScheduledStartAt(battle);
  const startAt = startIso ? new Date(startIso).getTime() : null;
  const hasOpponent =
    !!(battle.opponent_cover_url || battle.opponent_media_url);

  if (
    status === "ended" ||
    status === "completed" ||
    status === "expired" ||
    now >= expiresAt
  ) {
    return "ended";
  }

  if (status !== "active" || !hasOpponent) return "waiting";
  // No start stamp yet → treat as countdown shell (covers) rather than jumping to live.
  if (startAt == null) return "countdown";
  if (now < startAt) return "countdown";
  return "live";
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

/** Start + end timestamps once the opponent accepts. */
export function liveScheduleFromAccept(durationMin: number, now = Date.now()) {
  const mins = Math.max(1, durationMin || 10);
  const startMs = now + LIVE_PRACTICE_COUNTDOWN_SEC * 1000;
  const endMs = startMs + mins * 60 * 1000;
  return {
    scheduledStartAt: new Date(startMs).toISOString(),
    expiresAt: new Date(endMs).toISOString(),
    durationMin: mins,
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
