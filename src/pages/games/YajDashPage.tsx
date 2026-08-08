import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Play, RotateCcw, Share2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { bumpStats, getMyStats } from "@/lib/games";
import { toast } from "@/hooks/use-toast";

type Item = { id: number; lane: number; y: number; kind: "star" | "rock" };

const LANES = 3;
const SPEED_BASE = 0.55;

export default function YajDashPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lane, setLane] = useState(1);
  const [items, setItems] = useState<Item[]>([]);
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [best, setBest] = useState(0);
  const laneRef = useRef(1);
  const scoreRef = useRef(0);
  const raf = useRef<number | null>(null);
  const last = useRef(0);
  const spawn = useRef(0);
  const nextId = useRef(1);

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
        const speed = SPEED_BASE + Math.min(scoreRef.current / 400, 0.9);
        let next = prev.map((it) => ({ ...it, y: it.y + speed * (dt / 16) * 2.2 }));

        if (spawn.current > 620) {
          spawn.current = 0;
          const kind: "star" | "rock" = Math.random() < 0.45 ? "star" : "rock";
          next.push({ id: nextId.current++, lane: Math.floor(Math.random() * LANES), y: -8, kind });
        }

        const survivors: Item[] = [];
        for (const it of next) {
          const hit = it.y > 78 && it.y < 94 && it.lane === laneRef.current;
          if (hit) {
            if (it.kind === "star") {
              scoreRef.current += 10;
              setScore(scoreRef.current);
              continue;
            }
            stop(scoreRef.current);
            return [];
          }
          if (it.y < 110) survivors.push(it);
        }
        return survivors;
      });

      scoreRef.current += 0.05 * (dt / 16);
      setScore(Math.floor(scoreRef.current));
      raf.current = requestAnimationFrame(loop);
    },
    [stop],
  );

  

  const start = () => {
    scoreRef.current = 0;
    setScore(0);
    setItems([]);
    setLane(1);
    setOver(false);
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

  const move = (dir: -1 | 1) => setLane((l) => Math.max(0, Math.min(LANES - 1, l + dir)));

  const share = async () => {
    const text = `I scored ${Math.floor(score)} in YAJ Dash ⭐`;
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

  return (
    <div className="min-h-[100dvh] bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate("/games")} aria-label="Back" className="rounded-full p-1.5 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-black tracking-tight">YAJ Dash</h1>
            <p className="text-[11px] text-muted-foreground">Collect stars, dodge rocks</p>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4">
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3 text-sm font-black">
          <span>Score {Math.floor(score)}</span>
          <span className="text-muted-foreground">Best {best}</span>
        </div>

        <div
          className="relative mx-auto mt-4 h-[420px] max-w-[380px] overflow-hidden rounded-3xl bg-gradient-to-b from-[hsl(300_55%_28%)] to-[hsl(330_70%_48%)]"
          onTouchStart={(e) => {
            const x = e.touches[0].clientX;
            const mid = (e.currentTarget as HTMLElement).getBoundingClientRect();
            move(x < mid.left + mid.width / 2 ? -1 : 1);
          }}
        >
          {items.map((it) => (
            <div
              key={it.id}
              className="absolute flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full text-lg"
              style={{
                left: `${((it.lane + 0.5) / LANES) * 100}%`,
                top: `${it.y}%`,
                background: it.kind === "star" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.28)",
              }}
            >
              {it.kind === "star" ? "⭐" : "🪨"}
            </div>
          ))}

          <div
            className="absolute bottom-[8%] flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-background text-xl shadow-lg transition-[left] duration-100"
            style={{ left: `${((lane + 0.5) / LANES) * 100}%` }}
          >
            🏃
          </div>

          {!running && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-sm">
              <p className="text-sm font-black">{over ? `Game over — ${Math.floor(score)} points` : "Tap play to start"}</p>
              <button
                type="button"
                onClick={start}
                className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground"
              >
                {over ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />} {over ? "Play again" : "Play"}
              </button>
              {over && (
                <button
                  type="button"
                  onClick={share}
                  className="flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-black"
                >
                  <Share2 className="h-4 w-4" /> Share score
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mx-auto mt-4 flex max-w-[380px] gap-2">
          <button
            type="button"
            onClick={() => move(-1)}
            className="flex-1 rounded-full border border-border py-3 text-sm font-black active:scale-[0.98]"
          >
            ◀ Left
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            className="flex-1 rounded-full border border-border py-3 text-sm font-black active:scale-[0.98]"
          >
            Right ▶
          </button>
        </div>
      </main>
    </div>
  );
}
