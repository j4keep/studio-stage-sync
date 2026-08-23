import { useNavigate } from "react-router-dom";
import { Lock, Users } from "lucide-react";
import { Circle, CIRCLE_TYPE_META } from "@/lib/circles";

type Props = {
  circle: Circle;
  className?: string;
};

export default function CircleCard({ circle, className }: Props) {
  const navigate = useNavigate();
  const meta = CIRCLE_TYPE_META[circle.type];

  return (
    <button
      type="button"
      onClick={() => navigate(`/circle/c/${circle.id}`)}
      className={`shrink-0 overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition active:scale-[0.98] ${className ?? "w-40"}`}
    >
      <div className="relative aspect-[4/3] w-full bg-muted">
        {circle.cover_url ? (
          <img src={circle.cover_url} alt={circle.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl">{meta.emoji}</div>
        )}
        <div className="absolute left-1.5 top-1.5 flex gap-1">
          {circle.is_private && (
            <span className="flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
              <Lock className="h-2.5 w-2.5" /> Private
            </span>
          )}
          {circle.is_paid && (
            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-black text-white">
              ${(circle.price_cents ?? 0) / 100}/mo
            </span>
          )}
        </div>
      </div>
      <div className="p-2.5">
        <p className="truncate text-[12.5px] font-bold">{circle.name}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-muted-foreground">
          <Users className="h-3 w-3" /> {circle.member_count} {circle.member_count === 1 ? "member" : "members"}
        </p>
      </div>
    </button>
  );
}
