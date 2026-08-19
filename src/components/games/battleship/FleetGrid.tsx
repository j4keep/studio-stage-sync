import { BOARD_SIZE, Fleet, Shot } from "@/lib/battleship";

function ShipHull({ ship }: { ship: Fleet[number] }) {
  const xs = ship.cells.map((c) => c.x);
  const ys = ship.cells.map((c) => c.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX + 1;
  const h = Math.max(...ys) - minY + 1;
  const sunk = ship.hits.every((v) => v);
  const pad = 0.09;

  return (
    <g>
      <rect
        x={minX + pad}
        y={minY + pad}
        width={w - pad * 2}
        height={h - pad * 2}
        rx={0.16}
        fill={sunk ? "rgba(90,95,105,0.55)" : "url(#bs-hull)"}
        stroke={sunk ? "#4b5563" : "#0f1b28"}
        strokeWidth={0.055}
      />
      {ship.cells.map((c, i) =>
        ship.hits[i] ? (
          <g key={i} transform={`translate(${c.x + 0.5} ${c.y + 0.5})`}>
            <circle r={0.24} fill={sunk ? "#374151" : "#dc2626"} opacity={0.95} />
            <path d="M-0.13,-0.13 L0.13,0.13 M0.13,-0.13 L-0.13,0.13" stroke="#fff" strokeWidth={0.055} strokeLinecap="round" />
          </g>
        ) : null,
      )}
      {sunk && (
        <text
          x={minX + w / 2}
          y={minY + h / 2}
          fontSize={w > h ? 0.32 : 0.22}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="system-ui, sans-serif"
          fontWeight={900}
          fill="#e5e7eb"
          transform={h > w ? `rotate(90 ${minX + w / 2} ${minY + h / 2})` : undefined}
        >
          SUNK
        </text>
      )}
    </g>
  );
}

/**
 * A 10x10 board: cell buttons underneath for tap targets, an SVG overlay on
 * top rendering ships as connected hulls (0..BOARD_SIZE viewBox lines up
 * exactly with the grid cells beneath it, cell-for-cell).
 */
export default function FleetGrid({
  fleet,
  shots,
  showShips,
  interactive,
  onTap,
}: {
  fleet: Fleet | null;
  shots: Shot[];
  showShips: boolean;
  interactive: boolean;
  onTap?: (x: number, y: number) => void;
}) {
  const marks = new Map<string, "hit" | "miss">();
  shots.forEach((s) => marks.set(`${s.x},${s.y}`, s.result === "miss" ? "miss" : "hit"));
  const shipCells = new Set<string>();
  if (fleet) fleet.forEach((ship) => ship.cells.forEach((c) => shipCells.add(`${c.x},${c.y}`)));

  return (
    <div className="relative mx-auto" style={{ maxWidth: 340 }}>
      <div
        className="grid overflow-hidden rounded-xl border border-white/10"
        style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
      >
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, i) => {
          const x = i % BOARD_SIZE;
          const y = Math.floor(i / BOARD_SIZE);
          const key = `${x},${y}`;
          const mark = marks.get(key);
          const isShip = showShips && shipCells.has(key);
          return (
            <button
              key={key}
              type="button"
              disabled={!interactive || !!mark}
              onClick={() => onTap?.(x, y)}
              aria-label={`Cell ${x},${y}`}
              className="relative aspect-square border border-white/5"
              style={{
                background: isShip ? "transparent" : mark === "hit" ? "rgba(185,28,28,0.28)" : "linear-gradient(160deg, hsl(205 55% 22%), hsl(210 55% 14%))",
                cursor: interactive && !mark ? "pointer" : "default",
              }}
            >
              {!isShip && mark === "miss" && <span className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-white/70" />}
              {!isShip && mark === "hit" && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">✕</span>}
            </button>
          );
        })}
      </div>

      {showShips && fleet && (
        <svg viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`} className="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="bs-hull" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8fa3b3" />
              <stop offset="100%" stopColor="#4c5f6e" />
            </linearGradient>
          </defs>
          {fleet.map((ship) => (
            <ShipHull key={ship.id} ship={ship} />
          ))}
        </svg>
      )}
    </div>
  );
}
