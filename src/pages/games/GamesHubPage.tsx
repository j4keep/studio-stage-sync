import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, Loader2, Sparkles, Trophy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  GAME_LABELS,
  GameInviteRow,
  GameRow,
  GameStatsRow,
  GameType,
  createSoloGame,
  getMyStats,
  leaderboard,
  listMyGames,
  listMyInvites,
  respondToInvite,
} from "@/lib/games";
import { gameRoute, initialStateFor } from "@/lib/game-routes";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import dominoesArt from "@/assets/games/dominoes.jpg";
import tttArt from "@/assets/games/tic-tac-toe.jpg";
import connectFourArt from "@/assets/games/connect-four.jpg";
import checkersArt from "@/assets/games/checkers.jpg";
import triviaArt from "@/assets/games/trivia.jpg";
import dashArt from "@/assets/games/yaj-dash.jpg";
import poolArtAsset from "@/assets/games/yaj-billiards-intro.png.asset.json";
const poolArt = poolArtAsset.url;
import boxingArt from "@/assets/games/boxing.svg";
import battleshipArt from "@/assets/games/battleship.svg";
import drivingArt from "@/assets/games/driving.svg";
import pokerArt from "@/assets/games/poker.svg";
import popShotArt from "@/assets/games/pop-shot.svg";
import knockHockeyArt from "@/assets/games/knock-hockey.svg";
import bingoArt from "@/assets/games/bingo.svg";
import wordLinkArt from "@/assets/games/word-link.svg";
import miniGolfArt from "@/assets/games/mini-golf.svg";
import snakeRoyaleArt from "@/assets/games/snake-royale.svg";
import obbyArt from "@/assets/games/yaj-obby-intro.png";

type Category = "Board" | "Strategy" | "Action" | "Sports" | "Arcade" | "Puzzle" | "Card" | "Adventure";

type CardDef = {
  type: GameType;
  title: string;
  players: string;
  image: string;
  category: Category;
  isNew?: boolean;
};

const CARDS: CardDef[] = [
  { type: "pool", title: "8-Ball Pool", players: "2 players", image: poolArt, category: "Sports" },
  { type: "boxing", title: "Boxing", players: "2 players", image: boxingArt, category: "Action" },
  { type: "battleship", title: "Battleship", players: "2 players", image: battleshipArt, category: "Strategy", isNew: true },
  { type: "driving", title: "Drive", players: "2 players", image: drivingArt, category: "Arcade", isNew: true },
  { type: "poker", title: "Texas Hold'em", players: "2 players", image: pokerArt, category: "Card", isNew: true },
  { type: "pop_shot", title: "Pop Shot", players: "2 players", image: popShotArt, category: "Arcade", isNew: true },
  { type: "knock_hockey", title: "Knock Hockey", players: "2 players", image: knockHockeyArt, category: "Arcade", isNew: true },
  { type: "bingo", title: "Bingo", players: "2 players", image: bingoArt, category: "Board", isNew: true },
  { type: "word_link", title: "Word Link", players: "2 players", image: wordLinkArt, category: "Puzzle", isNew: true },
  { type: "mini_golf", title: "Mini Golf", players: "2 players", image: miniGolfArt, category: "Sports", isNew: true },
  { type: "snake_royale", title: "Snake Royale", players: "2 players", image: snakeRoyaleArt, category: "Arcade", isNew: true },
  { type: "obby", title: "YAJ Obby", players: "2 players", image: obbyArt, category: "Adventure", isNew: true },
  { type: "dominoes", title: "Dominoes", players: "2 players", image: dominoesArt, category: "Board" },
  { type: "tic_tac_toe", title: "Tic-Tac-Toe", players: "2 players", image: tttArt, category: "Board" },
  { type: "connect_four", title: "Connect Four", players: "2 players", image: connectFourArt, category: "Board" },
  { type: "checkers", title: "Checkers", players: "2 players", image: checkersArt, category: "Board" },
  { type: "trivia", title: "Trivia Battle", players: "1–2 players", image: triviaArt, category: "Puzzle" },
  { type: "yaj_dash", title: "YAJ Dash", players: "Solo", image: dashArt, category: "Arcade" },
];

const CATEGORIES: Category[] = ["Board", "Strategy", "Action", "Sports", "Arcade", "Puzzle", "Card", "Adventure"];

/** YAJ Adventures — the original-IP adventure line-up. The rest are planned titles that
 *  reuse the same movement/collision/score/power-up systems. */
const ADVENTURE_TYPES: GameType[] = ["obby"];
const ADVENTURE_CARDS: CardDef[] = ADVENTURE_TYPES.map((t) => CARDS.find((c) => c.type === t)!).filter(Boolean);

const ADVENTURES_COMING_SOON = [
  { title: "YAJ Treasure Rush", blurb: "Grab the treasure before the timer runs out" },
  { title: "YAJ Tower Escape", blurb: "Climb the tower, hit every checkpoint" },
  { title: "YAJ Survival Island", blurb: "Outlast the hazards for three minutes" },
  { title: "YAJ Neighborhood", blurb: "Explore the block and finish missions" },
];


export default function GamesHubPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invites, setInvites] = useState<GameInviteRow[]>([]);
  const [inviteNames, setInviteNames] = useState<Record<string, string>>({});
  const [myGames, setMyGames] = useState<GameRow[]>([]);
  const [stats, setStats] = useState<GameStatsRow[]>([]);
  const [board, setBoard] = useState<GameStatsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Category | "All">("All");
  const [activityOpen, setActivityOpen] = useState(false);

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

  /** Tapping a card either resumes an in-progress game or drops you straight into that
   *  game's own intro screen (solo / quick match / stats all live there already). */
  const openCard = async (card: CardDef) => {
    if (!user) return navigate("/auth");
    const inProgress = activeGames.find((g) => g.game_type === card.type);
    if (inProgress) {
      navigate(gameRoute(inProgress.game_type, inProgress.id));
      return;
    }
    if (card.type === "yaj_dash") {
      navigate(gameRoute("yaj_dash"));
      return;
    }
    setBusy(true);
    try {
      const game = await createSoloGame(card.type, user.id, initialStateFor(card.type));
      navigate(gameRoute(card.type, game.id));
    } catch (e: any) {
      toast({ title: "Could not open the game", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const answerInvite = async (invite: GameInviteRow, accept: boolean) => {
    try {
      await respondToInvite(invite.id, accept);
      await refresh();
      if (accept && invite.game_id) navigate(gameRoute(invite.game_type, invite.game_id));
    } catch (e: any) {
      toast({ title: "Could not respond", description: e.message, variant: "destructive" });
    }
  };

  const visibleCards = filter === "All" ? CARDS : CARDS.filter((c) => c.category === filter);

  const renderCard = (card: CardDef) => {
    const inProgress = activeGames.find((g) => g.game_type === card.type);
    return (
      <button
        key={card.type}
        type="button"
        disabled={busy}
        onClick={() => void openCard(card)}
        className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 text-left shadow-[0_10px_28px_rgba(0,0,0,0.35)] transition active:scale-[0.97] disabled:opacity-60"
      >
        <img
          src={card.image}
          alt={`${card.title} artwork`}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-active:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/25 to-black/10" />

        {card.isNew && (
          <span className="absolute left-[-34px] top-3 w-[130px] -rotate-45 bg-primary py-0.5 text-center text-[9px] font-black uppercase tracking-widest text-primary-foreground shadow">
            New
          </span>
        )}

        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
        </span>

        {inProgress && (
          <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-primary-foreground">
            Continue
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 p-3">
          <p
            className="text-xl font-black italic uppercase leading-[0.95] tracking-tight text-white"
            style={{ textShadow: "0 2px 0 rgba(0,0,0,0.55), 0 6px 16px rgba(0,0,0,0.7)" }}
          >
            {card.title}
          </p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-white/60">{card.players}</p>
        </div>
      </button>
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
            <p className="text-[11px] text-muted-foreground">Tap a game to play solo, quick match, or check your record</p>
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
                <h2 className="mb-2 text-[13px] font-black uppercase tracking-[0.12em] text-muted-foreground">Challenges</h2>
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

            {activeGames.length > 0 && (
              <section>
                <h2 className="mb-2 text-[13px] font-black uppercase tracking-[0.12em] text-muted-foreground">Your Active Games</h2>
                <ul className="space-y-2">
                  {activeGames.map((g) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => navigate(gameRoute(g.game_type, g.id))}
                        className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-3 text-left"
                      >
                        <span className="text-sm font-bold">{GAME_LABELS[g.game_type]}</span>
                        <span className="text-xs font-bold text-primary">
                          {g.status === "waiting" ? "Waiting for opponent" : g.current_turn_user_id === user?.id ? "Your turn" : "Opponent's turn"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* YAJ Adventures — original YAJ arcade/adventure titles, City Run first. */}
            <section>
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-[13px] font-black uppercase tracking-[0.12em] text-primary">YAJ Adventures</h2>
                  <p className="text-[11px] text-muted-foreground">Original YAJ worlds — run, climb, explore and survive</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                {ADVENTURE_CARDS.map(renderCard)}
                {ADVENTURES_COMING_SOON.map((a) => (
                  <div
                    key={a.title}
                    className="relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-2xl border border-dashed border-border bg-card p-3"
                  >
                    <span className="absolute right-2 top-2 rounded-full bg-muted px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-muted-foreground">
                      Soon
                    </span>
                    <p className="text-base font-black italic uppercase leading-[0.95] tracking-tight">{a.title}</p>
                    <p className="mt-1 text-[10px] font-bold text-muted-foreground">{a.blurb}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>

              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                {(["All", ...CATEGORIES] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFilter(c)}
                    className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-black transition"
                    style={
                      filter === c
                        ? { borderColor: "hsl(var(--primary))", background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
                        : { borderColor: "hsl(var(--border))", background: "transparent", color: "hsl(var(--muted-foreground))" }
                    }
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">{visibleCards.map(renderCard)}</div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border bg-card">
              <button
                type="button"
                onClick={() => setActivityOpen((o) => !o)}
                className="flex w-full items-center justify-between px-4 py-3"
              >
                <span className="flex items-center gap-2 text-[13px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                  <Trophy className="h-4 w-4 text-primary" /> Your Activity &amp; Stats
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${activityOpen ? "rotate-180" : ""}`} />
              </button>

              {activityOpen && (
                <div className="space-y-5 border-t border-border px-4 py-4">
                  <div>
                    <h3 className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">Your Stats</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ["Played", totals.played],
                        ["Wins", totals.wins],
                        ["Losses", totals.losses],
                        ["Win rate", totals.played ? `${Math.round((totals.wins / totals.played) * 100)}%` : "—"],
                        ["Streak", totals.streak],
                        ["Best", totals.best],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-xl border border-border bg-background p-2.5 text-center">
                          <p className="text-base font-black">{value as any}</p>
                          <p className="text-[10px] text-muted-foreground">{label as string}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {recentGames.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">Recently Played</h3>
                      <ul className="space-y-1.5">
                        {recentGames.map((g) => (
                          <li key={g.id} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2">
                            <span className="text-xs font-bold">{GAME_LABELS[g.game_type]}</span>
                            <span className="text-[11px] font-bold text-muted-foreground">
                              {g.is_draw ? "Draw" : g.winner_user_id === user?.id ? "You won" : "You lost"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5 text-primary" /> Leaderboard · All-Time XP
                    </h3>
                    {board.length ? (
                      <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
                        {board.map((row, i) => (
                          <li key={`${row.user_id}-${row.game_type}`} className="flex items-center gap-3 p-2.5">
                            <span className="w-5 text-sm font-black text-muted-foreground">{i + 1}</span>
                            <span className="min-w-0 flex-1 truncate text-xs font-bold">
                              {inviteNames[row.user_id] || (row.user_id === user?.id ? "You" : "YAJ player")}
                            </span>
                            <span className="text-xs font-bold text-primary">{row.xp} XP</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                        Play a game to get on the board.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
