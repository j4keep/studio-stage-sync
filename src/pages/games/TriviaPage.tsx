import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import GameShell from "@/components/games/GameShell";
import { useTurnGame } from "@/hooks/use-turn-game";
import { TRIVIA_BANK, TRIVIA_ROUND, computerAnswer, pickQuestions } from "@/lib/trivia";
import { bumpStats, createMultiplayerGame, createSoloGame, recordMove, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

export default function TriviaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(id, user?.id);
  const [picked, setPicked] = useState<number | null>(null);
  const written = useRef<string | null>(null);

  const questions: number[] = game?.game_state?.questions || [];
  const i: number = game?.game_state?.i ?? 0;
  const scores: number[] = game?.game_state?.scores || [0, 0];
  const moveNumber: number = game?.game_state?.moveNumber ?? 0;
  const mySeat: 0 | 1 = ((me?.seat ?? 1) === 1 ? 0 : 1) as 0 | 1;
  const oppSeat: 0 | 1 = mySeat === 0 ? 1 : 0;
  const finished = questions.length > 0 && i >= questions.length;
  const myTurn = game?.status === "active" && game.current_turn_user_id === user?.id && !finished;
  const question = !finished && questions.length ? TRIVIA_BANK[questions[i]] : null;

  useEffect(() => {
    if (!game || !user || !finished || written.current === game.id) return;
    written.current = game.id;
    if (game.status === "completed") return;
    const mine = scores[mySeat] ?? 0;
    const theirs = scores[oppSeat] ?? 0;
    const draw = mine === theirs;
    void (async () => {
      await updateGameState(game.id, {
        status: "completed",
        is_draw: draw,
        winner_user_id: draw ? null : mine > theirs ? user.id : (opponent?.user_id ?? null),
        finished_at: new Date().toISOString(),
      });
      await bumpStats(user.id, "trivia", draw ? "draw" : mine > theirs ? "win" : "loss", mine);
      await refresh();
    })();
  }, [finished, game?.id, game?.status]);

  const answer = async (option: number) => {
    if (!game || !user || !myTurn || picked !== null) return;
    setPicked(option);
    const correct = question?.a === option;
    const nextScores = [...scores];
    if (correct) nextScores[mySeat] = (nextScores[mySeat] ?? 0) + 1;

    let nextI = i;
    let n = moveNumber + 1;
    let nextTurn = opponent?.user_id ?? null;
    await recordMove(game.id, user.id, n, { q: questions[i], option, correct });

    if (game.mode === "solo") {
      const cpu = computerAnswer(questions[i]);
      if (cpu === TRIVIA_BANK[questions[i]].a) nextScores[oppSeat] = (nextScores[oppSeat] ?? 0) + 1;
      n += 1;
      nextI = i + 1;
      nextTurn = user.id;
    } else {
      // Both players answer the same question; advance once the second answer lands.
      const answered = (game.game_state?.answered as number[]) || [];
      if (answered.includes(oppSeat)) nextI = i + 1;
    }

    setTimeout(async () => {
      setPicked(null);
      const state: any = { questions, i: nextI, scores: nextScores, moveNumber: n };
      if (game.mode !== "solo") {
        const answered = ((game.game_state?.answered as number[]) || []).includes(oppSeat) ? [] : [mySeat];
        state.answered = answered;
      }
      setGame({ ...game, game_state: state, current_turn_user_id: nextTurn });
      await updateGameState(game.id, { game_state: state, current_turn_user_id: nextTurn });
      await refresh();
    }, 700);
  };

  const newState = () => ({ questions: pickQuestions(TRIVIA_ROUND), i: 0, scores: [0, 0], moveNumber: 0 });

  const rematch = async () => {
    if (!user || !game) return;
    try {
      const g =
        game.mode === "solo"
          ? await createSoloGame("trivia", user.id, newState())
          : opponent?.user_id
            ? await createMultiplayerGame("trivia", user.id, opponent.user_id, newState())
            : null;
      if (g) navigate(gameRoute("trivia", g.id), { replace: true });
    } catch (e: any) {
      toast({ title: "Could not start a rematch", description: e.message, variant: "destructive" });
    }
  };

  const challenge = async (opponentId: string, name: string) => {
    if (!user) return;
    try {
      const g = await createMultiplayerGame("trivia", user.id, opponentId, newState());
      toast({ title: `Challenge sent to ${name}` });
      navigate(gameRoute("trivia", g.id), { replace: true });
    } catch (e: any) {
      toast({ title: "Could not send the challenge", description: e.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!game) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="font-bold">This game is no longer available.</p>
        <button type="button" onClick={() => navigate("/games")} className="rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
          Back to Games
        </button>
      </div>
    );
  }

  const mine = scores[mySeat] ?? 0;
  const theirs = scores[oppSeat] ?? 0;
  const status = game.status === "waiting"
    ? `Waiting for ${opponentName} to accept`
    : game.status === "cancelled"
      ? "Challenge declined"
      : finished
        ? mine === theirs
          ? `Tie — ${mine} each`
          : mine > theirs
            ? `Victory — ${mine} to ${theirs}`
            : `${opponentName} wins — ${theirs} to ${mine}`
        : myTurn
          ? `Question ${i + 1} of ${questions.length}`
          : `${opponentName} is answering`;

  return (
    <GameShell
      title="Trivia Battle"
      subtitle={game.mode === "solo" ? "Solo vs Computer" : `You vs ${opponentName}`}
      status={status}
      finished={finished}
      shareText={`I scored ${mine}/${questions.length} in Trivia Battle on YAJ ❓`}
      onRematch={rematch}
      onChallenge={challenge}
      me={{ name: "You", meta: `${mine} correct` }}
      them={{
        name: opponentName,
        avatarUrl: opponentAvatar,
        isComputer: opponent?.is_computer ?? game.mode === "solo",
        meta: `${theirs} correct`,
      }}
      myTurn={myTurn}
      outcome={finished ? (mine === theirs ? "draw" : mine > theirs ? "win" : "loss") : undefined}
      resultTitle={mine === theirs ? "Dead heat" : mine > theirs ? "You win the round!" : `${opponentName} wins`}
      resultDetail={`Final score ${mine} — ${theirs}`}
    >
      <div className="mx-auto max-w-[420px]">
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3 text-sm font-black text-white">
          <span>You {mine}</span>
          <span className="text-white/45">vs</span>
          <span>
            {theirs} {opponentName}
          </span>
        </div>

        {question ? (
          <div
            key={i}
            className="mt-4 animate-fade-in rounded-2xl border border-white/10 p-4"
            style={{
              background: "linear-gradient(160deg, hsl(232 40% 16%), hsl(234 45% 10%))",
              boxShadow: "0 22px 44px -20px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary">{question.category}</p>
            <p className="mt-1 text-base font-black leading-snug text-white">{question.q}</p>
            <div className="mt-3 space-y-2">
              {question.options.map((opt, oi) => {
                const isPicked = picked === oi;
                const reveal = picked !== null;
                const correct = oi === question.a;
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={!myTurn || picked !== null}
                    onClick={() => answer(oi)}
                    className={`w-full rounded-xl border px-3 py-3 text-left text-sm font-bold text-white transition ${
                      reveal && correct
                        ? "border-emerald-400 bg-emerald-500/25"
                        : reveal && isPicked
                          ? "border-destructive bg-destructive/25"
                          : "border-white/12 bg-white/5 active:scale-[0.99] hover:border-primary/50"
                    } disabled:opacity-70`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-white/55">
            {finished ? "Round complete." : "Waiting for the next question…"}
          </p>
        )}
      </div>
    </GameShell>
  );
}

