import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  avatarUrl?: string | null;
  isComputer?: boolean;
  badge?: string;
  count: number;
  countLabel: string;
  active?: boolean;
  activeLabel?: string;
};

export default function PlayerStrip({
  name,
  avatarUrl,
  isComputer,
  badge,
  count,
  countLabel,
  active,
  activeLabel,
}: Props) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3 transition-colors",
        active ? "border-primary/60 bg-primary/10" : "border-border/60 bg-card/60",
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2",
          active ? "border-primary" : "border-border",
        )}
        style={active ? { boxShadow: "0 0 14px hsl(var(--primary) / 0.5)" } : undefined}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
        ) : isComputer ? (
          <Bot className="h-6 w-6 text-primary" />
        ) : (
          <span className="text-sm font-black">{name.slice(0, 1).toUpperCase()}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black">{name}</p>
        <div className="mt-0.5 flex items-center gap-2">
          {badge && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-primary">
              {badge}
            </span>
          )}
          {active && activeLabel && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {activeLabel}
            </span>
          )}
        </div>
      </div>

      <div className="text-right">
        <p className="text-xl font-black leading-none text-primary">{count}</p>
        <p className="text-[10px] text-muted-foreground">{countLabel}</p>
      </div>
    </div>
  );
}
