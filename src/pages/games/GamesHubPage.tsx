import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bot, Loader2, Trophy, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import OpponentPickerSheet from "@/components/games/OpponentPickerSheet";
import {
  GAME_LABELS,
  GameInviteRow,
  GameRow,
  GameStatsRow,
  GameType,
  createMultiplayerGame,
  createSoloGame,
  getMyStats,
  leaderboard,
  listMyGames,
  listMyInvites,
  respondToInvite,
} from "@/lib/games";
import { EMPTY_BOARD } from "@/lib/tic-tac-toe";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type CardDef = {
  type: GameType;
  title: string;
  desc: string;
  difficulty: string;
  players: string;
  gradient: string;
  glyph: string;
  live: boolean;
  solo: boolean;
  multi: boolean;
  featured?: boolean;
};

const CARDS: CardDef[] = [
  {
    type: "dominoes",
    title: "Dominoes",
    desc: "The YAJ classic. Draw, block, win.",
    difficulty: "Medium",
    players: "2 players",
    gradient: "from-[hsl(215_45%_18%)] to-[hsl(215_60%_32%)]",
    glyph: "🁫",
    live: false,
    solo: true,
    multi: true,
    featured: true,
  },
  {
    type: "tic_tac_toe",
    title: "Tic-Tac-Toe",
    desc: "Fast rounds. Solo or challenge a friend.",
    difficulty: "Easy",
    players: "2 players",
    gradient: "from-[hsl(255_60%_30%)] to-[hsl(280_65%_45%)]",
    glyph: "✕◯",
    live: true,
    solo: true,
    multi: true,
    featured: true,
  },
  {
    type: "connect_four",
    title: "Connect Four",
    desc: "Drop, stack, line up four.",
    difficulty: "Easy",
    players: "2 players",
    gradient: "from-[hsl(200_70%_28%)] to-[hsl(190_70%_45%)]",
    glyph: "🔵🔴",
    live: false,
    solo: true,
    multi: true,
  },
  {
    type: "checkers",
    title: "Checkers",
    desc: "Captures, kings, comebacks.",
    difficulty: "Medium",
    players: "2 players",
    gradient: "from-[hsl(20_60%_28%)] to-[hsl(35_70%_45%)]",
    glyph: "⛃",
    live: false,
    solo: true,
    multi: true,
  },
  {
    type: "trivia",
    title: "Trivia Battle",
    desc: "Music, movies, sports & more.",
    difficulty: "Easy",
    players: "1–2 players",
    gradient: "from-[hsl(160_55%_25%)] to-[hsl(150_60%_40%)]",
    glyph: "❓",
    live: false,
    solo: true,
    multi: true,
  },
  {
    type: "yaj_dash",
    title: "YAJ Dash",
    desc: "Run, dodge, collect stars.",
    difficulty: "Easy",
    players: "Solo",
    gradient: "from-[hsl(300_55%_28%)] to-[hsl(330_70%_48%)]",
    glyph: "⭐",
    live: false,
    solo: true,
    multi: false,
  },
];

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-background/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground backdrop-blur-sm">
      {children}
    </span>
  );
}

export default function GamesHubPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invites, setInvites] = useState<GameInviteRow[]>([]);
  const [inviteNames, setInviteNames] = useState<Record<string, string>>({});
  const [myGames, setMyGames] = useState<GameRow[]>([]);
  const [stats, setStats] = useState<GameStatsRow[]>([]);
  const [board, setBoard] = useState<GameStatsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerFor, setPickerFor] = useState<GameType | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const [inv, games, st, lb] = await Promise.all([
      listMyInvites(user.id),
      listMyGames(user.id),
      getMyStats(user.id),
      leaderboard(undefined, 10),
    ]);
    setInvites(inv);
    setMyGames(games);
    setStats(st);
    setBoard(lb);
    setLoading(false);

    const ids = Array.from(new Set([...inv.map((i) => i.from_user_id), ...lb.map((r) => r.user_id)]));
    if (ids.length) {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => (map[r.user_id] = r.display_name || "YAJ user"));
      setInviteNames(map);
    }
  };

  useEffect(() => {
    void refresh();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("games-hub")
      .on("postgres_changes", { event: "*", schema: "public", table: "game_invites" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, () => void refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const activeGames = useMemo(
    () => myGames.filter((g) => g.status === "active" || g.status === "waiting"),
    [myGames],
  );
  const recentGames = useMemo(() => myGames.filter((g) => g.status === "completed").slice(0, 6), [myGames]);
  const totals = useMemo(() => {
    return stats.reduce(
      (acc, s) => ({
        played: acc.played + s.games_played,
        wins: acc.wins + s.wins,
        losses: acc.losses + s.losses,
        streak: Math.max(acc.streak, s.current_streak),
        best: Math.max(acc.best, s.best_streak),
      }),
      { played: 0, wins: 0, losses: 0, streak: 0, best: 0 },
    );
  }, [stats]);

  const startSolo = async (type: GameType) => {
    if (!user) return navigate("/auth");
    if (type !== "tic_tac_toe") {
      toast({ title: `${GAME_LABELS[type]} is coming soon` });
      return;
    }
    setBusy(true);
    try {
      const game = await createSoloGame(type, user.id, { board: EMPTY_BOARD, moveNumber: 0 });
      navigate(`/games/tic-tac-toe/${game.id}`);
    } catch (e: any) {
      toast({ title: "Could not start the game", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const startMulti = (type: GameType) => {
    if (!user) return navigate("/auth");
    if (type !== "tic_tac_toe") {
      toast({ title: `${GAME_LABELS[type]} multiplayer is coming soon` });
      return;
    }
    setPickerFor(type);
  };

  const invitePlayer = async (opponentId: string, name: string) => {
    if (!user || !pickerFor) return;
    setBusy(true);
    try {
      const game = await createMultiplayerGame(pickerFor, user.id, opponentId, {
        board: EMPTY_BOARD,
        moveNumber: 0,
      });
      setPickerFor(null);
      toast({ title: `Challenge sent to ${name}` });
      navigate(`/games/tic-tac-toe/${game.id}`);
    } catch (e: any) {
      toast({ title: "Could not send the challenge", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const answerInvite = async (invite: GameInviteRow, accept: boolean) => {
    try {
      await respondToInvite(invite.id, accept);
      await refresh();
      if (accept && invite.game_id) navigate(`/games/tic-tac-toe/${invite.game_id}`);
    } catch (e: any) {
      toast({ title: "Could not respond", description: e.message, variant: "destructive" });
    }
  };

  const featured = CARDS.filter((c) => c.featured);

  const renderCard = (card: CardDef) => {
    const inProgress = activeGames.find((g) => g.game_type === card.type);
    return (
      <div
        key={card.type}
        className={`relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br ${card.gradient} p-4 text-primary-foreground shadow-[0_10px_28px_rgba(15,23,42,0.18)]`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-black tracking-tight">{card.title}</h3>
            <p className="mt-0.5 text-xs text-primary-foreground/80">{card.desc}</p>
          </div>
          <span className="text-2xl leading-none opacity-90">{card.glyph}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.solo && <Badge>Solo</Badge>}
          {card.multi && <Badge>Multiplayer</Badge>}
          <Badge>{card.difficulty}</Badge>
          <Badge>{card.players}</Badge>
          {!card.live && <Badge>Coming Soon</Badge>}
        </div>

        <div className="mt-4 flex gap-2">
          {inProgress ? (
            <button
              type="button"
              onClick={() => navigate(`/games/tic-tac-toe/${inProgress.id}`)}
              className="flex-1 rounded-full bg-background px-3 py-2 text-sm font-black text-foreground active:scale-[0.98]"
            >
              Continue
            </button>
          ) : (
            <>
              {card.solo && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => startSolo(card.type)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-background px-3 py-2 text-sm font-black text-foreground active:scale-[0.98] disabled:opacity-60"
                >
                  <Bot className="h-4 w-4" /> {card.live ? "Play Solo" : "Coming Soon"}
                </button>
              )}
              {card.multi && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => startMulti(card.type)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-background/50 px-3 py-2 text-sm font-black active:scale-[0.98] disabled:opacity-60"
                >
                  <Users className="h-4 w-4" /> {card.live ? "Invite" : "Coming Soon"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate("/explore")} aria-label="Back" className="rounded-full p-1.5 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-[22px] font-black tracking-tight">Games</h1>
            <p className="text-[11px] text-muted-foreground">Play solo or challenge your people</p>
          </div>
        </div>
      </header>

      <main className="space-y-6 px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {invites.length > 0 && (
              <section>
                <h2 className="mb-2 text-[13px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                  Challenges
                </h2>
                <ul className="space-y-2">
                  {invites.map((inv) => (
                    <li key={inv.id} className="rounded-2xl border border-border bg-card p-3">
                      <p className="text-sm font-bold">
                        {inviteNames[inv.from_user_id] || "Someone"} challenged you to {GAME_LABELS[inv.game_type]}.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => answerInvite(inv, true)}
                          className="flex-1 rounded-full bg-primary px-3 py-2 text-sm font-black text-primary-foreground"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => answerInvite(inv, false)}
                          className="flex-1 rounded-full border border-border px-3 py-2 text-sm font-black"
                        >
                          Decline
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="mb-2 text-[13px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                Your Active Games
              </h2>
              {activeGames.length > 0 ? (
                <ul className="space-y-2">
                  {activeGames.map((g) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/games/tic-tac-toe/${g.id}`)}
                        className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-3 text-left"
                      >
                        <span className="text-sm font-bold">{GAME_LABELS[g.game_type]}</span>
                        <span className="text-xs font-bold text-primary">
                          {g.status === "waiting"
                            ? "Waiting for opponent"
                            : g.current_turn_user_id === user?.id
                              ? "Your turn"
                              : "Opponent's turn"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-center">
                  <p className="text-sm font-bold text-foreground">No active games yet</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Start a solo game or challenge a friend.</p>
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-2 text-[13px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                Featured Games
              </h2>
              <div className="space-y-3">{featured.map(renderCard)}</div>
            </section>

            <section>
              <h2 className="mb-2 text-[13px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                All Games
              </h2>
              <div className="space-y-3">{CARDS.filter((c) => !c.featured).map(renderCard)}</div>
            </section>

            <section>
              <h2 className="mb-2 text-[13px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                Your Stats
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Played", totals.played],
                  ["Wins", totals.wins],
                  ["Losses", totals.losses],
                  ["Win rate", totals.played ? `${Math.round((totals.wins / totals.played) * 100)}%` : "—"],
                  ["Streak", totals.streak],
                  ["Best", totals.best],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-2xl border border-border bg-card p-3 text-center">
                    <p className="text-lg font-black">{value as any}</p>
                    <p className="text-[11px] text-muted-foreground">{label as string}</p>
                  </div>
                ))}
              </div>
            </section>

            {recentGames.length > 0 && (
              <section>
                <h2 className="mb-2 text-[13px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                  Recently Played
                </h2>
                <ul className="space-y-2">
                  {recentGames.map((g) => (
                    <li key={g.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
                      <span className="text-sm font-bold">{GAME_LABELS[g.game_type]}</span>
                      <span className="text-xs font-bold text-muted-foreground">
                        {g.is_draw ? "Draw" : g.winner_user_id === user?.id ? "You won" : "You lost"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <div className="mb-2 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <h2 className="text-[13px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                  Leaderboard · All-Time XP
                </h2>
              </div>
              {board.length ? (
                <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  {board.map((row, i) => (
                    <li key={`${row.user_id}-${row.game_type}`} className="flex items-center gap-3 p-3">
                      <span className="w-5 text-sm font-black text-muted-foreground">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">
                        {inviteNames[row.user_id] || (row.user_id === user?.id ? "You" : "YAJ player")}
                      </span>
                      <span className="text-xs font-bold text-primary">{row.xp} XP</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  Play a game to get on the board.
                </p>
              )}
            </section>
          </>
        )}
      </main>

      <OpponentPickerSheet
        open={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        onPick={(p) => invitePlayer(p.user_id, p.display_name || "your opponent")}
        title={pickerFor ? `Challenge to ${GAME_LABELS[pickerFor]}` : "Choose an opponent"}
      />
    </div>
  );
}
