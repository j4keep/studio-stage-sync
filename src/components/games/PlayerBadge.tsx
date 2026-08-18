import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export type ArenaPlayer = {
  name: string;
  avatarUrl?: string | null;
  isComputer?: boolean;
  /** Small badge under the name — score, piece colour, symbol, etc. */
  meta?: string;
};

type Props = ArenaPlayer & {
  active?: boolean;
  align?: "left" | "right";
  className?: string;
};

/** Avatar medallion + name plate used across the mini-game arenas. */
export default function PlayerBadge({ name, avatarUrl, isComputer, meta, active, align = "left", className }: Props) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 transition-transform duration-300",
        align === "right" && "flex-row-reverse text-right",
        active && "scale-[1.03]",
        className,
      )}
    >
      <div className="relative shrink-0">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center overflow-hidden rounded-full p-[2px] transition-shadow duration-300",
            active ? "bg-primary" : "bg-white/15",
          )}
          style={
            active
              ? { boxShadow: "0 0 16px hsl(var(--primary) / 0.65), 0 2px 6px rgba(0,0,0,0.5)" }
              : { boxShadow: "0 2px 6px rgba(0,0,0,0.45)" }
          }
        >
          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[hsl(230_30%_12%)]">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
            ) : isComputer ? (
              <Bot className="h-5 w-5 text-primary" />
            ) : (
              <span className="text-sm font-black text-primary">{name.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
        </div>
        {active && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[hsl(230_30%_10%)] bg-primary pulse" />
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate text-[12px] font-black leading-tight text-white">{name}</p>
        {meta && <p className="truncate text-[10px] font-bold uppercase tracking-wide text-white/60">{meta}</p>}
      </div>
    </div>
  );
}
