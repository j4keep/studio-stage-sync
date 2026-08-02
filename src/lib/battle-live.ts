/** Helpers for LiveKit-powered live debate battles. */

export function battleLiveRoomId(battleId: string): string {
  return `battle-${battleId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100)}`;
}

export type LiveBattlePhase = "waiting" | "countdown" | "live" | "ended";

type LiveMeta = {
  scheduled_start_at?: string | null;
  replay_media_url?: string | null;
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
      replay_media_url: live.replay_media_url ? String(live.replay_media_url) : null,
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

export function getLiveBattlePhase(battle: BattleLiveFields, now = Date.now()): LiveBattlePhase {
  if ((battle.media_type || "").toLowerCase() !== "live") return "waiting";

  const status = (battle.status || "").toLowerCase();
  const expiresAt = battle.expires_at
    ? new Date(battle.expires_at).getTime()
    : battle.created_at
      ? new Date(battle.created_at).getTime() + 24 * 60 * 60 * 1000
      : now;
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
  if (startAt != null && now < startAt) return "countdown";
  return "live";
}

export function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function defaultLiveStartLocal(): string {
  return toDatetimeLocalValue(new Date(Date.now() + 10 * 60 * 1000));
}

export const LIVE_BATTLE_DURATIONS_MIN = [10, 15, 30, 45, 60] as const;

/** True when PostgREST error is the missing live-battle columns schema cache miss. */
export function isMissingLiveBattleColumnError(err: { message?: string } | null | undefined): boolean {
  const msg = (err?.message || "").toLowerCase();
  return (
    msg.includes("scheduled_start_at") ||
    msg.includes("replay_media_url")
  ) && (msg.includes("schema cache") || msg.includes("could not find"));
}
