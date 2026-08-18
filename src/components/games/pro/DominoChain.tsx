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
  /** Tile scale used on the table. */
  size?: "sm" | "md";
  /** Highlight the whole surface as a drop zone (empty table). */
  emptyDropActive?: boolean;
  /** Scale the chain down so it always fits its container (no clipping). */
  fit?: boolean;
};


type Geo = { vW: number; vH: number; hW: number; hH: number; rowH: number; slotW: number };

const GEO: Record<"sm" | "md", Geo> = {
  // footprints include the 2px tile frame on each side
  sm: { vW: 30, vH: 56, hW: 56, hH: 30, rowH: 62, slotW: 28 },
  md: { vW: 44, vH: 84, hW: 84, hH: 44, rowH: 90, slotW: 40 },
};

type Placed = { tile: Tile; index: number; x: number; y: number; vertical: boolean };

function EndSlot({
  value,
  x,
  y,
  side,
  w,
  h,
  onClick,
}: {
  value: number;
  x: number;
  y: number;
  side: "left" | "right";
  w: number;
  h: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      data-end={side}
      onClick={onClick}
      aria-label={`Play on open end ${value}`}
      className="absolute flex items-center justify-center rounded-lg border-2 border-dashed border-primary/70 text-[11px] font-black text-primary animate-pulse"
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
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
function buildPath(layout: Tile[], boardW: number, g: Geo) {
  const placed: Placed[] = [];
  let dir: 1 | -1 = 1;
  let row = 0;
  let cursor = 2; // leading edge of the chain
  let firstX = 2;

  layout.forEach((tile, index) => {
    const isDouble = tile[0] === tile[1];
    let vertical = isDouble;
    let w = vertical ? g.vW : g.hW;

    const fits = dir > 0 ? cursor + w <= boardW : cursor - w >= 0;

    if (!fits) {
      // Turn the chain: stand this tile up at the edge, then continue on the row below.
      const turnFits = dir > 0 ? cursor + g.vW <= boardW : cursor - g.vW >= 0;
      if (turnFits) {
        const px = dir > 0 ? cursor : cursor - g.vW;
        placed.push({ tile, index, x: px, y: row * g.rowH, vertical: true });
        row += 1;
        dir = dir > 0 ? -1 : 1;
        cursor = dir > 0 ? px : px + g.vW;
        return;
      }
      row += 1;
      dir = dir > 0 ? -1 : 1;
      cursor = dir > 0 ? 2 : boardW - 2;
      vertical = isDouble;
      w = vertical ? g.vW : g.hW;
    }

    const px = dir > 0 ? cursor : cursor - w;
    const h = vertical ? g.vH : g.hH;
    placed.push({ tile, index, x: px, y: row * g.rowH + (g.rowH - h) / 2, vertical });
    if (index === 0) firstX = px;
    cursor = dir > 0 ? cursor + w : cursor - w;
  });

  return { placed, dir, row, cursor, firstX, rows: row + 1 };
}

export default function DominoChain({
  layout,
  ends,
  activeEnds,
  onPickEnd,
  size = "md",
  emptyDropActive,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const prevLen = useRef(layout.length);
  const [justPlaced, setJustPlaced] = useState<number | null>(null);
  const g = GEO[size];

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

  const boardW = Math.max(width, 200);
  const path = buildPath(layout, boardW, g);
  const height = Math.max(path.rows * g.rowH, g.vH + 20);

  const showLeft = Boolean(ends && activeEnds?.left);
  const showRight = Boolean(ends && activeEnds?.right);

  // Left slot sits just before the first tile; right slot just after the leading edge.
  const leftSlotX = Math.max(0, Math.min(boardW - g.slotW, path.firstX - g.slotW - 2));
  const rightSlotX = Math.max(
    0,
    Math.min(boardW - g.slotW, path.dir > 0 ? path.cursor + 2 : path.cursor - g.slotW - 2),
  );

  return (
    <div ref={wrapRef} className="h-full w-full overflow-hidden px-1">
      {!layout.length ? (
        <div className="flex h-full min-h-[80px] items-center justify-center">
          <div
            data-end="right"
            className={
              emptyDropActive
                ? "rounded-2xl border-2 border-dashed border-primary/70 px-6 py-4 text-center text-[11px] font-black text-primary animate-pulse"
                : "text-center text-xs font-bold text-white/60"
            }
            style={
              emptyDropActive
                ? { background: "hsl(var(--primary) / 0.16)", boxShadow: "0 0 18px hsl(var(--primary) / 0.5)" }
                : undefined
            }
          >
            {emptyDropActive ? "Drop your tile here" : "Empty table — drag your first tile in"}
          </div>
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
                size={size}
                orientation={p.vertical ? "vertical" : "horizontal"}
                className={justPlaced === p.index ? "domino-place" : undefined}
              />
            </div>
          ))}
          {showLeft && ends ? (
            <EndSlot
              value={ends[0]}
              side="left"
              x={leftSlotX}
              y={0}
              w={g.slotW}
              h={g.vH}
              onClick={() => onPickEnd?.("left")}
            />
          ) : null}
          {showRight && ends ? (
            <EndSlot
              value={ends[1]}
              side="right"
              x={rightSlotX}
              y={path.row * g.rowH}
              w={g.slotW}
              h={g.vH}
              onClick={() => onPickEnd?.("right")}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
