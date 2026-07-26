import { EyeOff, Eye, Star } from "lucide-react";

export type GigProfileInfo = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type Props = {
  label: string;
  profile: GigProfileInfo | null | undefined;
  /** When true, name + photo only — no link to full YAJ page */
  hideYajPage: boolean;
  /** Average rating under the name (after completed gigs) */
  ratingAvg?: number | null;
  ratingCount?: number | null;
  onToggleHide?: (hide: boolean) => void;
  toggleLabel?: string;
  onOpenProfile?: () => void;
  className?: string;
};

/** Compact gig identity card — name + photo, optional hide-YAJ-page control. */
export default function GigProfileCard({
  label,
  profile,
  hideYajPage,
  ratingAvg,
  ratingCount,
  onToggleHide,
  toggleLabel = "Hide my YAJ page — only show name & photo",
  onOpenProfile,
  className = "",
}: Props) {
  const name = profile?.display_name || "User";
  const canOpen = Boolean(onOpenProfile) && !hideYajPage;
  const showRating = ratingAvg != null && ratingAvg > 0;

  return (
    <div className={`rounded-2xl border border-border bg-card p-3 ${className}`}>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!canOpen}
          onClick={() => canOpen && onOpenProfile?.()}
          className={`flex min-w-0 flex-1 items-center gap-3 text-left ${canOpen ? "hover:opacity-90" : "cursor-default"}`}
        >
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                {name[0]?.toUpperCase() || "?"}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            {showRating ? (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {ratingAvg!.toFixed(1)}
                {ratingCount != null && ratingCount > 0 ? (
                  <span className="font-normal text-muted-foreground">({ratingCount})</span>
                ) : null}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {hideYajPage ? "Name & photo only" : canOpen ? "View YAJ page" : "YAJ profile"}
              </p>
            )}
          </div>
        </button>
      </div>

      {onToggleHide && (
        <button
          type="button"
          onClick={() => onToggleHide(!hideYajPage)}
          className={`mt-3 flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
            hideYajPage
              ? "border-primary/30 bg-primary/10"
              : "border-border bg-muted/50 hover:bg-muted"
          }`}
        >
          {hideYajPage ? (
            <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          ) : (
            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="text-[12px] leading-snug text-foreground">
            <span className="font-semibold">{hideYajPage ? "YAJ page hidden" : "YAJ page visible"}</span>
            <span className="mt-0.5 block text-muted-foreground">{toggleLabel}</span>
          </span>
        </button>
      )}
    </div>
  );
}
