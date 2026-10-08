import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gauge, Play, RotateCcw, Share2, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { bumpStats, getMyStats } from "@/lib/games";
import { toast } from "@/hooks/use-toast";

type Item = { id: number; lane: number; y: number; kind: "star" | "rock" };

const LANES = 3;
const SPEED_BASE = 0.5;

function RunnerAvatar({ boosting = false }: { boosting?: boolean }) {
  return (
    <div className={`relative h-[70px] w-[48px] transition-transform duration-100 ${boosting ? "scale-[1.04]" : ""}`}>
      <div className="absolute left-1/2 top-0 h-[19px] w-[19px] -translate-x-1/2 rounded-full border border-black/20 bg-[radial-gradient(circle_at_35%_28%,#ffd8bd,#bc7655_75%)] shadow-md" />
      <div className="absolute left-1/2 top-[17px] h-[30px] w-[28px] -translate-x-1/2 rounded-[10px_10px_8px_8px] bg-[linear-gradient(145deg,#38bdf8,#2563eb_65%,#1e3a8a)] shadow-lg" />
      <div className="absolute left-[7px] top-[23px] h-[8px] w-[24px] -rotate-[28deg] rounded-full bg-[#c98561]" />
      <div className="absolute right-[5px] top-[23px] h-[8px] w-[24px] rotate-[28deg] rounded-full bg-[#c98561]" />
      <div className="absolute left-[12px] top-[43px] h-[24px] w-[9px] rotate-[9deg] rounded-full bg-[#172554]" />
      <div className="absolute right-[12px] top-[43px] h-[24px] w-[9px] -rotate-[9deg] rounded-full bg-[#172554]" />
      <div className="absolute bottom-0 left-[6px] h-[7px] w-[20px] rounded-full bg-white shadow" />
      <div className="absolute bottom-0 right-[5px] h-[7px] w-[20px] rounded-full bg-white shadow" />
      <div className="absolute left-1/2 top-[26px] -translate-x-1/2 text-[9px] font-black text-white">YAJ</div>
    </div>
  );
}

function Obstacle({ kind }: { kind: Item["kind"] }) {
  if (kind === "star") {
    return (
      <div className="relative flex h-12 w-12 items-center justify-center">
        <div className="absolute h-12 w-12 rounded-full bg-amber-300/20 blur-md" />
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-amber-200/70 bg-[radial-gradient(circle_at_35%_30%,#fff7b0,#facc15_60%,#d97706)] shadow-[0_0_18px_rgba(250,204,21,.75)]">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-12 w-12">
      <div className="absolute bottom-0 left-1/2 h-3 w-11 -translate-x-1/2 rounded-full bg-black/30 blur-sm" />
      <div className="absolute inset-[3px] rounded-[38%_42%_32%_45%] border border-slate-500/60 bg-[radial-gradient(circle_at_35%_25%,#9ca3af,#475569_50%,#111827_100%)] shadow-[inset_-5px_-5px_8px_rgba(0,0,0,.35),0_7px_12px_rgba(0,0,0,.35)]" />
      <div className="absolute left-[13px] top-[11px] h-[5px] w-[7px] rotate-12 rounded-full bg-slate-300/45" />
    </div>
  );
}

export default function YajDashPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lane, setLane] = useState(1);
  const [items, setItems] = useState<Item[]>([]);
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [best, setBest] = useState(0);
  const [streak, setStreak] = useState(0);
  const [flash, setFlash] = useState<"star" | "hit" | null>(null);
  const laneRef = useRef(1);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const raf = useRef<number | null>(null);
  const last = useRef(0);
  const spawn = useRef(0);
  const nextId = useRef(1);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    laneRef.current = lane;
  }, [lane]);

  useEffect(() => {
    if (!user) return;
    void getMyStats(user.id).then((rows) => {
      const row = rows.find((r) => r.game_type === "yaj_dash");
      setBest(row?.high_score ?? 0);
    });
  }, [user?.id]);

  const stop = useCallback(
    (finalScore: number) => {
      setRunning(false);
      setOver(true);
      setFlash("hit");
      window.setTimeout(() => setFlash(null), 450);
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = null;
      if (user) {
        void bumpStats(user.id, "yaj_dash", "win", finalScore).then(() => setBest((b) => Math.max(b, finalScore)));
      }
    },
    [user?.id],
  );

  const loop = useCallback(
    (t: number) => {
      const dt = last.current ? Math.min(t - last.current, 40) : 16;
      last.current = t;
      spawn.current += dt;

      setItems((prev) => {
        const speed = SPEED_BASE + Math.min(scoreRef.current / 360, 1.2);
        let next = prev.map((it) => ({ ...it, y: it.y + speed * (dt / 16) * 2.35 }));

        const spawnDelay = Math.max(360, 690 - Math.min(scoreRef.current, 180) * 1.4);
        if (spawn.current > spawnDelay) {
          spawn.current = 0;
          const kind: Item["kind"] = Math.random() < 0.5 ? "star" : "rock";
          next.push({ id: nextId.current++, lane: Math.floor(Math.random() * LANES), y: -9, kind });
        }

        const survivors: Item[] = [];
        for (const it of next) {
          const hit = it.y > 77 && it.y < 93 && it.lane === laneRef.current;
          if (hit) {
            if (it.kind === "star") {
              streakRef.current += 1;
              setStreak(streakRef.current);
              scoreRef.current += 10 + Math.min(streakRef.current * 2, 20);
              setScore(Math.floor(scoreRef.current));
              setFlash("star");
              window.setTimeout(() => setFlash(null), 180);
              continue;
            }

            streakRef.current = 0;
            setStreak(0);
            stop(Math.floor(scoreRef.current));
            return [];
          }

          if (it.y < 110) survivors.push(it);
        }
        return survivors;
      });

      scoreRef.current += 0.06 * (dt / 16);
      setScore(Math.floor(scoreRef.current));
      raf.current = requestAnimationFrame(loop);
    },
    [stop],
  );

  const start = () => {
    scoreRef.current = 0;
    streakRef.current = 0;
    setScore(0);
    setStreak(0);
    setItems([]);
    setLane(1);
    setOver(false);
    setFlash(null);
    setRunning(true);
    last.current = 0;
    spawn.current = 0;
    raf.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  const move = (dir: -1 | 1) => {
    if (!running) return;
    setLane((l) => Math.max(0, Math.min(LANES - 1, l + dir)));
    try {
      navigator.vibrate?.(8);
    } catch {
      /* optional */
    }
  };

  const share = async () => {
    const text = `I scored ${Math.floor(score)} in YAJ Dash ⚡`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast({ title: "Result copied" });
      }
    } catch {
      /* cancelled */
    }
  };

  const speedLevel = Math.min(5, 1 + Math.floor(score / 45));
  const distance = Math.floor(score * 2.7);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#06101c] text-white">
      <style>{`
        @keyframes yaj-dash-road {
          from { background-position-y: 0px; }
          to { background-position-y: 72px; }
        }
        @keyframes yaj-dash-lights {
          from { transform: translateY(-80px); }
          to { transform: translateY(720px); }
        }
        @keyframes yaj-run-bob {
          0%,100% { transform: translate(-50%,0) scale(1); }
          50% { transform: translate(-50%,-4px) scale(1.02); }
        }
        @keyframes yaj-pickup-pop {
          0% { opacity: 0; transform: translate(-50%,-50%) scale(.6); }
          50% { opacity: 1; transform: translate(-50%,-50%) scale(1.15); }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(1.45); }
        }
        .yaj-dash-road-lines { animation: yaj-dash-road .48s linear infinite; }
        .yaj-runner { animation: yaj-run-bob .38s ease-in-out infinite; }
        .yaj-speed-light { animation: yaj-dash-lights 1.15s linear infinite; }
        .yaj-pickup-pop { animation: yaj-pickup-pop .22s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .yaj-dash-road-lines,.yaj-runner,.yaj-speed-light,.yaj-pickup-pop { animation: none !important; }
        }
      `}</style>

      <header className="absolute inset-x-0 top-0 z-50 flex items-center gap-3 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate("/games")}
          className="flex h-10 items-center gap-1 rounded-full border border-white/15 bg-black/45 px-3 text-xs font-black backdrop-blur-md active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" /> Exit
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-cyan-300">YAJ Arcade</p>
          <h1 className="text-lg font-black leading-none tracking-tight">YAJ Dash</h1>
        </div>

        <div className="rounded-full border border-white/10 bg-black/45 px-3 py-2 text-right backdrop-blur-md">
          <p className="text-[8px] font-black uppercase tracking-widest text-white/45">Best</p>
          <p className="text-sm font-black text-amber-300">{best}</p>
        </div>
      </header>

      <main
        className="relative h-full w-full overflow-hidden"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          const startX = touchStartX.current;
          touchStartX.current = null;
          if (startX == null) return;
          const dx = e.changedTouches[0].clientX - startX;
          if (Math.abs(dx) > 24) move(dx < 0 ? -1 : 1);
        }}
      >
        {/* dusk skyline */}
        <div className="absolute inset-x-0 top-0 h-[48%] bg-[linear-gradient(180deg,#071425_0%,#12335a_58%,#f97316_145%)]" />
        <div className="absolute inset-x-0 top-[24%] h-[22%] opacity-80">
          {Array.from({ length: 14 }).map((_, i) => {
            const widths = [42, 58, 36, 70, 48];
            const h = 55 + ((i * 31) % 100);
            return (
              <div
                key={i}
                className="absolute bottom-0 bg-[#07101c] shadow-[inset_0_0_0_1px_rgba(255,255,255,.03)]"
                style={{
                  left: `${i * 8 - 3}%`,
                  width: widths[i % widths.length],
                  height: h,
                }}
              >
                {Array.from({ length: 5 }).map((__, w) => (
                  <span
                    key={w}
                    className="absolute h-1.5 w-1 rounded-sm bg-amber-300/50"
                    style={{ left: `${8 + (w % 2) * 16}px`, top: `${10 + Math.floor(w / 2) * 18}px` }}
                  />
                ))}
              </div>
            );
          })}
        </div>

        {/* distant glow */}
        <div className="absolute left-1/2 top-[34%] h-20 w-[70%] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />

        {/* road */}
        <div
          className="absolute bottom-0 left-1/2 h-[76%] w-[96%] -translate-x-1/2 overflow-hidden"
          style={{ clipPath: "polygon(37% 0,63% 0,100% 100%,0 100%)" }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#111827_0%,#1f2937_48%,#111827_100%)]" />
          <div
            className="yaj-dash-road-lines absolute inset-0 opacity-80"
            style={{
              backgroundImage:
                "repeating-linear-gradient(180deg,transparent 0 36px,rgba(255,255,255,.72) 36px 48px,transparent 48px 72px)",
              backgroundSize: "100% 72px",
            }}
          />
          <div className="absolute inset-y-0 left-1/3 w-[3px] -translate-x-1/2 bg-white/35" />
          <div className="absolute inset-y-0 left-2/3 w-[3px] -translate-x-1/2 bg-white/35" />
          <div className="absolute inset-y-0 left-0 w-[5px] bg-cyan-300/60 shadow-[0_0_12px_rgba(34,211,238,.65)]" />
          <div className="absolute inset-y-0 right-0 w-[5px] bg-fuchsia-400/60 shadow-[0_0_12px_rgba(232,121,249,.65)]" />
        </div>

        {/* roadside speed lights */}
        {running &&
          Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="yaj-speed-light absolute z-[3] h-10 w-[2px] bg-cyan-200/40 blur-[1px]"
              style={{
                left: i % 2 === 0 ? `${9 + (i % 3) * 5}%` : `${82 + (i % 3) * 4}%`,
                top: `${-10 - i * 11}%`,
                animationDelay: `${i * -0.12}s`,
                animationDuration: `${Math.max(0.5, 1.25 - speedLevel * 0.1)}s`,
              }}
            />
          ))}

        {/* HUD */}
        <div className="absolute inset-x-4 top-[86px] z-40 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/10 bg-black/48 px-3 py-2 backdrop-blur-md">
            <p className="text-[8px] font-black uppercase tracking-widest text-white/40">Score</p>
            <p className="text-xl font-black tabular-nums text-white">{Math.floor(score)}</p>
          </div>
          <div className="rounded-2xl border border-cyan-300/15 bg-black/48 px-3 py-2 text-center backdrop-blur-md">
            <p className="text-[8px] font-black uppercase tracking-widest text-white/40">Distance</p>
            <p className="text-xl font-black tabular-nums text-cyan-300">{distance}m</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/48 px-3 py-2 text-right backdrop-blur-md">
            <p className="flex items-center justify-end gap-1 text-[8px] font-black uppercase tracking-widest text-white/40">
              <Gauge className="h-3 w-3" /> Speed
            </p>
            <p className="text-xl font-black text-amber-300">{speedLevel}x</p>
          </div>
        </div>

        {streak >= 2 && running && (
          <div className="absolute left-1/2 top-[151px] z-40 -translate-x-1/2 rounded-full border border-amber-300/30 bg-black/55 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-200 backdrop-blur-md">
            {streak} pickup streak
          </div>
        )}

        {/* objects */}
        {items.map((it) => {
          const perspective = 0.55 + (Math.max(0, it.y) / 100) * 0.75;
          const roadWidth = 25 + Math.max(0, it.y) * 0.62;
          const laneOffset = (it.lane - 1) * roadWidth;
          return (
            <div
              key={it.id}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `calc(50% + ${laneOffset}px)`,
                top: `${31 + it.y * 0.66}%`,
                transform: `translate(-50%,-50%) scale(${perspective})`,
              }}
            >
              <Obstacle kind={it.kind} />
            </div>
          );
        })}

        {/* runner */}
        <div
          className="yaj-runner absolute bottom-[9.5%] z-30 -translate-x-1/2 transition-[left] duration-150 ease-out"
          style={{ left: `${[34, 50, 66][lane]}%` }}
        >
          <div className="absolute bottom-[-7px] left-1/2 h-3 w-12 -translate-x-1/2 rounded-full bg-black/45 blur-sm" />
          <RunnerAvatar boosting={streak >= 3} />
        </div>

        {flash === "star" && (
          <div className="yaj-pickup-pop pointer-events-none absolute left-1/2 top-[57%] z-50 rounded-full bg-amber-300 px-3 py-1 text-sm font-black text-black shadow-[0_0_24px_rgba(250,204,21,.85)]">
            +{10 + Math.min(streak * 2, 20)}
          </div>
        )}

        {flash === "hit" && <div className="pointer-events-none absolute inset-0 z-40 bg-red-500/20" />}

        {/* touch help / lane controls */}
        {running && (
          <div className="absolute inset-x-0 bottom-[max(18px,env(safe-area-inset-bottom))] z-40 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => move(-1)}
              className="flex h-12 w-24 items-center justify-center rounded-full border border-white/15 bg-black/35 text-xs font-black text-white/70 backdrop-blur-md active:scale-95"
            >
              ← LEFT
            </button>
            <div className="rounded-full bg-black/30 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white/40 backdrop-blur-md">
              Swipe
            </div>
            <button
              type="button"
              onClick={() => move(1)}
              className="flex h-12 w-24 items-center justify-center rounded-full border border-white/15 bg-black/35 text-xs font-black text-white/70 backdrop-blur-md active:scale-95"
            >
              RIGHT →
            </button>
          </div>
        )}

        {!running && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-[#050912]/76 px-6 backdrop-blur-[7px]">
            <div className="w-full max-w-sm rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(15,23,42,.97),rgba(5,10,20,.97))] p-6 text-center shadow-2xl">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#22d3ee,#2563eb)] shadow-[0_12px_34px_rgba(37,99,235,.38)]">
                <RunnerAvatar />
              </div>
              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.3em] text-cyan-300">YAJ Arcade</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight">YAJ DASH</h2>
              <p className="mx-auto mt-2 max-w-[260px] text-sm leading-relaxed text-white/55">
                {over
                  ? `Run over — you made it ${distance}m with ${Math.floor(score)} points.`
                  : "Dash through three lanes, collect energy stars and dodge incoming obstacles."}
              </p>

              <button
                type="button"
                onClick={start}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(90deg,#06b6d4,#2563eb)] px-5 py-3.5 text-sm font-black text-white shadow-lg active:scale-[0.98]"
              >
                {over ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {over ? "Run Again" : "Start Run"}
              </button>

              {over && (
                <button
                  type="button"
                  onClick={share}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-black text-white/85 active:scale-[0.98]"
                >
                  <Share2 className="h-4 w-4" /> Share Score
                </button>
              )}

              <p className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                Swipe left or right to change lanes
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
