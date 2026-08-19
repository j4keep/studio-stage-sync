import { supabase } from "@/integrations/supabase/client";
import { GAME_LABELS, GameType } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

const db = supabase as any;

/** LiveKit room used for the players' voice chat + spectator listen-in. */
export function gameLiveRoomId(gameId: string): string {
  return `game-${gameId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100)}`;
}

/** Realtime presence channel for viewer counts and heart bursts. */
export function gameLiveChannelId(gameId: string): string {
  return `game-live-${gameId}`;
}

export type LiveGameCard = {
  id: string;
  gameType: GameType;
  label: string;
  route: string;
  liveStartedAt: string | null;
  title: string | null;
  playerNames: string[];
  playerAvatars: (string | null)[];
};

export type GameLiveComment = {
  id: string;
  game_id: string;
  user_id: string;
  body: string;
  created_at: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

/** Flip a match on/off air. Only participants can do this (enforced by RLS). */
export async function setGameLive(gameId: string, live: boolean) {
  const patch = live
    ? { is_live: true, live_started_at: new Date().toISOString(), live_ended_at: null }
    : { is_live: false, live_ended_at: new Date().toISOString() };
  const { error } = await db.from("games").update(patch).eq("id", gameId);
  if (error) throw error;
}

/** Every match currently on air, newest first, with player names for the card. */
export async function listLiveGames(limit = 12): Promise<LiveGameCard[]> {
  const { data: games } = await db
    .from("games")
    .select("id, game_type, is_live, live_started_at, live_title, status")
    .eq("is_live", true)
    .order("live_started_at", { ascending: false })
    .limit(limit);

  const rows = (games as any[]) || [];
  if (!rows.length) return [];

  const { data: players } = await db
    .from("game_players")
    .select("game_id, user_id, is_computer, seat")
    .in(
      "game_id",
      rows.map((g) => g.id),
    )
    .order("seat");

  const playerRows = ((players as any[]) || []).filter((p) => !!p.user_id);
  const userIds = Array.from(new Set(playerRows.map((p) => p.user_id)));
  const profileMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();
  if (userIds.length) {
    const { data: profiles } = await db
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", userIds);
    ((profiles as any[]) || []).forEach((p) => profileMap.set(p.user_id, p));
  }

  return rows.map((g) => {
    const mine = ((players as any[]) || []).filter((p) => p.game_id === g.id);
    return {
      id: g.id,
      gameType: g.game_type as GameType,
      label: GAME_LABELS[g.game_type as GameType] || "Game",
      route: gameRoute(g.game_type as GameType, g.id),
      liveStartedAt: g.live_started_at ?? null,
      title: g.live_title ?? null,
      playerNames: mine.map((p) =>
        p.is_computer ? "Computer" : profileMap.get(p.user_id)?.display_name || "Player",
      ),
      playerAvatars: mine.map((p) => (p.is_computer ? null : profileMap.get(p.user_id)?.avatar_url || null)),
    };
  });
}

export async function fetchGameLiveComments(gameId: string, limit = 60): Promise<GameLiveComment[]> {
  const { data } = await db
    .from("game_live_comments")
    .select("*")
    .eq("game_id", gameId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = ((data as GameLiveComment[]) || []).slice().reverse();
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  if (!userIds.length) return rows;

  const { data: profiles } = await db
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", userIds);
  const map = new Map<string, any>();
  ((profiles as any[]) || []).forEach((p) => map.set(p.user_id, p));

  return rows.map((r) => ({
    ...r,
    display_name: map.get(r.user_id)?.display_name || "Viewer",
    avatar_url: map.get(r.user_id)?.avatar_url || null,
  }));
}

export async function postGameLiveComment(gameId: string, userId: string, body: string) {
  const text = body.trim().slice(0, 300);
  if (!text) return;
  const { error } = await db.from("game_live_comments").insert({ game_id: gameId, user_id: userId, body: text });
  if (error) throw error;
}
