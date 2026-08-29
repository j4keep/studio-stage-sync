import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MapPin, UserRound } from "lucide-react";
import { ageFromBirthYear, type MeetProfile } from "@/lib/meet";

type Props = {
  profile: MeetProfile;
  /** Mark the signed-in user's own card */
  isYou?: boolean;
};

function Cover({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground/50">
        <UserRound className="h-10 w-10" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/** Marketplace-style two-column Meet card — photo, name + age, city / looking for. */
export default function MeetProfileCard({ profile, isYou }: Props) {
  const nav = useNavigate();
  const cover = profile.photo_urls[0] ?? null;
  const age = ageFromBirthYear(profile.birth_year);
  const place = profile.city?.trim() || null;
  const looking = profile.looking_for?.trim() || null;

  return (
    <button
      type="button"
      onClick={() => nav(`/meet/u/${profile.user_id}`)}
      className="group w-full text-left"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted">
        <Cover src={cover} />
        {isYou && (
          <span className="absolute left-2 top-2 rounded-md bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
            You
          </span>
        )}
        {profile.open_to_interview && !isYou && (
          <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-primary shadow-sm">
            <Heart className="h-3.5 w-3.5 fill-current" />
          </span>
        )}
        {profile.photo_urls.length > 1 && (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-white">
            {profile.photo_urls.length} photos
          </span>
        )}
      </div>
      <div className="mt-1.5 space-y-0.5 px-0.5">
        <p className="line-clamp-1 text-[13px] font-semibold leading-snug text-foreground">
          {profile.display_name}
          {age != null ? (
            <span className="font-medium text-muted-foreground">, {age}</span>
          ) : null}
        </p>
        {(looking || place) && (
          <p className="line-clamp-1 text-[12px] text-muted-foreground">
            {looking && <span className="font-semibold text-foreground/90">{looking}</span>}
            {looking && place && <span className="mx-1">·</span>}
            {place && (
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="inline h-3 w-3 shrink-0 opacity-70" />
                {place}
              </span>
            )}
          </p>
        )}
        {profile.headline && (
          <p className="line-clamp-1 text-[11px] text-muted-foreground">{profile.headline}</p>
        )}
      </div>
    </button>
  );
}

export function MeetProfileCardSkeleton() {
  return (
    <div>
      <div className="aspect-[4/5] animate-pulse rounded-xl bg-muted" />
      <div className="mt-2 space-y-1.5 px-0.5">
        <div className="h-3.5 w-3/5 animate-pulse rounded bg-muted" />
        <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
