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

const TILE_W = 84; // horizontal md tile + gap
const DOUBLE_W = 48; // vertical md tile (double) + gap

function EndSlot({ value, onClick }: { value: number; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Play on open end ${value}`}
      className="shrink-0 rounded-lg border-2 border-dashed border-primary/70 text-[11px] font-black text-primary animate-pulse"
      style={{
        width: 44,
        height: 84,
        background: "hsl(var(--primary) / 0.16)",
        boxShadow: "0 0 16px hsl(var(--primary) / 0.55)",
      }}
    >
      {value}
    </button>
  );
}

/** Serpentine domino chain: wraps into rows that alternate direction like a real table. */
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

  const avail = Math.max(width - 8, 200);
  const rows: { tiles: Tile[]; startIndex: number }[] = [];
  let current: Tile[] = [];
  let used = 0;
  let start = 0;

  layout.forEach((t, i) => {
    const w = t[0] === t[1] ? DOUBLE_W : TILE_W;
    if (used + w > avail && current.length) {
      rows.push({ tiles: current, startIndex: start });
      current = [];
      used = 0;
      start = i;
    }
    current.push(t);
    used += w;
  });
  if (current.length) rows.push({ tiles: current, startIndex: start });

  const lastRow = rows.length - 1;

  return (
    <div ref={wrapRef} className="w-full overflow-hidden px-1">
      {!layout.length ? (
        <div className="flex min-h-[150px] items-center justify-center gap-3">
          {activeEnds && onPickEnd ? null : null}
          <p className="text-center text-xs font-bold text-white/60">Empty table — play your first tile</p>
        </div>
      ) : (
        <div className="flex min-h-[150px] flex-col justify-center gap-1.5 py-1">
          {rows.map((row, ri) => {
            const reversed = ri % 2 === 1;
            return (
              <div
                key={ri}
                className={`flex items-center gap-1 ${reversed ? "flex-row-reverse" : "flex-row"}`}
              >
                {ri === 0 && ends && activeEnds?.left ? (
                  <EndSlot value={ends[0]} onClick={() => onPickEnd?.("left")} />
                ) : null}
                {row.tiles.map((t, ti) => {
                  const idx = row.startIndex + ti;
                  return (
                    <DominoTile
                      key={`${t[0]}-${t[1]}-${idx}`}
                      tile={t}
                      size="md"
                      orientation={t[0] === t[1] ? "vertical" : "horizontal"}
                      className={justPlaced === idx ? "domino-place" : undefined}
                    />
                  );
                })}
                {ri === lastRow && ends && activeEnds?.right ? (
                  <EndSlot value={ends[1]} onClick={() => onPickEnd?.("right")} />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
