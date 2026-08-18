import { useRef, useState } from "react";
import { ArrowLeft, HelpCircle, Layers, Volume2, VolumeX } from "lucide-react";
import type { Tile } from "@/lib/dominoes";
import DominoTile from "./DominoTile";
import DominoChain from "./DominoChain";
import PlayerPod from "./PlayerPod";

type Props = {
  layout: Tile[];
  ends: [number, number] | null;
  pileCount: number;
  myHand: Tile[];
  playable: number[];
  myTurn: boolean;
  myName: string;
  myAvatar: string | null;
  oppName: string;
  oppAvatar: string | null;
  oppCount: number;
  isComputer: boolean;
  turnLabel: string;
  finished: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  onPlay: (handIndex: number, side: "left" | "right") => void;
  onDraw: () => void;
  howToPlay: string[];
};

export default function DominoTable({
  layout,
  ends,
  pileCount,
  myHand,
  playable,
  myTurn,
  myName,
  myAvatar,
  oppName,
  oppAvatar,
  oppCount,
  isComputer,
  turnLabel,
  finished,
  muted,
  onToggleMute,
  onBack,
  onPlay,
  onDraw,
  howToPlay,
}: Props) {
  const [help, setHelp] = useState(false);
  const [drag, setDrag] = useState<{
    i: number;
    x: number;
    y: number;
    left: boolean;
    right: boolean;
  } | null>(null);
  const [hover, setHover] = useState<"left" | "right" | null>(null);
  const hoverRef = useRef<"left" | "right" | null>(null);

  const canDrag = myTurn && !finished;

  const validSides = (tile: Tile) => {
    if (!ends) return { left: false, right: true };
    return { left: tile.includes(ends[0]), right: tile.includes(ends[1]) };
  };

  const startDrag = (i: number, e: React.PointerEvent) => {
    if (!canDrag || !playable.includes(i)) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const v = validSides(myHand[i]);
    setDrag({ i, x: e.clientX, y: e.clientY, ...v });
    hoverRef.current = null;
    setHover(null);
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    e.preventDefault();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const zone = (el as HTMLElement | null)?.closest?.("[data-end]") as HTMLElement | null;
    const side = (zone?.dataset.end as "left" | "right" | undefined) ?? null;
    const ok = side === "left" ? drag.left : side === "right" ? drag.right : false;
    hoverRef.current = ok ? side : null;
    setHover(ok ? side : null);
    setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
  };

  const endDrag = () => {
    const d = drag;
    const side = hoverRef.current;
    setDrag(null);
    setHover(null);
    hoverRef.current = null;
    if (d && side) onPlay(d.i, side);
  };

  const dragTile = drag ? myHand[drag.i] : null;

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(90% 80% at 50% 0%, hsl(266 40% 18%) 0%, hsl(258 45% 10%) 45%, hsl(255 40% 6%) 100%)",
      }}
    >
      {/* Top strip */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-1.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="rounded-full bg-white/10 p-1.5 text-white active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span
          className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider"
          style={{
            background: myTurn
              ? "linear-gradient(180deg, hsl(var(--primary)), hsl(var(--primary) / 0.6))"
              : "rgba(255,255,255,0.08)",
            color: myTurn ? "hsl(var(--primary-foreground))" : "rgba(255,255,255,0.75)",
            boxShadow: myTurn ? "0 0 14px hsl(var(--primary) / 0.55)" : undefined,
          }}
        >
          {turnLabel}
        </span>
        <span className="truncate text-[10px] text-white/60">
          {ends ? `Open ends ${ends[0]} and ${ends[1]}` : "Play any tile"}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? "Unmute music" : "Mute music"}
            className="rounded-full bg-white/10 p-1.5 text-white active:scale-95"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setHelp((v) => !v)}
            aria-label="How to play"
            className="rounded-full bg-white/10 p-1.5 text-white active:scale-95"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Oval felt table */}
      <div className="relative min-h-0 flex-1 px-3 pb-1">
        <div
          className="relative h-full w-full"
          style={{
            borderRadius: "50% / 46%",
            padding: 10,
            background:
              "linear-gradient(160deg, #8a5a2b 0%, #4e3116 40%, #7a4d24 70%, #3d240f 100%)",
            boxShadow:
              "0 14px 30px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.2), inset 0 -4px 8px rgba(0,0,0,0.55)",
          }}
        >
          <div
            className="relative h-full w-full overflow-hidden"
            style={{
              borderRadius: "50% / 46%",
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0), radial-gradient(78% 62% at 50% 34%, #2f8354 0%, #1d5a39 58%, #10331f 100%)",
              backgroundSize: "5px 5px, auto",
              boxShadow: "inset 0 0 40px rgba(0,0,0,0.6)",
            }}
          >
            {/* Opponent at the far side of the table */}
            <div className="absolute left-1/2 top-1 z-10 flex -translate-x-1/2 items-center gap-2">
              <PlayerPod
                name={oppName}
                avatarUrl={oppAvatar}
                isComputer={isComputer}
                count={oppCount}
                active={!myTurn && !finished}
              />
              <div className="flex gap-0.5">
                {Array.from({ length: Math.min(oppCount, 7) }).map((_, i) => (
                  <DominoTile key={i} faceDown size="sm" orientation="vertical" />
                ))}
              </div>
            </div>

            {/* Boneyard stack */}
            <div className="absolute bottom-2 left-4 z-10 flex items-center gap-2 rounded-xl bg-black/45 px-2.5 py-1.5">
              <Layers className="h-4 w-4 text-[#f0d78c]" />
              <div className="leading-tight">
                <p className="text-[8px] font-bold uppercase tracking-wide text-white/60">Boneyard</p>
                <p className="text-[11px] font-black text-white">{pileCount}</p>
              </div>
            </div>

            {/* Chain */}
            <div className="absolute inset-x-6 bottom-10 top-16 overflow-y-auto">
              <DominoChain
                layout={layout}
                ends={ends}
                size="sm"
                emptyDropActive={!!drag}
                activeEnds={drag ? { left: drag.left, right: drag.right } : undefined}
              />
            </div>
          </div>
        </div>

        {help ? (
          <ul className="absolute inset-x-6 top-2 z-20 space-y-1 rounded-xl bg-black/85 p-3 text-[10px] text-white/80 animate-fade-in">
            {howToPlay.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Your rail: pod + hand */}
      <div className="flex shrink-0 items-center gap-2 px-3 pb-2">
        <PlayerPod name={myName} avatarUrl={myAvatar} count={myHand.length} active={myTurn} />
        <div
          className="flex min-w-0 flex-1 items-end gap-1.5 overflow-x-auto rounded-2xl bg-black/30 px-2 py-1.5"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
        >
          {myHand.map((t, i) => {
            const ok = canDrag && playable.includes(i);
            return (
              <DominoTile
                key={`${t[0]}-${t[1]}-${i}`}
                tile={t}
                size="md"
                glow={ok}
                dim={!ok}
                className={drag?.i === i ? "opacity-30" : ok ? "cursor-grab" : undefined}
                style={{ touchAction: ok ? "none" : "pan-x" }}
                onPointerDown={ok ? (e) => startDrag(i, e) : undefined}
                onPointerMove={drag?.i === i ? moveDrag : undefined}
                onPointerUp={drag?.i === i ? endDrag : undefined}
                onPointerCancel={drag?.i === i ? endDrag : undefined}
              />
            );
          })}
          {myTurn && !playable.length && !finished ? (
            <button
              type="button"
              onClick={onDraw}
              className="ml-auto shrink-0 rounded-xl bg-primary px-4 py-2 text-[11px] font-black text-primary-foreground active:scale-95"
            >
              {pileCount ? "Draw a tile" : "Pass"}
            </button>
          ) : null}
        </div>
      </div>

      {!drag && myTurn && playable.length ? (
        <p className="pointer-events-none absolute bottom-[86px] left-1/2 -translate-x-1/2 text-[10px] font-bold text-white/55">
          Drag a glowing tile onto the open end
        </p>
      ) : null}

      {/* Ghost tile that follows the finger */}
      {dragTile ? (
        <div
          className="pointer-events-none fixed z-[60]"
          style={{
            left: drag!.x,
            top: drag!.y,
            transform: "translate(-50%, -120%) scale(1.05)",
            filter: hover ? "drop-shadow(0 0 14px hsl(var(--primary)))" : "drop-shadow(0 8px 12px rgba(0,0,0,0.6))",
          }}
        >
          <DominoTile tile={dragTile} size="md" orientation="horizontal" glow />
        </div>
      ) : null}
    </div>
  );
}
