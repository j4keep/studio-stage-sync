import { Board } from "@/lib/tic-tac-toe";
import { cn } from "@/lib/utils";

type Props = {
  board: Board;
  line: number[] | null;
  disabled: boolean;
  onPlay: (index: number) => void;
  invalid: number | null;
};

function Mark({ value, win }: { value: "X" | "O"; win: boolean }) {
  const color = win ? "#f7e2a0" : value === "X" ? "hsl(var(--primary))" : "#7de0a6";
  return (
    <svg viewBox="0 0 100 100" className="h-[62%] w-[62%]" style={{ filter: `drop-shadow(0 0 10px ${color}66)` }}>
      {value === "X" ? (
        <g stroke={color} strokeWidth={12} strokeLinecap="round" fill="none">
          <line x1={22} y1={22} x2={78} y2={78} className="ttt-stroke" style={{ strokeDasharray: 100, strokeDashoffset: 100 }} />
          <line
            x1={78}
            y1={22}
            x2={22}
            y2={78}
            className="ttt-stroke"
            style={{ strokeDasharray: 100, strokeDashoffset: 100, animationDelay: "0.12s" }}
          />
        </g>
      ) : (
        <circle
          cx={50}
          cy={50}
          r={28}
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          fill="none"
          className="ttt-stroke"
          style={{ strokeDasharray: 180, strokeDashoffset: 180 }}
        />
      )}
    </svg>
  );
}

/** Glass grid board with animated stroke-drawn marks and a highlighted winning line. */
export default function TicTacToeBoard({ board, line, disabled, onPlay, invalid }: Props) {
  return (
    <div
      className="mx-auto w-full max-w-[340px] rounded-[26px] border border-white/10 p-3"
      style={{
        background: "linear-gradient(160deg, hsl(232 40% 16%), hsl(234 45% 9%))",
        boxShadow: "0 24px 50px -20px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      <div className="grid grid-cols-3 gap-2">
        {board.map((cell, i) => {
          const win = Boolean(line?.includes(i));
          return (
            <button
              key={i}
              type="button"
              disabled={disabled || cell !== null}
              onClick={() => onPlay(i)}
              aria-label={`Square ${i + 1}`}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-2xl border transition duration-200",
                win ? "border-[#f7e2a0]/70" : "border-white/10",
                !cell && !disabled && "active:scale-[0.95] hover:border-primary/50",
                invalid === i && "ttt-shake",
                "disabled:opacity-100",
              )}
              style={{
                background: win
                  ? "linear-gradient(160deg, rgba(247,226,160,0.22), rgba(247,226,160,0.06))"
                  : "linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))",
                boxShadow: win
                  ? "0 0 22px rgba(247,226,160,0.35), inset 0 1px 0 rgba(255,255,255,0.12)"
                  : "inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              {cell && <Mark value={cell as "X" | "O"} win={win} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
