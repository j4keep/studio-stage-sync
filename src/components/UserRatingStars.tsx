import { Star } from "lucide-react";
import { resolveDisplayRating, type DisplayRating } from "@/lib/ratings";

type Props = {
  average?: number | null;
  count?: number | null;
  rating?: DisplayRating | null;
  className?: string;
  /** compact = single star + number; full = 5-star row */
  variant?: "compact" | "full";
};

/** Facebook Marketplace–style stars under a name. Defaults to 5.0 until real ratings exist. */
export default function UserRatingStars({ average, count, rating, className = "", variant = "compact" }: Props) {
  const display = rating || resolveDisplayRating(average, count);
  const filled = Math.round(display.average);

  if (variant === "full") {
    return (
      <div className={`flex items-center gap-1.5 ${className}`} title={display.isDefault ? "New on YAJ — starter rating" : `${display.count} ratings`}>
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={`h-3.5 w-3.5 ${n <= filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
            />
          ))}
        </div>
        <span className="text-[11px] font-semibold tabular-nums text-foreground">{display.average.toFixed(1)}</span>
        {!display.isDefault && (
          <span className="text-[11px] text-muted-foreground">({display.count})</span>
        )}
      </div>
    );
  }

  return (
    <p
      className={`flex items-center gap-1 text-[11px] font-semibold tabular-nums text-amber-700 dark:text-amber-400 ${className}`}
      title={display.isDefault ? "New on YAJ — starter rating" : `${display.count} ratings`}
    >
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
      {display.average.toFixed(1)}
      {!display.isDefault && <span className="font-normal text-muted-foreground">({display.count})</span>}
    </p>
  );
}
