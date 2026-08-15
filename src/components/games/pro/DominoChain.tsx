import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Tile } from "@/lib/dominoes";
import DominoTile from "./DominoTile";

type Props = {
  layout: Tile[];
  /** Open-end values [left, right] or null on an empty table. */
  ends: [number, number] | null;
  /** Show glowing drop targets on these ends. */
  activeEnds?: { left: boolean; right: boolean };
  onPickEnd?: (side: "left" | "right") => void;
};

/** Rendered footprint of a md tile including its 2px frame. */
const V_W = 44; // vertical tile width
const V_H = 84; // vertical tile height
const H_W = 84; // horizontal tile width
const H_H = 44; // horizontal tile height
const ROW_H = V_H + 6; // row pitch (tallest tile + breathing room)
const SLOT_W = 40;

type Placed = { tile: Tile; index: number; x: number; y: number; vertical: boolean };

function EndSlot({
  value,
  x,
  y,
  onClick,
}: {
  value: number;
  x: number;
  y: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Play on open end ${value}`}
      className="absolute rounded-lg border-2 border-dashed border-primary/70 text-[11px] font-black text-primary animate-pulse"
      style={{
        left: x,
        top: y,
        width: SLOT_W,
        height: V_H,
        background: "hsl(var(--primary) / 0.16)",
        boxShadow: "0 0 16px hsl(var(--primary) / 0.55)",
      }}
    >
      {value}
    </button>
  );
}

/**
 * Lays the played tiles out as ONE continuous connected path: tiles touch
 * end-to-end, and the chain turns 90° (via a rotated tile at the edge) then
 * snakes back in the opposite direction when it runs out of table width.
 */
function buildPath(layout: Tile[], boardW: number) {
  const placed: Placed[] = [];
  let dir: 1 | -1 = 1;
  let row = 0;
  let cursor = 2; // leading edge of the chain
  let firstX = 2;

  layout.forEach((tile, index) => {
    const isDouble = tile[0] === tile[1];
    let vertical = isDouble;
    let w = vertical ? V_W : H_W;

    const fits = dir > 0 ? cursor + w <= boardW : cursor - w >= 0;

    if (!fits) {
      // Turn the chain: stand this tile up at the edge, then continue on the row below.
      const turnFits = dir > 0 ? cursor + V_W <= boardW : cursor - V_W >= 0;
      if (turnFits) {
        const px = dir > 0 ? cursor : cursor - V_W;
        placed.push({ tile, index, x: px, y: row * ROW_H, vertical: true });
        row += 1;
        dir = dir > 0 ? -1 : 1;
        cursor = dir > 0 ? px : px + V_W;
        return;
      }
      row += 1;
      dir = dir > 0 ? -1 : 1;
      cursor = dir > 0 ? 2 : boardW - 2;
      vertical = isDouble;
      w = vertical ? V_W : H_W;
    }

    const px = dir > 0 ? cursor : cursor - w;
    const h = vertical ? V_H : H_H;
    placed.push({ tile, index, x: px, y: row * ROW_H + (ROW_H - h) / 2, vertical });
    if (index === 0) firstX = px;
    cursor = dir > 0 ? cursor + w : cursor - w;
  });

  return { placed, dir, row, cursor, firstX, rows: row + 1 };
}

export default function DominoChain({ layout, ends, activeEnds, onPickEnd }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const prevLen = useRef(layout.length);
  const [justPlaced, setJustPlaced] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (layout.length > prevLen.current) {
      setJustPlaced(layout.length - 1);
      const t = setTimeout(() => setJustPlaced(null), 500);
      prevLen.current = layout.length;
      return () => clearTimeout(t);
    }
    prevLen.current = layout.length;
  }, [layout.length]);

  const boardW = Math.max(width, 240);
  const path = buildPath(layout, boardW);
  const height = Math.max(path.rows * ROW_H, 150);

  const showLeft = Boolean(ends && activeEnds?.left);
  const showRight = Boolean(ends && activeEnds?.right);

  // Left slot sits just before the first tile; right slot just after the leading edge.
  const leftSlotX = Math.max(0, Math.min(boardW - SLOT_W, path.firstX - SLOT_W - 2));
  const rightSlotX = Math.max(
    0,
    Math.min(boardW - SLOT_W, path.dir > 0 ? path.cursor + 2 : path.cursor - SLOT_W - 2),
  );

  return (
    <div ref={wrapRef} className="w-full overflow-hidden px-1">
      {!layout.length ? (
        <div className="flex min-h-[150px] items-center justify-center">
          <p className="text-center text-xs font-bold text-white/60">Empty table — play your first tile</p>
        </div>
      ) : (
        <div className="relative w-full" style={{ height }}>
          {path.placed.map((p) => (
            <div
              key={`${p.tile[0]}-${p.tile[1]}-${p.index}`}
              className="absolute"
              style={{ left: p.x, top: p.y }}
            >
              <DominoTile
                tile={p.tile}
                size="md"
                orientation={p.vertical ? "vertical" : "horizontal"}
                className={justPlaced === p.index ? "domino-place" : undefined}
              />
            </div>
          ))}
          {showLeft && ends ? (
            <EndSlot value={ends[0]} x={leftSlotX} y={0} onClick={() => onPickEnd?.("left")} />
          ) : null}
          {showRight && ends ? (
            <EndSlot
              value={ends[1]}
              x={rightSlotX}
              y={path.row * ROW_H}
              onClick={() => onPickEnd?.("right")}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
