/** Helpers for LiveKit-powered live debate battles. */

export function battleLiveRoomId(battleId: string): string {
  return `battle-${battleId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100)}`;
}

export type LiveBattlePhase = "waiting" | "countdown" | "live" | "ended";

export function getLiveBattlePhase(
  battle: {
    media_type?: string | null;
    status?: string | null;
    scheduled_start_at?: string | null;
    expires_at?: string | null;
    created_at?: string | null;
    opponent_cover_url?: string | null;
    opponent_media_url?: string | null;
  },
  now = Date.now(),
): LiveBattlePhase {
  if ((battle.media_type || "").toLowerCase() !== "live") return "waiting";

  const status = (battle.status || "").toLowerCase();
  const expiresAt = battle.expires_at
    ? new Date(battle.expires_at).getTime()
    : battle.created_at
      ? new Date(battle.created_at).getTime() + 24 * 60 * 60 * 1000
      : now;
  const startAt = battle.scheduled_start_at
    ? new Date(battle.scheduled_start_at).getTime()
    : null;
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
