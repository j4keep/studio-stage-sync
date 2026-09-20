import { Film, Mic2, Music, Sparkles, type LucideIcon } from "lucide-react";
import {
  effectiveCategory,
  type WheuatTvItem,
  type WheuatTvKind,
} from "./wheuatTvStore";

export const KIND_META: Record<WheuatTvKind, { label: string; Icon: LucideIcon }> = {
  podcast: { label: "Podcast", Icon: Mic2 },
  "short-film": { label: "Short Film", Icon: Film },
  "music-video": { label: "Music Video", Icon: Music },
};

/** Every value a viewer can pick from the category selector. */
export type CategorySelection =
  | "all"
  | "live-tv"
  | "featured"
  | "trending"
  | "new"
  | "short-films"
  | "podcasts"
  | "music-videos"
  | "documentaries"
  | "comedy"
  | "drama"
  | "lifestyle"
  | "interviews"
  | "creator-originals"
  | "recently-added"
  | "most-watched"
  | "highest-rated";

export const CATEGORY_LABELS: Record<CategorySelection, string> = {
  all: "All",
  "live-tv": "Live TV",
  featured: "Featured",
  trending: "Trending",
  new: "New",
  "short-films": "Short Films",
  podcasts: "Podcasts",
  "music-videos": "Music Videos",
  documentaries: "Documentaries",
  comedy: "Comedy",
  drama: "Drama",
  lifestyle: "Lifestyle",
  interviews: "Interviews",
  "creator-originals": "Creator Originals",
  "recently-added": "Recently Added",
  "most-watched": "Most Watched",
  "highest-rated": "Highest Rated",
};

export const CATEGORY_MENU: CategorySelection[] = [
  "all",
  "live-tv",
  "featured",
  "trending",
  "new",
  "short-films",
  "podcasts",
  "music-videos",
  "documentaries",
  "comedy",
  "drama",
  "lifestyle",
  "interviews",
  "creator-originals",
  "recently-added",
  "most-watched",
  "highest-rated",
];

/** Rows shown top-to-bottom on the "All" home screen. */
export const HOME_SECTIONS: { key: CategorySelection; title: string }[] = [
  { key: "featured", title: "Featured" },
  { key: "trending", title: "Trending" },
  { key: "new", title: "New" },
  { key: "short-films", title: "Short Films" },
  { key: "podcasts", title: "Podcasts" },
  { key: "music-videos", title: "Music Videos" },
  { key: "documentaries", title: "Documentaries" },
  { key: "comedy", title: "Comedy" },
  { key: "drama", title: "Drama" },
  { key: "creator-originals", title: "Creator Originals" },
  { key: "recently-added", title: "Recently Added" },
  { key: "most-watched", title: "Most Watched" },
  { key: "highest-rated", title: "Highest Rated" },
];

/** Filter + sort the full catalog for one category selection. */
export function selectByCategory(items: WheuatTvItem[], key: CategorySelection): WheuatTvItem[] {
  switch (key) {
    case "all":
      return items;
    case "live-tv":
      // Live sessions aren't tv_posts rows — the Home page renders this selection
      // from a separate live-sessions fetch instead of calling this function.
      return [];
    case "featured":
      return items.filter((i) => i.isFeatured);
    case "trending":
      return items.filter((i) => i.isTrending);
    case "new":
      return [...items].sort((a, b) => (b.releaseDate ?? b.createdAt) - (a.releaseDate ?? a.createdAt)).slice(0, 20);
    case "recently-added":
      return [...items].sort((a, b) => b.createdAt - a.createdAt);
    case "most-watched":
      return [...items].sort((a, b) => b.views - a.views);
    case "highest-rated":
      return [...items]
        .filter((i) => i.rating != null)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "creator-originals":
      return items.filter((i) => i.isOriginal);
    default:
      return items.filter((i) => effectiveCategory(i) === key);
  }
}

export function formatRuntime(durationMs: number | null): string | null {
  if (!durationMs || durationMs <= 0) return null;
  const totalMinutes = Math.round(durationMs / 60000);
  if (totalMinutes < 1) return "<1m";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M views`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K views`;
  return `${views} view${views === 1 ? "" : "s"}`;
}

export const OriginalsIcon = Sparkles;
