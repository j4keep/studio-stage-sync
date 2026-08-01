/**
 * YAJ Wellness ambient library — royalty-free sources only.
 *
 * - Mixkit SFX: free commercial use under the Mixkit License
 *   (https://mixkit.co/license/#sfxFree)
 * - Procedural noise: generated on-device (no third-party audio)
 *
 * Drop local MP3s later under public/audio/{category}/ and set `localPath`.
 */

export type AmbientCategory = "sleep" | "relax" | "meditation" | "focus" | "deep";

export type AmbientSource =
  | { kind: "mixkit"; id: number }
  | { kind: "procedural"; recipe: ProceduralRecipe }
  | { kind: "local"; path: string };

export type ProceduralRecipe =
  | "white"
  | "pink"
  | "brown"
  | "fan"
  | "rain"
  | "ocean"
  | "nature";

export type AmbientTrack = {
  id: string;
  title: string;
  blurb: string;
  category: AmbientCategory;
  /** Display duration label (looping). */
  durationLabel: string;
  source: AmbientSource;
  /** Gradient art for player / cards */
  art: string;
  /** Optional layers users can blend in the mixer (other track ids). */
  mixWith?: string[];
  tags?: string[];
};

export const AMBIENT_CATEGORIES: {
  id: AmbientCategory;
  label: string;
  emoji: string;
}[] = [
  { id: "sleep", label: "Sleep", emoji: "🌙" },
  { id: "relax", label: "Relax", emoji: "🌿" },
  { id: "meditation", label: "Meditation", emoji: "🧘" },
  { id: "focus", label: "Focus", emoji: "🎯" },
  { id: "deep", label: "Deep Sleep", emoji: "😴" },
];

/** Mixable layer chips in the player. */
export const AMBIENT_MIX_LAYERS: { id: string; label: string }[] = [
  { id: "heavy-rain", label: "Rain" },
  { id: "distant-thunder", label: "Thunder" },
  { id: "crackling-fireplace", label: "Fireplace" },
  { id: "wind-through-trees", label: "Wind" },
  { id: "forest-birds", label: "Birds" },
  { id: "brown-noise", label: "Brown noise" },
];

function mixkit(id: number): AmbientSource {
  return { kind: "mixkit", id };
}

function procedural(recipe: ProceduralRecipe): AmbientSource {
  return { kind: "procedural", recipe };
}

export function mixkitUrl(id: number): string {
  return `https://assets.mixkit.co/active_storage/sfx/${id}/${id}-preview.mp3`;
}

export function resolveAmbientUrl(source: AmbientSource): string | null {
  if (source.kind === "mixkit") return mixkitUrl(source.id);
  if (source.kind === "local") return source.path;
  return null;
}

/**
 * Curated starter library (~50). Prefer Mixkit loops; noise stays procedural.
 * Legacy Sleep ids (rain/ocean/fan/white/nature) are aliased below.
 */
export const AMBIENT_TRACKS: AmbientTrack[] = [
  // —— Sleep (10) ——
  {
    id: "heavy-rain",
    title: "Heavy Rain",
    blurb: "Steady downpour for deep rest",
    category: "sleep",
    durationLabel: "60 min · Loop",
    source: mixkit(2403),
    art: "from-slate-900 via-sky-950 to-indigo-950",
    mixWith: ["distant-thunder", "brown-noise"],
    tags: ["rain", "sleep"],
  },
  {
    id: "rain-window",
    title: "Rain on Window",
    blurb: "Soft rain against glass",
    category: "sleep",
    durationLabel: "60 min · Loop",
    source: mixkit(1248),
    art: "from-slate-900 via-blue-950 to-cyan-950",
    mixWith: ["distant-thunder"],
  },
  {
    id: "distant-thunder",
    title: "Distant Thunderstorm",
    blurb: "Rolling thunder with rain",
    category: "sleep",
    durationLabel: "60 min · Loop",
    source: mixkit(2402),
    art: "from-indigo-950 via-slate-900 to-violet-950",
    mixWith: ["heavy-rain", "wind-through-trees"],
  },
  {
    id: "ocean-night",
    title: "Ocean Waves at Night",
    blurb: "Calm shoreline wash",
    category: "sleep",
    durationLabel: "60 min · Loop",
    source: mixkit(1196),
    art: "from-slate-950 via-cyan-950 to-teal-950",
  },
  {
    id: "forest-rain",
    title: "Forest Rain",
    blurb: "Rain under the canopy",
    category: "sleep",
    durationLabel: "60 min · Loop",
    source: mixkit(1225),
    art: "from-emerald-950 via-slate-900 to-teal-950",
    mixWith: ["forest-birds"],
  },
  {
    id: "crackling-fireplace",
    title: "Crackling Fireplace",
    blurb: "Warm fire crackles",
    category: "sleep",
    durationLabel: "60 min · Loop",
    source: mixkit(1330),
    art: "from-orange-950 via-amber-950 to-stone-950",
    mixWith: ["heavy-rain", "wind-through-trees"],
  },
  {
    id: "white-noise",
    title: "White Noise",
    blurb: "Even broadband hush",
    category: "sleep",
    durationLabel: "∞ · Loop",
    source: procedural("white"),
    art: "from-zinc-900 via-neutral-800 to-stone-900",
  },
  {
    id: "brown-noise",
    title: "Brown Noise",
    blurb: "Deep, soft rumble",
    category: "sleep",
    durationLabel: "∞ · Loop",
    source: procedural("brown"),
    art: "from-stone-950 via-amber-950 to-neutral-900",
  },
  {
    id: "pink-noise",
    title: "Pink Noise",
    blurb: "Balanced calm static",
    category: "sleep",
    durationLabel: "∞ · Loop",
    source: procedural("pink"),
    art: "from-rose-950 via-stone-900 to-fuchsia-950",
  },
  {
    id: "box-fan",
    title: "Box Fan",
    blurb: "Steady fan hum",
    category: "sleep",
    durationLabel: "∞ · Loop",
    source: procedural("fan"),
    art: "from-slate-900 via-zinc-800 to-sky-950",
  },

  // —— Relax (10) ——
  {
    id: "gentle-river",
    title: "Gentle River",
    blurb: "Soft flowing water",
    category: "relax",
    durationLabel: "45 min · Loop",
    source: mixkit(2454),
    art: "from-teal-950 via-cyan-900 to-emerald-950",
  },
  {
    id: "waterfall",
    title: "Waterfall",
    blurb: "Forest waterfall wash",
    category: "relax",
    durationLabel: "45 min · Loop",
    source: mixkit(2513),
    art: "from-cyan-950 via-sky-900 to-teal-950",
  },
  {
    id: "forest-birds",
    title: "Forest Birds",
    blurb: "Morning birdsong",
    category: "relax",
    durationLabel: "45 min · Loop",
    source: mixkit(1210),
    art: "from-emerald-900 via-lime-950 to-teal-950",
    mixWith: ["wind-through-trees", "gentle-river"],
  },
  {
    id: "wind-through-trees",
    title: "Wind Through Trees",
    blurb: "Soft forest breeze",
    category: "relax",
    durationLabel: "45 min · Loop",
    source: mixkit(2427),
    art: "from-lime-950 via-emerald-950 to-stone-900",
  },
  {
    id: "summer-crickets",
    title: "Summer Crickets",
    blurb: "Night insect chorus",
    category: "relax",
    durationLabel: "45 min · Loop",
    source: mixkit(1789),
    art: "from-violet-950 via-indigo-950 to-emerald-950",
  },
  {
    id: "mountain-stream",
    title: "Mountain Stream",
    blurb: "River and birds",
    category: "relax",
    durationLabel: "45 min · Loop",
    source: mixkit(2453),
    art: "from-sky-950 via-teal-900 to-cyan-950",
  },
  {
    id: "morning-nature",
    title: "Morning Nature",
    blurb: "Water, birds, soft air",
    category: "relax",
    durationLabel: "45 min · Loop",
    source: mixkit(61),
    art: "from-amber-950 via-emerald-900 to-sky-950",
  },
  {
    id: "tropical-jungle",
    title: "Tropical Jungle",
    blurb: "Rain and jungle birds",
    category: "relax",
    durationLabel: "45 min · Loop",
    source: mixkit(2392),
    art: "from-green-950 via-teal-900 to-lime-950",
  },
  {
    id: "gentle-breeze",
    title: "Gentle Breeze",
    blurb: "Wind blowing ambience",
    category: "relax",
    durationLabel: "45 min · Loop",
    source: mixkit(2658),
    art: "from-sky-900 via-slate-900 to-cyan-950",
  },
  {
    id: "european-forest",
    title: "Deep Forest",
    blurb: "Quiet woodland air",
    category: "relax",
    durationLabel: "45 min · Loop",
    source: mixkit(1213),
    art: "from-emerald-950 via-stone-900 to-green-950",
  },

  // —— Meditation (10) ——
  {
    id: "ocean-meditation",
    title: "Ocean Meditation",
    blurb: "Waves for breath focus",
    category: "meditation",
    durationLabel: "30 min · Loop",
    source: mixkit(1189),
    art: "from-indigo-950 via-cyan-950 to-slate-950",
  },
  {
    id: "zen-forest",
    title: "Zen Forest",
    blurb: "Still woods at dusk",
    category: "meditation",
    durationLabel: "30 min · Loop",
    source: mixkit(1235),
    art: "from-teal-950 via-emerald-950 to-stone-950",
  },
  {
    id: "night-forest-insects",
    title: "Zen Garden Night",
    blurb: "Night forest insects",
    category: "meditation",
    durationLabel: "30 min · Loop",
    source: mixkit(2414),
    art: "from-violet-950 via-emerald-950 to-indigo-950",
  },
  {
    id: "quiet-water",
    title: "Quiet Water",
    blurb: "Soft flowing loop",
    category: "meditation",
    durationLabel: "30 min · Loop",
    source: mixkit(3126),
    art: "from-cyan-950 via-slate-900 to-blue-950",
  },
  {
    id: "river-sunrise",
    title: "Breath by the River",
    blurb: "Sunrise river air",
    category: "meditation",
    durationLabel: "30 min · Loop",
    source: mixkit(2458),
    art: "from-orange-950 via-rose-950 to-sky-950",
  },
  {
    id: "spa-waterfall",
    title: "Spa Waterfall",
    blurb: "Woodland falls",
    category: "meditation",
    durationLabel: "30 min · Loop",
    source: mixkit(2517),
    art: "from-teal-900 via-cyan-950 to-emerald-950",
  },
  {
    id: "soft-pads-pink",
    title: "Soft Healing Pads",
    blurb: "Pink-noise bed for stillness",
    category: "meditation",
    durationLabel: "∞ · Loop",
    source: procedural("pink"),
    art: "from-fuchsia-950 via-violet-950 to-slate-950",
  },
  {
    id: "deep-drone-brown",
    title: "Deep Om Drone",
    blurb: "Low brown-noise drone",
    category: "meditation",
    durationLabel: "∞ · Loop",
    source: procedural("brown"),
    art: "from-stone-950 via-amber-950 to-violet-950",
  },
  {
    id: "calm-sea-birds",
    title: "Sea & Birds",
    blurb: "Waves with distant birds",
    category: "meditation",
    durationLabel: "30 min · Loop",
    source: mixkit(1185),
    art: "from-sky-950 via-teal-950 to-indigo-950",
  },
  {
    id: "light-rain-meditate",
    title: "Light Rain Stillness",
    blurb: "Gentle rain loop",
    category: "meditation",
    durationLabel: "30 min · Loop",
    source: mixkit(2393),
    art: "from-slate-950 via-blue-950 to-indigo-950",
  },

  // —— Focus (10) ——
  {
    id: "coffee-shop",
    title: "Coffee Shop",
    blurb: "Soft crowd murmur",
    category: "focus",
    durationLabel: "45 min · Loop",
    source: mixkit(444),
    art: "from-amber-950 via-orange-950 to-stone-900",
  },
  {
    id: "library-ambience",
    title: "Library Ambience",
    blurb: "Quiet room tone",
    category: "focus",
    durationLabel: "45 min · Loop",
    source: mixkit(447),
    art: "from-stone-900 via-amber-950 to-neutral-900",
  },
  {
    id: "soft-rain-keyboard",
    title: "Rain + Keyboard",
    blurb: "Light rain with typing bed",
    category: "focus",
    durationLabel: "45 min · Loop",
    source: mixkit(2393),
    art: "from-slate-900 via-sky-950 to-zinc-900",
    mixWith: ["keyboard-typing", "brown-noise"],
  },
  {
    id: "keyboard-typing",
    title: "Keyboard Typing",
    blurb: "Soft laptop typing",
    category: "focus",
    durationLabel: "45 min · Loop",
    source: mixkit(2531),
    art: "from-zinc-900 via-slate-800 to-neutral-900",
  },
  {
    id: "study-ambience",
    title: "Study Ambience",
    blurb: "Office background hum",
    category: "focus",
    durationLabel: "45 min · Loop",
    source: mixkit(447),
    art: "from-neutral-900 via-stone-800 to-amber-950",
  },
  {
    id: "wind-and-rain-focus",
    title: "Wind and Rain",
    blurb: "Soft storm for focus",
    category: "focus",
    durationLabel: "45 min · Loop",
    source: mixkit(2401),
    art: "from-indigo-950 via-slate-900 to-sky-950",
  },
  {
    id: "light-fireplace-focus",
    title: "Light Fireplace",
    blurb: "Quiet crackle",
    category: "focus",
    durationLabel: "45 min · Loop",
    source: mixkit(1329),
    art: "from-orange-950 via-stone-900 to-amber-950",
  },
  {
    id: "pink-focus",
    title: "Soft Focus Noise",
    blurb: "Pink noise for concentration",
    category: "focus",
    durationLabel: "∞ · Loop",
    source: procedural("pink"),
    art: "from-rose-950 via-zinc-900 to-violet-950",
  },
  {
    id: "urban-day",
    title: "Calm City Day",
    blurb: "Distant urban ambience",
    category: "focus",
    durationLabel: "45 min · Loop",
    source: mixkit(2505),
    art: "from-slate-900 via-zinc-800 to-sky-950",
  },
  {
    id: "park-soft",
    title: "Park Air",
    blurb: "Open outdoor air",
    category: "focus",
    durationLabel: "45 min · Loop",
    source: mixkit(2264),
    art: "from-emerald-950 via-lime-950 to-sky-950",
  },

  // —— Deep sleep & anxiety relief (10) ——
  {
    id: "ocean-storm",
    title: "Ocean Storm",
    blurb: "Rough sea for deep sleep",
    category: "deep",
    durationLabel: "60 min · Loop",
    source: mixkit(1194),
    art: "from-slate-950 via-blue-950 to-indigo-950",
  },
  {
    id: "cabin-rain",
    title: "Cabin in Rain",
    blurb: "Heavy rain on a roof",
    category: "deep",
    durationLabel: "60 min · Loop",
    source: mixkit(1265),
    art: "from-stone-950 via-sky-950 to-indigo-950",
    mixWith: ["crackling-fireplace", "distant-thunder"],
  },
  {
    id: "fireplace-rain",
    title: "Fireplace + Rain",
    blurb: "Campfire with night wind",
    category: "deep",
    durationLabel: "60 min · Loop",
    source: mixkit(1736),
    art: "from-orange-950 via-slate-950 to-sky-950",
    mixWith: ["heavy-rain", "crackling-fireplace"],
  },
  {
    id: "windy-snowstorm",
    title: "Windy Storm",
    blurb: "Strong wild wind",
    category: "deep",
    durationLabel: "60 min · Loop",
    source: mixkit(2407),
    art: "from-slate-950 via-cyan-950 to-zinc-900",
  },
  {
    id: "night-forest-deep",
    title: "Night Forest",
    blurb: "Dark woodland calm",
    category: "deep",
    durationLabel: "60 min · Loop",
    source: mixkit(2414),
    art: "from-emerald-950 via-violet-950 to-slate-950",
  },
  {
    id: "whale-ocean",
    title: "Deep Ocean",
    blurb: "Low sea wash",
    category: "deep",
    durationLabel: "60 min · Loop",
    source: mixkit(1202),
    art: "from-blue-950 via-indigo-950 to-slate-950",
  },
  {
    id: "deep-brown",
    title: "Deep Brown Noise",
    blurb: "Heavy brown-noise bed",
    category: "deep",
    durationLabel: "∞ · Loop",
    source: procedural("brown"),
    art: "from-neutral-950 via-stone-900 to-amber-950",
  },
  {
    id: "airplane-cabin",
    title: "Airplane Cabin",
    blurb: "Fan-like cabin hush",
    category: "deep",
    durationLabel: "∞ · Loop",
    source: procedural("fan"),
    art: "from-slate-900 via-sky-950 to-zinc-900",
  },
  {
    id: "train-rain",
    title: "Night Rain Journey",
    blurb: "Long rain ambience",
    category: "deep",
    durationLabel: "60 min · Loop",
    source: mixkit(1247),
    art: "from-indigo-950 via-slate-900 to-blue-950",
  },
  {
    id: "heartbeat-soft",
    title: "Soft Pulse Calm",
    blurb: "Gentle low pulse bed",
    category: "deep",
    durationLabel: "30 min · Loop",
    source: mixkit(492),
    art: "from-rose-950 via-stone-950 to-violet-950",
  },
];

/** Legacy Sleep page ids → new catalog ids */
export const LEGACY_SLEEP_SOUND_MAP: Record<string, string> = {
  rain: "heavy-rain",
  ocean: "ocean-night",
  fan: "box-fan",
  white: "white-noise",
  nature: "forest-birds",
};

export function getAmbientTrack(id: string | null | undefined): AmbientTrack | null {
  if (!id) return null;
  const mapped = LEGACY_SLEEP_SOUND_MAP[id] ?? id;
  return AMBIENT_TRACKS.find((t) => t.id === mapped) ?? null;
}

export function tracksForCategory(category: AmbientCategory | "all"): AmbientTrack[] {
  if (category === "all") return AMBIENT_TRACKS;
  return AMBIENT_TRACKS.filter((t) => t.category === category);
}
