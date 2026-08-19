import { supabase } from "@/integrations/supabase/client";

export type GameType = "tic_tac_toe" | "connect_four" | "dominoes" | "checkers" | "trivia" | "yaj_dash" | "pool" | "boxing" | "battleship" | "driving";
export type GameMode = "solo" | "multiplayer";
export type GameStatus = "waiting" | "active" | "completed" | "cancelled";

export type GameRow = {
  id: string;
  game_type: GameType;
  host_user_id: string;
  mode: GameMode;
  status: GameStatus;
  current_turn_user_id: string | null;
  game_state: any;
  winner_user_id: string | null;
  is_draw: boolean;
  is_live?: boolean;
  live_started_at?: string | null;
  live_ended_at?: string | null;
  live_title?: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

export type GamePlayerRow = {
  id: string;
  game_id: string;
  user_id: string | null;
  is_computer: boolean;
  seat: number;
  symbol: string | null;
  result: string | null;
};

export type GameInviteRow = {
  id: string;
  game_id: string | null;
  game_type: GameType;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  message: string | null;
  created_at: string;
};

export type GameStatsRow = {
  user_id: string;
  game_type: GameType;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  current_streak: number;
  best_streak: number;
  xp: number;
  high_score: number;
  last_played_at: string | null;
};

const db = supabase as any;

export const GAME_LABELS: Record<GameType, string> = {
  tic_tac_toe: "Tic-Tac-Toe",
  connect_four: "Connect Four",
  dominoes: "Dominoes",
  checkers: "Checkers",
  trivia: "Trivia Battle",
  yaj_dash: "YAJ Dash",
  pool: "8-Ball Pool",
  boxing: "Boxing",
  battleship: "Battleship",
  driving: "Drive",
};

/** Create a solo game vs the computer. */
export async function createSoloGame(gameType: GameType, userId: string, initialState: any) {
  const { data: game, error } = await db.rpc("create_game", {
    p_game_type: gameType,
    p_mode: "solo",
    p_initial_state: initialState,
    p_opponent_id: null,
  });
  if (error) throw error;
  if (!game || game.host_user_id !== userId) throw new Error("The game could not be created securely.");
  return game as GameRow;
}

/** Create a multiplayer game and invite an opponent. */
export async function createMultiplayerGame(
  gameType: GameType,
  userId: string,
  opponentId: string,
  initialState: any,
) {
  const { data: game, error } = await db.rpc("create_game", {
    p_game_type: gameType,
    p_mode: "multiplayer",
    p_initial_state: initialState,
    p_opponent_id: opponentId,
  });
  if (error) throw error;
  if (!game || game.host_user_id !== userId) throw new Error("The challenge could not be created securely.");
  return game as GameRow;
}

export async function loadGame(gameId: string) {
  const [{ data: game }, { data: players }] = await Promise.all([
    db.from("games").select("*").eq("id", gameId).maybeSingle(),
    db.from("game_players").select("*").eq("game_id", gameId).order("seat"),
  ]);
  return { game: (game as GameRow) || null, players: (players as GamePlayerRow[]) || [] };
}

export async function recordMove(gameId: string, userId: string | null, moveNumber: number, move: any) {
  await db.from("game_moves").insert({ game_id: gameId, user_id: userId, move_number: moveNumber, move });
}

export async function updateGameState(
  gameId: string,
  patch: Partial<Pick<GameRow, "game_state" | "current_turn_user_id" | "status" | "winner_user_id" | "is_draw" | "finished_at">>,
) {
  const { error } = await db.from("games").update(patch).eq("id", gameId);
  if (error) throw error;
}

export async function respondToInvite(inviteId: string, accept: boolean) {
  const { data: invite, error } = await db
    .from("game_invites")
    .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
    .eq("id", inviteId)
    .select()
    .single();
  if (error) throw error;
  if (invite?.game_id) {
    await db.from("games").update(accept ? { status: "active" } : { status: "cancelled" }).eq("id", invite.game_id);
  }
  return invite as GameInviteRow;
}

export async function listMyInvites(userId: string) {
  const { data } = await db
    .from("game_invites")
    .select("*")
    .eq("to_user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data as GameInviteRow[]) || [];
}

export async function listMyGames(userId: string) {
  const { data: rows } = await db.from("game_players").select("game_id").eq("user_id", userId);
  const ids = ((rows as { game_id: string }[]) || []).map((r) => r.game_id);
  if (!ids.length) return [] as GameRow[];
  const { data } = await db
    .from("games")
    .select("*")
    .in("id", ids)
    .order("updated_at", { ascending: false })
    .limit(40);
  return (data as GameRow[]) || [];
}

export async function getMyStats(userId: string) {
  const { data } = await db.from("game_stats").select("*").eq("user_id", userId);
  return (data as GameStatsRow[]) || [];
}

/** Upsert stats after a finished game. */
export async function bumpStats(
  userId: string,
  gameType: GameType,
  outcome: "win" | "loss" | "draw",
  score?: number,
) {
  const { data: existing } = await db
    .from("game_stats")
    .select("*")
    .eq("user_id", userId)
    .eq("game_type", gameType)
    .maybeSingle();

  const prev = (existing as GameStatsRow) || null;
  const streak = outcome === "win" ? (prev?.current_streak ?? 0) + 1 : 0;
  const payload = {
    user_id: userId,
    game_type: gameType,
    games_played: (prev?.games_played ?? 0) + 1,
    wins: (prev?.wins ?? 0) + (outcome === "win" ? 1 : 0),
    losses: (prev?.losses ?? 0) + (outcome === "loss" ? 1 : 0),
    draws: (prev?.draws ?? 0) + (outcome === "draw" ? 1 : 0),
    current_streak: streak,
    best_streak: Math.max(prev?.best_streak ?? 0, streak),
    xp: (prev?.xp ?? 0) + (outcome === "win" ? 25 : outcome === "draw" ? 10 : 5),
    high_score: Math.max(prev?.high_score ?? 0, score ?? 0),
    last_played_at: new Date().toISOString(),
  };

  if (prev) {
    await db.from("game_stats").update(payload).eq("user_id", userId).eq("game_type", gameType);
  } else {
    await db.from("game_stats").insert(payload);
  }
  return payload;
}

export async function leaderboard(gameType?: GameType, limit = 20) {
  let q = db.from("game_stats").select("*").order("xp", { ascending: false }).limit(limit);
  if (gameType) q = q.eq("game_type", gameType);
  const { data } = await q;
  return (data as GameStatsRow[]) || [];
}

export function badgesForStats(s: GameStatsRow | undefined) {
  if (!s) return [] as string[];
  const out: string[] = [];
  if (s.wins >= 1) out.push("First Win");
  if (s.wins >= 5) out.push("5 Wins");
  if (s.wins >= 10) out.push("10 Wins");
  if (s.best_streak >= 3) out.push("Hot Streak");
  return out;
}
