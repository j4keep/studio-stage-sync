export type CreateMode = "post" | "create" | "live";

export const CREATE_MODES: { id: CreateMode; label: string }[] = [
  { id: "post", label: "QUICK" },
  { id: "create", label: "CREATE" },
  { id: "live", label: "LIVE" },
];

export const SHORT_DURATIONS = [15, 30, 60] as const;
export type ShortDuration = (typeof SHORT_DURATIONS)[number];

/** Quick tab: hold-to-record max length (seconds). */
export const QUICK_MAX_RECORD_SEC = 60;

export const QUICK_ALT_OPTIONS = [
  { id: "photo" as const, label: "Photo" },
  { id: "text" as const, label: "Text" },
];

export const TEMPLATE_CATEGORIES = [
  "For You",
  "Viral Songs",
  "Sports",
  "Trending",
  "All",
] as const;

export const CREATE_TOOLS = [
  { id: "ai-cast", label: "AI Cast" },
  { id: "photo-editor", label: "Photo editor" },
  { id: "autocut", label: "AutoCut" },
  { id: "ai-video", label: "AI Video" },
  { id: "ai-image", label: "AI Image" },
  { id: "captions", label: "Captions" },
] as const;

export const ENHANCE_TABS = ["Optimize", "Appearance", "Makeup", "Filters"] as const;
export type EnhanceTab = (typeof ENHANCE_TABS)[number];

export const APPEARANCE_TOOLS = [
  { id: "smooth", label: "Smooth" },
  { id: "shape", label: "Shape" },
  { id: "eye", label: "Eye" },
] as const;

export const MAKEUP_PRESETS = [
  "After Party",
  "Defined",
  "Fairy Veil",
  "Dusty Cherry",
  "Soft Natural",
  "Indigo Pop",
] as const;

export const FILTER_PRESETS = [
  "Peach",
  "Movie",
  "Youth",
  "Vintage",
  "Amber",
  "Holiday",
  "Brew",
] as const;

export const EFFECT_CATEGORIES = ["Trending", "Sports", "New", "Play", "Face", "Background"] as const;

export const EFFECT_ITEMS = [
  { id: "none", label: "None", category: "Trending" },
  { id: "beauty", label: "Beauty", category: "Trending" },
  { id: "green-screen", label: "Green Screen", category: "Background" },
  { id: "horns", label: "Blue Horns", category: "Face" },
  { id: "flowers", label: "Flowers", category: "New" },
  { id: "sports-fire", label: "Sports Fire", category: "Sports" },
] as const;

export const TEMPLATE_ITEMS = [
  { id: "travel-dump", title: "Travel Dump", clips: 25, uses: "539.2K" },
  { id: "world-cup", title: "World Cup 2026", clips: 2, uses: "561" },
  { id: "viral-hook", title: "Viral Hook", clips: 3, uses: "12.4K" },
  { id: "game-day", title: "Game Day", clips: 4, uses: "8.1K" },
] as const;
