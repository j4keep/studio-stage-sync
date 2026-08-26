/** Camera create modes. `post` is the short/hold recorder (formerly labeled REEL). */
export type CreateMode = "post" | "live";

export const CREATE_MODES: { id: CreateMode; label: string }[] = [
  { id: "post", label: "POST" },
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
export type AppearanceToolId = (typeof APPEARANCE_TOOLS)[number]["id"];

export const MAKEUP_PRESETS: readonly {
  id: string;
  label: string;
  lip: string;
  blush: string;
  preview: string;
}[] = [
  { id: "after-party", label: "After Party", lip: "rgba(160,45,70,0.5)", blush: "rgba(210,120,140,0.24)", preview: "linear-gradient(135deg,#ff8fab,#c9184a)" },
  { id: "defined", label: "Defined", lip: "rgba(120,40,55,0.52)", blush: "rgba(180,110,120,0.22)", preview: "linear-gradient(135deg,#9d0208,#6a040f)" },
  { id: "fairy-veil", label: "Fairy Veil", lip: "rgba(230,140,170,0.42)", blush: "rgba(250,190,210,0.26)", preview: "linear-gradient(135deg,#ffc2d1,#ff8fab)" },
  { id: "dusty-cherry", label: "Dusty Cherry", lip: "rgba(170,70,90,0.48)", blush: "rgba(200,130,145,0.24)", preview: "linear-gradient(135deg,#c1121f,#780000)" },
  { id: "soft-natural", label: "Soft Natural", lip: "rgba(200,120,110,0.4)", blush: "rgba(230,170,150,0.22)", preview: "linear-gradient(135deg,#ffcdb2,#e5989b)" },
  { id: "indigo-pop", label: "Indigo Pop", lip: "rgba(90,50,140,0.45)", blush: "rgba(160,130,200,0.22)", preview: "linear-gradient(135deg,#7b2cbf,#c77dff)" },
];

export const FILTER_PRESETS: readonly {
  id: string;
  label: string;
  filter: string;
  preview: string;
}[] = [
  { id: "peach", label: "Peach", filter: "saturate(1.2) brightness(1.08) contrast(1.05) sepia(0.15)", preview: "linear-gradient(135deg,#ffcdb2,#ff9f7a)" },
  { id: "movie", label: "Movie", filter: "contrast(1.2) saturate(0.9) brightness(0.95)", preview: "linear-gradient(135deg,#141e30,#243b55)" },
  { id: "youth", label: "Youth", filter: "brightness(1.12) contrast(1.05) saturate(1.15) blur(0.35px)", preview: "linear-gradient(135deg,#fff1eb,#ace0f9)" },
  { id: "vintage", label: "Vintage", filter: "sepia(0.35) contrast(1.1) saturate(1.1)", preview: "linear-gradient(135deg,#c2b280,#8b7355)" },
  { id: "amber", label: "Amber", filter: "sepia(0.25) saturate(1.35) hue-rotate(-12deg) brightness(1.05)", preview: "linear-gradient(135deg,#ffb703,#fb8500)" },
  { id: "holiday", label: "Holiday", filter: "saturate(1.4) contrast(1.12) brightness(1.06)", preview: "linear-gradient(135deg,#ef233c,#ffd166)" },
  { id: "brew", label: "Brew", filter: "sepia(0.45) contrast(1.15) brightness(0.92) saturate(1.2)", preview: "linear-gradient(135deg,#3c2a21,#8b5e3c)" },
];

export type EnhanceSettings = {
  /** Enhance → Filters preset id, or null for none. */
  filterId: string | null;
  filterIntensity: number; // 0-100
  smooth: number;
  shape: number;
  eye: number;
  makeupId: string | null;
};

export const DEFAULT_ENHANCE: EnhanceSettings = {
  filterId: null,
  filterIntensity: 80,
  smooth: 0,
  shape: 0,
  eye: 0,
  makeupId: null,
};

export function isEnhanceActive(s: EnhanceSettings): boolean {
  return (
    (!!s.filterId && s.filterIntensity > 0) ||
    s.smooth > 0 ||
    s.shape > 0 ||
    s.eye > 0 ||
    !!s.makeupId
  );
}

export function getEnhanceFilterCss(id: string | null | undefined): string {
  if (!id) return "none";
  return FILTER_PRESETS.find((f) => f.id === id)?.filter || "none";
}

/** One-tap Optimize: gentle smooth + eye brighten + Youth filter. */
export function optimizeEnhanceSettings(): EnhanceSettings {
  return {
    filterId: "youth",
    filterIntensity: 70,
    smooth: 40,
    shape: 15,
    eye: 30,
    makeupId: null,
  };
}

export const EFFECT_CATEGORIES = [
  "Trending",
  "Retro",
  "Color",
  "Mood",
  "Cinematic",
  "Glow",
  "Party",
  "Dream",
] as const;

/**
 * TikTok/Instagram-style visual effects.
 * `filter` is a CSS filter string applied live to <video>/<img>. `preview` is a
 * gradient/color background used to render the icon thumbnail in the picker.
 */
export interface VisualEffect {
  id: string;
  label: string;
  category: (typeof EFFECT_CATEGORIES)[number];
  filter: string;
  preview: string;
}

export const EFFECT_ITEMS: readonly VisualEffect[] = [
  { id: "none", label: "None", category: "Trending", filter: "none", preview: "linear-gradient(135deg,#222,#444)" },
  { id: "beauty", label: "Beauty", category: "Trending", filter: "contrast(1.05) saturate(1.15) brightness(1.08) blur(0.3px)", preview: "linear-gradient(135deg,#ffd6e0,#ff9fb3)" },
  { id: "glow-up", label: "Glow Up", category: "Trending", filter: "brightness(1.15) contrast(1.1) saturate(1.25)", preview: "linear-gradient(135deg,#fff2b0,#ffb7c5)" },
  { id: "smooth", label: "Smooth", category: "Trending", filter: "contrast(0.95) brightness(1.05) blur(0.5px) saturate(1.1)", preview: "linear-gradient(135deg,#fde2e4,#fad2e1)" },
  { id: "hd", label: "HD Sharp", category: "Trending", filter: "contrast(1.2) saturate(1.15)", preview: "linear-gradient(135deg,#e0f7ff,#a0e0ff)" },
  { id: "clarity", label: "Clarity", category: "Trending", filter: "contrast(1.15) brightness(1.03) saturate(1.05)", preview: "linear-gradient(135deg,#f0f0f0,#c0c0c0)" },

  { id: "vhs", label: "VHS", category: "Retro", filter: "saturate(1.4) contrast(1.1) hue-rotate(-8deg) brightness(0.95)", preview: "linear-gradient(135deg,#7c2d12,#0c4a6e)" },
  { id: "film", label: "Film 35mm", category: "Retro", filter: "sepia(0.25) contrast(1.15) brightness(1.05) saturate(1.15)", preview: "linear-gradient(135deg,#c2b280,#8b7355)" },
  { id: "polaroid", label: "Polaroid", category: "Retro", filter: "sepia(0.4) contrast(0.9) brightness(1.1) saturate(1.2)", preview: "linear-gradient(135deg,#f5e6d3,#d4a574)" },
  { id: "70s", label: "70s", category: "Retro", filter: "sepia(0.5) saturate(1.5) hue-rotate(-15deg)", preview: "linear-gradient(135deg,#ff6b35,#f7c59f)" },
  { id: "80s-neon", label: "80s Neon", category: "Retro", filter: "saturate(1.8) contrast(1.2) hue-rotate(20deg)", preview: "linear-gradient(135deg,#ff00ff,#00ffff)" },
  { id: "y2k", label: "Y2K", category: "Retro", filter: "saturate(1.6) contrast(1.15) hue-rotate(-10deg) brightness(1.05)", preview: "linear-gradient(135deg,#ff69b4,#00bfff)" },

  { id: "bw", label: "B&W", category: "Color", filter: "grayscale(1) contrast(1.1)", preview: "linear-gradient(135deg,#000,#fff)" },
  { id: "sepia", label: "Sepia", category: "Color", filter: "sepia(1) contrast(1.05)", preview: "linear-gradient(135deg,#8b5a2b,#d4a574)" },
  { id: "vibrant", label: "Vibrant", category: "Color", filter: "saturate(1.6) contrast(1.1)", preview: "linear-gradient(135deg,#ff006e,#8338ec)" },
  { id: "muted", label: "Muted", category: "Color", filter: "saturate(0.6) contrast(0.95) brightness(1.02)", preview: "linear-gradient(135deg,#a8a8a8,#d3d3d3)" },
  { id: "cool", label: "Cool", category: "Color", filter: "hue-rotate(15deg) saturate(1.15) brightness(1.02)", preview: "linear-gradient(135deg,#4facfe,#00f2fe)" },
  { id: "warm", label: "Warm", category: "Color", filter: "hue-rotate(-15deg) saturate(1.2) brightness(1.05)", preview: "linear-gradient(135deg,#fa709a,#fee140)" },
  { id: "invert", label: "Invert", category: "Color", filter: "invert(1) hue-rotate(180deg)", preview: "linear-gradient(135deg,#0f0,#f0f)" },

  { id: "moody", label: "Moody", category: "Mood", filter: "contrast(1.25) brightness(0.9) saturate(0.85)", preview: "linear-gradient(135deg,#1a1a2e,#16213e)" },
  { id: "dreamy", label: "Dreamy", category: "Mood", filter: "brightness(1.1) contrast(0.9) saturate(1.15) blur(0.7px)", preview: "linear-gradient(135deg,#e0c3fc,#8ec5fc)" },
  { id: "midnight", label: "Midnight", category: "Mood", filter: "brightness(0.8) contrast(1.2) hue-rotate(220deg) saturate(1.1)", preview: "linear-gradient(135deg,#232526,#414345)" },
  { id: "sunset", label: "Sunset", category: "Mood", filter: "sepia(0.3) saturate(1.4) hue-rotate(-20deg) brightness(1.05)", preview: "linear-gradient(135deg,#ff512f,#f09819)" },

  { id: "cinematic", label: "Cinematic", category: "Cinematic", filter: "contrast(1.15) saturate(0.9) brightness(0.95)", preview: "linear-gradient(135deg,#141e30,#243b55)" },
  { id: "teal-orange", label: "Teal & Orange", category: "Cinematic", filter: "contrast(1.2) saturate(1.3) hue-rotate(-8deg)", preview: "linear-gradient(135deg,#008080,#ff8c00)" },
  { id: "noir", label: "Noir", category: "Cinematic", filter: "grayscale(0.85) contrast(1.35) brightness(0.9)", preview: "linear-gradient(135deg,#000,#333)" },
  { id: "bleach", label: "Bleach", category: "Cinematic", filter: "brightness(1.15) contrast(1.25) saturate(0.7)", preview: "linear-gradient(135deg,#e8e8e8,#b8b8b8)" },

  { id: "neon-glow", label: "Neon Glow", category: "Glow", filter: "saturate(1.7) contrast(1.25) brightness(1.1)", preview: "linear-gradient(135deg,#ff006e,#00f5ff)" },
  { id: "soft-glow", label: "Soft Glow", category: "Glow", filter: "brightness(1.15) blur(0.6px) saturate(1.1)", preview: "linear-gradient(135deg,#fbc2eb,#a6c1ee)" },
  { id: "sparkle", label: "Sparkle", category: "Glow", filter: "brightness(1.2) contrast(1.15) saturate(1.3)", preview: "linear-gradient(135deg,#ffe259,#ffa751)" },
  { id: "gold", label: "Gold", category: "Glow", filter: "sepia(0.6) saturate(1.5) brightness(1.1) hue-rotate(-10deg)", preview: "linear-gradient(135deg,#ffd700,#ff8c00)" },

  { id: "party", label: "Party", category: "Party", filter: "saturate(2) contrast(1.2) hue-rotate(30deg)", preview: "linear-gradient(135deg,#ee0979,#ff6a00)" },
  { id: "disco", label: "Disco", category: "Party", filter: "saturate(1.8) hue-rotate(-25deg) contrast(1.15)", preview: "linear-gradient(135deg,#f7ff00,#db36a4)" },
  { id: "rainbow", label: "Rainbow", category: "Party", filter: "saturate(1.7) hue-rotate(45deg)", preview: "linear-gradient(135deg,#ff0080,#ff8c00,#40e0d0)" },
  { id: "bling", label: "Bling", category: "Party", filter: "brightness(1.2) contrast(1.15) saturate(1.5)", preview: "linear-gradient(135deg,#c471f5,#fa71cd)" },

  { id: "anime", label: "Anime", category: "Dream", filter: "saturate(1.5) contrast(1.15) brightness(1.08)", preview: "linear-gradient(135deg,#ffafbd,#ffc3a0)" },
  { id: "pastel", label: "Pastel", category: "Dream", filter: "saturate(0.85) brightness(1.12) contrast(0.95)", preview: "linear-gradient(135deg,#fbc2eb,#a1c4fd)" },
  { id: "cotton-candy", label: "Cotton Candy", category: "Dream", filter: "saturate(1.3) brightness(1.15) contrast(0.9) hue-rotate(-5deg)", preview: "linear-gradient(135deg,#ffdde1,#ee9ca7)" },
  { id: "aura", label: "Aura", category: "Dream", filter: "saturate(1.4) hue-rotate(25deg) brightness(1.08)", preview: "linear-gradient(135deg,#c471ed,#12c2e9)" },
] as const;

export const getEffectFilter = (id: string | undefined | null): string => {
  if (!id || id === "none") return "none";
  return EFFECT_ITEMS.find((e) => e.id === id)?.filter || "none";
};

export const TEMPLATE_ITEMS = [
  { id: "travel-dump", title: "Travel Dump", clips: 25, uses: "539.2K" },
  { id: "world-cup", title: "World Cup 2026", clips: 2, uses: "561" },
  { id: "viral-hook", title: "Viral Hook", clips: 3, uses: "12.4K" },
  { id: "game-day", title: "Game Day", clips: 4, uses: "8.1K" },
] as const;
