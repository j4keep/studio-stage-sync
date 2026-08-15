import DominoTile from "@/components/games/pro/DominoTile";
import PlayerStrip from "@/components/games/pro/PlayerStrip";
import { Layers } from "lucide-react";
import { Tile } from "@/lib/dominoes";

const layout: Tile[] = [[3, 5], [5, 5], [5, 1], [1, 6], [6, 6], [6, 4], [4, 0], [0, 2]];
const hand: Tile[] = [[2, 5], [5, 0], [6, 6], [1, 3], [2, 4], [0, 3]];

export default function DomProbe() {
  return (
    <div
      className="min-h-[100dvh] px-3 pb-10 pt-3"
      style={{
        background:
          "radial-gradient(120% 70% at 50% -10%, hsl(266 60% 22%) 0%, hsl(240 45% 10%) 45%, hsl(240 50% 6%) 100%)",
      }}
    >
      <PlayerStrip name="Computer" isComputer badge="Easy" count={7} countLabel="Tiles left" active activeLabel="Thinking" />
      <div className="mx-auto -mt-2 flex w-fit max-w-full gap-1 overflow-hidden rounded-b-2xl border border-t-0 border-white/10 bg-black/40 px-2 pb-2 pt-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <DominoTile key={i} faceDown size="sm" />
        ))}
      </div>
      <div
        className="mt-3 rounded-3xl border border-primary/25 p-2"
        style={{
          background: "linear-gradient(180deg, hsl(240 50% 12%), hsl(240 55% 8%))",
          boxShadow: "0 0 30px hsl(var(--primary) / 0.18)",
        }}
      >
        <div
          className="flex min-h-[260px] items-center gap-1.5 overflow-x-auto rounded-2xl px-3 py-6"
          style={{ background: "radial-gradient(80% 60% at 50% 40%, hsl(232 55% 20%), hsl(235 60% 12%))" }}
        >
          {layout.map((t, i) => (
            <DominoTile key={i} tile={t} size="md" orientation={t[0] === t[1] ? "vertical" : "horizontal"} />
          ))}
        </div>
      </div>
      <div className="mt-3">
        <PlayerStrip name="Jay" count={6} countLabel="Tiles in hand" active activeLabel="Your turn" />
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-3">
        {hand.map((t, i) => (
          <DominoTile key={i} tile={t} size="lg" glow={i % 2 === 0} dim={i % 2 !== 0} onClick={() => {}} />
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-3">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-2.5">
          <Layers className="h-5 w-5 text-primary" />
          <div className="text-left">
            <p className="text-[10px] uppercase tracking-wide text-white/50">Boneyard</p>
            <p className="text-sm font-black text-white">6 tiles</p>
          </div>
        </div>
      </div>
    </div>
  );
}
