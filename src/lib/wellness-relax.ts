import type { MoodId } from "@/lib/wellness";

/** Visual + copy identity for each breathing experience card. */
export type BreathVisualKind = "square" | "waves" | "leaves" | "stars";

export type BreathCardMeta = {
  emoji: string;
  kicker: string;
  tagline: string;
  rhythmLabel: string;
  level: string;
  /** Tailwind gradient classes (from-via-to) */
  gradient: string;
  accent: string;
  visual: BreathVisualKind;
  phaseHints: string[];
};

export const BREATH_CARD_META: Record<string, BreathCardMeta> = {
  box: {
    emoji: "🫁",
    kicker: "Box Breathing",
    tagline: "Calm your nervous system",
    rhythmLabel: "4 · 4 · 4 · 4 Rhythm",
    level: "Beginner",
    gradient: "from-[#043f3a] via-[#0a6b62] to-[#062a36]",
    accent: "rgba(45,212,191,0.55)",
    visual: "square",
    phaseHints: ["Breathe in.", "Hold.", "Exhale.", "Hold."],
  },
  calm: {
    emoji: "🌊",
    kicker: "Ocean Breath",
    tagline: "Slow, deep breathing",
    rhythmLabel: "4 · 1 · 6 Rhythm",
    level: "Gentle",
    gradient: "from-[#0a2744] via-[#1a5f8a] to-[#0c3d5c]",
    accent: "rgba(125,211,252,0.5)",
    visual: "waves",
    phaseHints: ["Breathe in.", "Soft pause.", "Long exhale."],
  },
  "reset-2": {
    emoji: "🌬",
    kicker: "Relax Breath",
    tagline: "Release tension",
    rhythmLabel: "3 · 1 · 5 Rhythm",
    level: "Quick",
    gradient: "from-[#1a3d28] via-[#2f6b45] to-[#163528]",
    accent: "rgba(134,239,172,0.45)",
    visual: "leaves",
    phaseHints: ["Breathe in.", "Release.", "Let go."],
  },
  "wind-down": {
    emoji: "🌙",
    kicker: "Bedtime Wind Down",
    tagline: "Drift toward rest",
    rhythmLabel: "4 · 2 · 6 Rhythm",
    level: "Evening",
    gradient: "from-[#1e1540] via-[#3b2769] to-[#120c28]",
    accent: "rgba(196,181,253,0.5)",
    visual: "stars",
    phaseHints: ["Breathe in.", "Hold.", "Slow exhale."],
  },
};

export type BreathAtmosphereId =
  | "rain"
  | "ocean"
  | "fireplace"
  | "forest"
  | "night"
  | "clouds";

export type BreathAtmosphere = {
  id: BreathAtmosphereId;
  emoji: string;
  label: string;
  trackId: string;
  backdrop: "rain" | "ocean" | "fireplace" | "forest" | "stars" | "clouds" | "aurora" | "sunrise";
};

export const BREATH_ATMOSPHERES: BreathAtmosphere[] = [
  { id: "rain", emoji: "🌧", label: "Rain", trackId: "heavy-rain", backdrop: "rain" },
  { id: "ocean", emoji: "🌊", label: "Ocean", trackId: "ocean-night", backdrop: "ocean" },
  { id: "fireplace", emoji: "🔥", label: "Fireplace", trackId: "crackling-fireplace", backdrop: "fireplace" },
  { id: "forest", emoji: "🌲", label: "Forest", trackId: "european-forest", backdrop: "forest" },
  { id: "night", emoji: "🌙", label: "Night", trackId: "night-forest-insects", backdrop: "stars" },
  { id: "clouds", emoji: "☁", label: "Clouds", trackId: "gentle-breeze", backdrop: "clouds" },
];

export const REFLECTION_PROMPTS: {
  id: string;
  emoji: string;
  eyebrow: string;
  prompt: string;
  cta: string;
  accent: string;
}[] = [
  {
    id: "went-well",
    emoji: "✨",
    eyebrow: "Tonight’s Reflection",
    prompt: "What are three things that went well today?",
    cta: "Start Reflection →",
    accent: "from-teal-900/80 via-emerald-950/70 to-[#0b1614]",
  },
  {
    id: "let-go",
    emoji: "🍃",
    eyebrow: "Let Go",
    prompt: "What’s one thing you don’t need to carry into tomorrow?",
    cta: "Write →",
    accent: "from-indigo-950/80 via-slate-950/60 to-[#0b1614]",
  },
];

/** Featured ambient tracks shown in the Relax sound browser. */
export const RELAX_SOUND_CARDS: {
  id: string;
  title: string;
  emoji: string;
}[] = [
  { id: "heavy-rain", title: "Rain", emoji: "🌧" },
  { id: "ocean-night", title: "Ocean", emoji: "🌊" },
  { id: "crackling-fireplace", title: "Fireplace", emoji: "🔥" },
  { id: "european-forest", title: "Forest", emoji: "🌲" },
  { id: "distant-thunder", title: "Thunderstorm", emoji: "🌩" },
  { id: "wind-through-trees", title: "Wind", emoji: "🍃" },
  { id: "forest-birds", title: "Birds", emoji: "🐦" },
  { id: "coffee-shop", title: "Coffee Shop", emoji: "☕" },
  { id: "library-ambience", title: "Library", emoji: "📖" },
  { id: "white-noise", title: "White Noise", emoji: "🤍" },
  { id: "brown-noise", title: "Brown Noise", emoji: "🤎" },
];

export type NarratedStep = {
  /** Spoken by YAJ */
  speak: string;
  /** On-screen instruction */
  text: string;
  /** Seconds to hold this step before advancing (after speech starts). */
  holdSeconds: number;
};

export type NarratedSession = {
  id: string;
  title: string;
  emoji: string;
  minutes: number;
  blurb: string;
  kind: "reset" | "technique";
  steps: NarratedStep[];
};

export const MENTAL_RESETS: NarratedSession[] = [
  {
    id: "clear-mind",
    title: "Clear My Mind",
    emoji: "🌤",
    minutes: 2,
    blurb: "A short release for racing thoughts.",
    kind: "reset",
    steps: [
      {
        speak: "Let's clear a little space. Soften your gaze, or close your eyes.",
        text: "Settle in. Soft gaze or eyes closed.",
        holdSeconds: 8,
      },
      {
        speak: "Take a slow breath in through the nose… and let it go.",
        text: "Slow breath in… and out.",
        holdSeconds: 10,
      },
      {
        speak: "Imagine placing today's thoughts on a shelf nearby. You can pick them up later.",
        text: "Set thoughts aside for later.",
        holdSeconds: 14,
      },
      {
        speak: "One more easy breath. You're doing enough for right now.",
        text: "One more easy breath.",
        holdSeconds: 10,
      },
    ],
  },
  {
    id: "calm-anxiety",
    title: "Calm Anxiety",
    emoji: "😌",
    minutes: 5,
    blurb: "Gentle grounding when nerves feel loud.",
    kind: "reset",
    steps: [
      {
        speak: "Anxiety can feel big. We'll keep this small and steady.",
        text: "Keep it small and steady.",
        holdSeconds: 10,
      },
      {
        speak: "Feel your feet on the floor. Press down gently. Notice the support.",
        text: "Feel your feet on the floor.",
        holdSeconds: 14,
      },
      {
        speak: "Breathe in for four… hold for two… out for six.",
        text: "In 4 · hold 2 · out 6",
        holdSeconds: 16,
      },
      {
        speak: "Name one thing you can see, and one thing you can hear.",
        text: "Name one sight · one sound.",
        holdSeconds: 16,
      },
      {
        speak: "You're safe in this moment. Stay with the next soft breath.",
        text: "Safe in this moment. Soft breath.",
        holdSeconds: 14,
      },
    ],
  },
  {
    id: "reduce-overthinking",
    title: "Reduce Overthinking",
    emoji: "🧠",
    minutes: 4,
    blurb: "Interrupt the loop without forcing silence.",
    kind: "reset",
    steps: [
      {
        speak: "Overthinking is your mind trying to help. We'll thank it and slow it down.",
        text: "Thank the mind. Slow it down.",
        holdSeconds: 12,
      },
      {
        speak: "Ask yourself: is this a problem I can solve in the next five minutes?",
        text: "Can I solve this in 5 minutes?",
        holdSeconds: 14,
      },
      {
        speak: "If not, gently say: not now. Return to your breath.",
        text: "Say: not now. Return to breath.",
        holdSeconds: 14,
      },
      {
        speak: "Two more easy breaths. Clarity often arrives after rest.",
        text: "Two easy breaths.",
        holdSeconds: 12,
      },
    ],
  },
  {
    id: "emotional-reset",
    title: "Emotional Reset",
    emoji: "💙",
    minutes: 3,
    blurb: "A soft reset when feelings feel heavy.",
    kind: "reset",
    steps: [
      {
        speak: "Whatever you're feeling is allowed here. No fixing — just noticing.",
        text: "Notice. No need to fix.",
        holdSeconds: 12,
      },
      {
        speak: "Place a hand on your chest if that feels okay. Feel the rise and fall.",
        text: "Hand on chest. Feel the rise and fall.",
        holdSeconds: 14,
      },
      {
        speak: "Whisper to yourself: I can take the next minute gently.",
        text: "I can take the next minute gently.",
        holdSeconds: 12,
      },
    ],
  },
  {
    id: "improve-focus",
    title: "Improve Focus",
    emoji: "🎯",
    minutes: 5,
    blurb: "Settle attention before your next task.",
    kind: "reset",
    steps: [
      {
        speak: "Let's gather your attention like collecting beads into one bowl.",
        text: "Gather your attention.",
        holdSeconds: 10,
      },
      {
        speak: "Choose one simple focus: the feeling of air at your nostrils.",
        text: "Focus on the breath at your nose.",
        holdSeconds: 16,
      },
      {
        speak: "When the mind wanders, notice, and return — that return is the practice.",
        text: "Wander → notice → return.",
        holdSeconds: 16,
      },
      {
        speak: "Name one next action. Just one. Then open your eyes when ready.",
        text: "Name one next action.",
        holdSeconds: 14,
      },
    ],
  },
];

export const RELAX_TECHNIQUES: NarratedSession[] = [
  {
    id: "pmr",
    title: "Progressive Muscle Relaxation",
    emoji: "💆",
    minutes: 6,
    blurb: "Tense and release to let the body soften.",
    kind: "technique",
    steps: [
      {
        speak: "We'll gently tense and release. Never force — stop if anything hurts.",
        text: "Gentle tense & release. Stop if it hurts.",
        holdSeconds: 10,
      },
      {
        speak: "Squeeze your fists for five seconds… and release. Notice the difference.",
        text: "Fists: squeeze 5 · release",
        holdSeconds: 12,
      },
      {
        speak: "Shrug your shoulders up… hold… and drop them down.",
        text: "Shoulders: shrug · drop",
        holdSeconds: 12,
      },
      {
        speak: "Press your feet into the floor… then soften completely.",
        text: "Feet press · then soften",
        holdSeconds: 12,
      },
      {
        speak: "Scan from head to toe. Let everything be a little heavier.",
        text: "Head-to-toe soften",
        holdSeconds: 14,
      },
    ],
  },
  {
    id: "grounding",
    title: "Grounding (5-4-3-2-1)",
    emoji: "🌍",
    minutes: 4,
    blurb: "Come back to the senses when you feel floaty.",
    kind: "technique",
    steps: [
      {
        speak: "Look around and name five things you can see.",
        text: "5 things you can see",
        holdSeconds: 16,
      },
      {
        speak: "Name four things you can feel — clothes, chair, air, floor.",
        text: "4 things you can feel",
        holdSeconds: 14,
      },
      {
        speak: "Name three sounds you notice right now.",
        text: "3 sounds you hear",
        holdSeconds: 12,
      },
      {
        speak: "Name two scents, or simply notice the air.",
        text: "2 scents (or the air)",
        holdSeconds: 10,
      },
      {
        speak: "Name one taste, or take a sip of water if you have it.",
        text: "1 taste",
        holdSeconds: 10,
      },
    ],
  },
  {
    id: "body-scan",
    title: "Body Scan",
    emoji: "🧘",
    minutes: 5,
    blurb: "Move attention slowly through the body.",
    kind: "technique",
    steps: [
      {
        speak: "Start at the crown of your head. Soften the forehead and jaw.",
        text: "Crown · forehead · jaw",
        holdSeconds: 14,
      },
      {
        speak: "Notice your neck and shoulders. Let them drop a millimeter.",
        text: "Neck & shoulders soften",
        holdSeconds: 12,
      },
      {
        speak: "Feel the chest and belly rising with each breath.",
        text: "Chest & belly with the breath",
        holdSeconds: 14,
      },
      {
        speak: "Scan the hips, legs, and feet. Rest into the support beneath you.",
        text: "Hips · legs · feet · rest",
        holdSeconds: 14,
      },
    ],
  },
  {
    id: "visualization",
    title: "Visualization",
    emoji: "🌅",
    minutes: 4,
    blurb: "A calm place you can visit anytime.",
    kind: "technique",
    steps: [
      {
        speak: "Picture a place that feels safe — real or imagined.",
        text: "Picture a safe place",
        holdSeconds: 12,
      },
      {
        speak: "Add one sound, one color, and one feeling of temperature.",
        text: "Add sound · color · temperature",
        holdSeconds: 14,
      },
      {
        speak: "Stay there for a few breaths. Know you can return whenever you need.",
        text: "Stay for a few breaths",
        holdSeconds: 16,
      },
    ],
  },
  {
    id: "affirmations",
    title: "Positive Affirmations",
    emoji: "✨",
    minutes: 3,
    blurb: "Kind words, spoken slowly with YAJ.",
    kind: "technique",
    steps: [
      {
        speak: "Repeat after me, silently or out loud: I am allowed to rest.",
        text: "I am allowed to rest.",
        holdSeconds: 12,
      },
      {
        speak: "I can take things one step at a time.",
        text: "One step at a time.",
        holdSeconds: 12,
      },
      {
        speak: "I am doing my best, and that is enough for today.",
        text: "My best is enough for today.",
        holdSeconds: 12,
      },
    ],
  },
  {
    id: "mindful-listening",
    title: "Mindful Listening",
    emoji: "🎧",
    minutes: 3,
    blurb: "Widen awareness through sound alone.",
    kind: "technique",
    steps: [
      {
        speak: "Close your eyes if you like. Listen for the farthest sound you can hear.",
        text: "Listen for the farthest sound",
        holdSeconds: 14,
      },
      {
        speak: "Now notice the closest sound — maybe your own breath.",
        text: "Notice the closest sound",
        holdSeconds: 12,
      },
      {
        speak: "Hold both at once for a moment. Then return to the room.",
        text: "Hold both · return to the room",
        holdSeconds: 12,
      },
    ],
  },
];

const QUOTES = [
  "Peace is not the absence of noise — it's the presence of calm within it.",
  "You don't have to finish today. You only have to be here for this breath.",
  "Rest is not a reward for finishing. Rest is how you continue.",
  "Softness is a strength your nervous system understands.",
  "Let the next minute be kinder than the last.",
  "Nothing urgent can outrank your ability to breathe.",
  "A quiet mind is not empty — it is spacious.",
  "You are allowed to pause without explaining why.",
  "Calm is practiced, not performed.",
  "Return to yourself as often as you need.",
  "The body keeps the score — and also keeps the stillness.",
  "Tiny resets still count.",
  "Be where your feet are.",
  "Gentleness is a form of courage.",
  "This moment is enough to begin again.",
];

export function quoteOfTheDay(d = new Date()): string {
  const start = new Date(d.getFullYear(), 0, 0);
  const day = Math.floor((d.getTime() - start.getTime()) / 86_400_000);
  return QUOTES[day % QUOTES.length];
}

export type RelaxRecommendation = {
  title: string;
  detail: string;
  /** Optional quick actions */
  actions: { label: string; kind: "breath" | "sound" | "session"; id: string }[];
};

export function relaxRecommendationForMood(mood?: MoodId | null): RelaxRecommendation {
  switch (mood) {
    case "stressed":
      return {
        title: "Today’s Recommendation",
        detail: "Try the 2-minute Relax Breath, then Rain Sounds.",
        actions: [
          { label: "Relax Breath", kind: "breath", id: "reset-2" },
          { label: "Rain", kind: "sound", id: "heavy-rain" },
        ],
      };
    case "anxious":
      return {
        title: "Today’s Recommendation",
        detail: "Ocean Breath, then Progressive Muscle Relaxation.",
        actions: [
          { label: "Ocean Breath", kind: "breath", id: "calm" },
          { label: "Muscle Relaxation", kind: "session", id: "pmr" },
        ],
      };
    case "tired":
      return {
        title: "Today’s Recommendation",
        detail: "Bedtime Wind Down and Ocean Waves.",
        actions: [
          { label: "Wind Down", kind: "breath", id: "wind-down" },
          { label: "Ocean", kind: "sound", id: "ocean-night" },
        ],
      };
    case "great":
    case "good":
      return {
        title: "Today’s Recommendation",
        detail: "Keep the momentum with a short gratitude reflection.",
        actions: [{ label: "Tonight’s Reflection", kind: "session", id: "reflection" }],
      };
    case "low":
      return {
        title: "Today’s Recommendation",
        detail: "Emotional Reset, then soft Brown Noise.",
        actions: [
          { label: "Emotional Reset", kind: "session", id: "emotional-reset" },
          { label: "Brown Noise", kind: "sound", id: "brown-noise" },
        ],
      };
    default:
      return {
        title: "Today’s Recommendation",
        detail: "Take a breath — start with a 2-minute Relax Breath.",
        actions: [{ label: "Start Reset", kind: "breath", id: "reset-2" }],
      };
  }
}

const MOMENTS_KEY = "yaj_relax_moments_v1";
const FAV_KEY = "yaj_relax_sound_favs_v1";
const REFLECTION_KEY = "yaj_relax_reflections_v1";

export function bumpRelaxMoment(date = new Date().toISOString().slice(0, 10)): number {
  try {
    const raw = localStorage.getItem(MOMENTS_KEY);
    const dates: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!dates.includes(date)) dates.push(date);
    // keep ~60 days
    const trimmed = dates.slice(-60);
    localStorage.setItem(MOMENTS_KEY, JSON.stringify(trimmed));
    return momentsThisWeek(trimmed);
  } catch {
    return 1;
  }
}

export function momentsThisWeek(dates?: string[]): number {
  try {
    const list =
      dates ||
      (JSON.parse(localStorage.getItem(MOMENTS_KEY) || "[]") as string[]);
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday start
    start.setHours(0, 0, 0, 0);
    return list.filter((d) => new Date(d + "T12:00:00") >= start).length;
  } catch {
    return 0;
  }
}

export function loadSoundFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

export function toggleSoundFavorite(id: string): string[] {
  const cur = loadSoundFavorites();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export type NightReflection = {
  grateful: string;
  improve: string;
  proud: string;
};

export function loadTonightReflection(date = new Date().toISOString().slice(0, 10)): NightReflection {
  try {
    const all = JSON.parse(localStorage.getItem(REFLECTION_KEY) || "{}") as Record<
      string,
      NightReflection
    >;
    return all[date] || { grateful: "", improve: "", proud: "" };
  } catch {
    return { grateful: "", improve: "", proud: "" };
  }
}

export function saveTonightReflection(
  reflection: NightReflection,
  date = new Date().toISOString().slice(0, 10),
) {
  try {
    const all = JSON.parse(localStorage.getItem(REFLECTION_KEY) || "{}") as Record<
      string,
      NightReflection
    >;
    all[date] = reflection;
    localStorage.setItem(REFLECTION_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function getNarratedSession(id: string): NarratedSession | null {
  return (
    MENTAL_RESETS.find((s) => s.id === id) ||
    RELAX_TECHNIQUES.find((s) => s.id === id) ||
    null
  );
}
