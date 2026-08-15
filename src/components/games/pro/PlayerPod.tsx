import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  avatarUrl?: string | null;
  isComputer?: boolean;
  count: number;
  active?: boolean;
  className?: string;
};

/** Compact casino-table player pod: avatar medallion + name plate + tile counter. */
export default function PlayerPod({ name, avatarUrl, isComputer, count, active, className }: Props) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative shrink-0">
        <div
          className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full"
          style={{
            background: "linear-gradient(160deg, #f0d78c, #a5761f)",
            padding: 2,
            boxShadow: active
              ? "0 0 14px hsl(var(--primary) / 0.6), 0 2px 6px rgba(0,0,0,0.5)"
              : "0 2px 6px rgba(0,0,0,0.5)",
          }}
        >
          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#1d2b1f]">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
            ) : isComputer ? (
              <Bot className="h-5 w-5 text-[#f0d78c]" />
            ) : (
              <span className="text-sm font-black text-[#f0d78c]">{name.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
        </div>
        <span
          className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-[#3a2a06]"
          style={{ background: "linear-gradient(160deg, #f7e2a0, #c79a2c)", boxShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
        >
          {count}
        </span>
      </div>

      <div
        className="min-w-0 rounded-md px-2.5 py-1"
        style={{
          background: active
            ? "linear-gradient(180deg, hsl(var(--primary) / 0.75), hsl(var(--primary) / 0.45))"
            : "linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.35))",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
        }}
      >
        <p className="truncate text-[11px] font-black leading-tight text-white">{name}</p>
        <p className="text-[9px] font-bold uppercase tracking-wide text-white/65">{count} tiles</p>
      </div>
    </div>
  );
}
