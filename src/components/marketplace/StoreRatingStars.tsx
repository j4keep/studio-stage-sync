import { Star } from "lucide-react";
import type { DisplayRating } from "@/lib/ratings";

type Props = {
  rating: DisplayRating;
  size?: "sm" | "md";
  className?: string;
};

/** Star row + score used under a store name. Everyone starts at 5.0. */
export default function StoreRatingStars({ rating, size = "sm", className = "" }: Props) {
  const px = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const rounded = Math.round(rating.average);
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={`${px} ${n <= rounded ? "fill-amber-400 text-amber-400" : "text-muted-foreground/35"}`}
          />
        ))}
      </span>
      <span className="text-[12px] font-black">{rating.average.toFixed(1)}</span>
      <span className="text-[11.5px] text-muted-foreground">
        {rating.count > 0 ? `(${rating.count} rating${rating.count === 1 ? "" : "s"})` : "(new store)"}
      </span>
    </div>
  );
}
