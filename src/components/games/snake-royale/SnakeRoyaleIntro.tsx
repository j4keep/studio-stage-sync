import { useEffect, useRef, useState } from "react";
import { ArrowLeft, HelpCircle, Play, Trophy, Volume2, VolumeX, X, Zap } from "lucide-react";
import { snakeRoyaleAmbienceStart, snakeRoyaleMuted, snakeRoyaleSetMuted, snakeRoyaleSfx } from "@/lib/snake-royale-sfx";
import { leaderboard } from "@/lib/games";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import "./snake-royale.css";

type Props = {
  bestScore?: number | null;
  solo: boolean;
  onSetSolo: (solo: boolean) => void;
  onPlay: () => void;
  onBack: () => void;
};

const LEAVES = [
  { top: "8%", left: "8%", size: 30, delay: 0 },
  { top: "14%", left: "80%", size: 24, delay: 0.6 },
  { top: "70%", left: "6%", size: 26, delay: 1.1 },
  { top: "76%", left: "84%", size: 22, delay: 0.3 },
  { top: "40%", left: "90%", size: 20, delay: 0.9 },
  { top: "34%", left: "3%", size: 20, delay: 1.4 },
];

const BUGS = Array.from({ length: 10 }, (_, i) => ({
  top: `${(i * 41) % 100}%`,
  left: `${(i * 57) % 100}%`,
  delay: (i % 6) * 0.3,
}));

/** A pair of glinting snake eyes peeking from bush silhouettes near the bottom of the
 *  intro — purely decorative and self-drawn, gives the ambient scene the "something is
 *  watching you from the grass" feel without a full character render. */
function BushEyes({ left, delay }: { left: string; delay: number }) {
  return (
    <div className="pointer-events-none absolute bottom-[6%] jr-bob" style={{ left, animationDelay: `${delay}s` }}>
      <div className="h-10 w-16 rounded-t-full" style={{ background: "#123a1f" }} />
      <div className="absolute left-[28%] top-[38%] flex gap-2">
        <span className="jr-blink h-1.5 w-1.5 rounded-full bg-amber-300" style={{ animationDelay: `${delay}s`, boxShadow: "0 0 6px #fbbf24" }} />
        <span className="jr-blink h-1.5 w-1.5 rounded-full bg-amber-300" style={{ animationDelay: `${delay}s`, boxShadow: "0 0 6px #fbbf24" }} />
      </div>
    </div>
  );
}

type LeaderRow = { user_id: string; score: number; xp: number; name: string };

/** Snake Royale's own full-screen intro — an animated jungle scene (drifting leaves,
 *  glowing fireflies, glinting eyes in the bushes) with Play / How to Play / Leaderboard,
 *  plus a Solo Mode (no timer) toggle. Audio unlocks on the first tap, matching every
 *  other bespoke intro in this codebase (mobile Safari blocks autoplay otherwise). */
export default function SnakeRoyaleIntro({ bestScore, solo, onSetSolo, onPlay, onBack }: Props) {
  const { user } = useAuth();
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaders, setLeaders] = useState<LeaderRow[] | null>(null);
  const [muted, setMuted] = useState(snakeRoyaleMuted());
  const unlockedRef = useRef(false);

  const unlockAudio = () => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    void snakeRoyaleSfx.unlock();
    if (!snakeRoyaleMuted()) snakeRoyaleAmbienceStart();
  };

  useEffect(() => {
    return () => {
      /* ambience is torn down by the stage once a run actually starts */
    };
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    snakeRoyaleSetMuted(next);
  };

  const openLeaderboard = () => {
    unlockAudio();
    setLeaderboardOpen(true);
    if (leaders) return;
    void (async () => {
      const rows = await leaderboard("snake_royale", 10);
      const ids = rows.map((r) => r.user_id);
      const { data: profiles } = ids.length
        ? await (supabase as any).from("profiles").select("user_id, display_name").in("user_id", ids)
        : { data: [] as any[] };
      const nameFor = (id: string) => profiles?.find((p: any) => p.user_id === id)?.display_name || "Player";
      setLeaders(rows.map((r) => ({ user_id: r.user_id, score: r.high_score, xp: r.xp, name: nameFor(r.user_id) })));
    })();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
      style={{ background: "radial-gradient(120% 80% at 50% 0%, #1c5a2e 0%, #123a1f 55%, #0a2213 100%)" }}
      onPointerDown={unlockAudio}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {LEAVES.map((f, i) => (
          <span
            key={i}
            className="jr-bob jr-drift absolute text-3xl opacity-90 drop-shadow-[0_6px_10px_rgba(0,0,0,.4)]"
            style={{ top: f.top, left: f.left, fontSize: f.size, animationDelay: `${f.delay}s` }}
          >
            🍃
          </span>
        ))}
        {BUGS.map((b, i) => (
          <span
            key={i}
            className="jr-twinkle absolute h-1.5 w-1.5 rounded-full bg-lime-300"
            style={{ top: b.top, left: b.left, animationDelay: `${b.delay}s`, boxShadow: "0 0 8px #bef264" }}
          />
        ))}
        <BushEyes left="14%" delay={0.4} />
        <BushEyes left="72%" delay={1.8} />
      </div>

      <div className="relative z-10 flex items-center justify-between px-4 pt-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <button type="button" onClick={onBack} aria-label="Back" className="rounded-full bg-black/30 p-2.5 text-white active:scale-95">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => {
            unlockAudio();
            toggleMute();
          }}
          aria-label={muted ? "Unmute" : "Mute"}
          className="rounded-full bg-black/30 p-2.5 text-white active:scale-95"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="jr-glow-title text-5xl font-black uppercase italic text-lime-200" style={{ WebkitTextStroke: "1.5px rgba(10,40,20,.6)" }}>
          Snake
        </p>
        <p className="jr-glow-title text-5xl font-black uppercase italic text-amber-300" style={{ WebkitTextStroke: "1.5px rgba(60,30,0,.6)" }}>
          Royale
        </p>
        <p className="mt-2 text-sm font-bold text-white/80">Escape the jungle. Survive the strike.</p>
        {typeof bestScore === "number" && bestScore > 0 && (
          <p className="text-[11px] font-black uppercase tracking-wide text-lime-200/90">Best score {bestScore.toLocaleString()}</p>
        )}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-3 px-6 pb-8" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>
        <button
          type="button"
          onClick={() => {
            unlockAudio();
            onPlay();
          }}
          className="jr-play-pulse flex h-20 w-20 items-center justify-center rounded-full text-white shadow-2xl active:scale-95"
          style={{ background: "radial-gradient(circle at 35% 30%, #a3e635, #4d9b2e 55%, #245c17 100%)" }}
          aria-label="Play"
        >
          <Play className="h-9 w-9 translate-x-0.5 fill-white" />
        </button>
        <p className="text-xs font-black uppercase tracking-widest text-white/90">Play</p>

        <button
          type="button"
          onClick={() => onSetSolo(!solo)}
          className="mt-1 flex items-center gap-2 rounded-full border border-white/25 bg-black/30 px-4 py-2 text-[11px] font-black text-white active:scale-95"
        >
          <Zap className={`h-3.5 w-3.5 ${solo ? "text-lime-300" : "text-white/50"}`} />
          Solo Mode — {solo ? "No Timer" : "Timed Run"}
        </button>

        <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              unlockAudio();
              setTutorialOpen(true);
            }}
            className="flex items-center justify-center gap-2 rounded-full border border-white/25 bg-black/30 px-4 py-2.5 text-xs font-black text-white active:scale-95"
          >
            <HelpCircle className="h-4 w-4" /> How to Play
          </button>
          <button
            type="button"
            onClick={openLeaderboard}
            className="flex items-center justify-center gap-2 rounded-full border border-white/25 bg-black/30 px-4 py-2.5 text-xs font-black text-white active:scale-95"
          >
            <Trophy className="h-4 w-4" /> Leaderboard
          </button>
        </div>
      </div>

      {tutorialOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 px-6" onClick={() => setTutorialOpen(false)}>
          <div
            className="w-full max-w-xs rounded-[26px] border-4 border-white/70 p-5"
            style={{ background: "linear-gradient(165deg, #1c5a2e, #123a1f)", boxShadow: "0 18px 40px rgba(0,0,0,.55)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-lg font-black text-white">How to Play</p>
              <button type="button" onClick={() => setTutorialOpen(false)} aria-label="Close" className="rounded-full bg-white/10 p-1.5 text-white active:scale-95">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-2 text-xs font-semibold text-white/85">
              <li>• Drag anywhere to run through the jungle — WASD/arrows work too.</li>
              <li>• Watch the bushes and logs: snakes strike fast if you get too close.</li>
              <li>• Dodge rolling rocks and falling branches — they telegraph before they hit.</li>
              <li>• Mud slows you down, and croc water bites if you linger in it.</li>
              <li>• Collect stars, complete bonus goals, and survive as long as you can.</li>
            </ul>
          </div>
        </div>
      )}

      {leaderboardOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 px-6" onClick={() => setLeaderboardOpen(false)}>
          <div
            className="w-full max-w-xs rounded-[26px] border-4 border-white/70 p-5"
            style={{ background: "linear-gradient(165deg, #1c5a2e, #123a1f)", boxShadow: "0 18px 40px rgba(0,0,0,.55)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-black text-white">Leaderboard</p>
              <button type="button" onClick={() => setLeaderboardOpen(false)} aria-label="Close" className="rounded-full bg-white/10 p-1.5 text-white active:scale-95">
                <X className="h-4 w-4" />
              </button>
            </div>
            {!leaders ? (
              <p className="py-6 text-center text-xs text-white/60">Loading…</p>
            ) : leaders.length === 0 ? (
              <p className="py-6 text-center text-xs text-white/60">No runs yet — be the first!</p>
            ) : (
              <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
                {leaders.map((row, i) => (
                  <div
                    key={row.user_id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 ${row.user_id === user?.id ? "bg-white/15" : "bg-white/5"}`}
                  >
                    <span className="w-5 text-xs font-black text-lime-200">{i + 1}</span>
                    <span className="flex-1 truncate text-xs font-bold text-white">{row.name}</span>
                    <span className="text-xs font-black tabular-nums text-white">{row.score.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
