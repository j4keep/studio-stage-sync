import type { LoopDef } from "./loopGenerator";

const COLORS = {
  drums: "#ec4899", "808": "#a855f7", "hi-hats": "#22d3ee", snare: "#f43f5e",
  kick: "#f97316", clap: "#eab308", synth: "#8b5cf6", bass: "#10b981",
  piano: "#3b82f6", guitar: "#84cc16", sfx: "#f59e0b", vocal: "#fb7185",
};

const make = (id: string, name: string, pack: string, genre: string, category: LoopDef["category"], bpm: number, bars = 2, key = "C2"): LoopDef => ({
  id, name, pack, genre, category, bpm, bars, key, color: COLORS[category],
});

export const LOOP_PACKS = [
  {
    id: "slime", name: "Slime", description: "Distorted 808s, manic energy, grimy rage trap chaos.",
    color: "#06b6d4",
    loops: [
      make("slime-808", "Slime - Addiction (808)", "Slime", "Rage", "808", 150, 2, "Eb1"),
      make("slime-full", "Slime - Addiction (Full Drum)", "Slime", "Rage", "drums", 150),
      make("slime-fx", "Slime - Addiction (FX Crowd)", "Slime", "Rage", "sfx", 150),
      make("slime-hh", "Slime - Addiction (Hi Hats)", "Slime", "Rage", "hi-hats", 150),
      make("slime-inst", "Slime - Addiction (Instrumental)", "Slime", "Rage", "synth", 150, 4, "Eb3"),
      make("slime-kick", "Slime - Addiction (Kick)", "Slime", "Rage", "kick", 150),
      make("slime-snare", "Slime - Addiction (Snare)", "Slime", "Rage", "snare", 150),
      make("slime-sbass", "Slime - Addiction (Synth Bass)", "Slime", "Rage", "bass", 150, 2, "Eb2"),
      make("slime-slead", "Slime - Addiction (Synth Lead)", "Slime", "Rage", "synth", 150, 2, "Eb4"),
      make("slime-pad", "Slime - Addiction (Synth Pad)", "Slime", "Rage", "synth", 150, 4, "Eb3"),
    ],
  },
  {
    id: "boom", name: "Boom Bap", description: "Dusty drums, sample-style chops, classic east-coast feel.",
    color: "#f97316",
    loops: [
      make("bb-drums", "Boom Bap - Block Party (Drums)", "Boom Bap", "Hip hop", "drums", 92),
      make("bb-bass", "Boom Bap - Block Party (Bass)", "Boom Bap", "Hip hop", "bass", 92, 2, "A1"),
      make("bb-piano", "Boom Bap - Block Party (Rhodes)", "Boom Bap", "Hip hop", "piano", 92, 2, "A3"),
      make("bb-hat", "Boom Bap - Block Party (Hats)", "Boom Bap", "Hip hop", "hi-hats", 92),
      make("bb-snare", "Boom Bap - Block Party (Snare)", "Boom Bap", "Hip hop", "snare", 92),
    ],
  },
  {
    id: "neon", name: "Neon Nights", description: "Synthwave leads and pulsing basses, retro futurism.",
    color: "#a855f7",
    loops: [
      make("nn-bass", "Neon - Cruise (Bass)", "Neon Nights", "Synth", "bass", 110, 2, "F1"),
      make("nn-lead", "Neon - Cruise (Lead)", "Neon Nights", "Synth", "synth", 110, 4, "F3"),
      make("nn-pad", "Neon - Cruise (Pad)", "Neon Nights", "Synth", "synth", 110, 4, "F3"),
      make("nn-drums", "Neon - Cruise (Drums)", "Neon Nights", "Synth", "drums", 110),
      make("nn-fx", "Neon - Cruise (Riser)", "Neon Nights", "Synth", "sfx", 110, 2),
    ],
  },
  {
    id: "future", name: "Future Bass", description: "Sparkly synth chords and snappy snares.",
    color: "#8b5cf6",
    loops: [
      make("fb-chord", "Future - Sky (Chords)", "Future Bass", "EDM", "synth", 140, 2, "G3"),
      make("fb-drums", "Future - Sky (Drums)", "Future Bass", "EDM", "drums", 140),
      make("fb-bass", "Future - Sky (Bass)", "Future Bass", "EDM", "bass", 140, 2, "G1"),
      make("fb-vocal", "Future - Sky (Vocal Chop)", "Future Bass", "EDM", "vocal", 140, 2, "G3"),
      make("fb-clap", "Future - Sky (Clap)", "Future Bass", "EDM", "clap", 140),
    ],
  },
  {
    id: "lofi", name: "Lo-Fi Study", description: "Warm pianos and lazy drums for chill sessions.",
    color: "#10b981",
    loops: [
      make("lf-piano", "Lo-Fi - Rainy (Piano)", "Lo-Fi Study", "Hip hop", "piano", 78, 2, "C3"),
      make("lf-drums", "Lo-Fi - Rainy (Drums)", "Lo-Fi Study", "Hip hop", "drums", 78),
      make("lf-bass", "Lo-Fi - Rainy (Bass)", "Lo-Fi Study", "Hip hop", "bass", 78, 2, "C2"),
      make("lf-guitar", "Lo-Fi - Rainy (Guitar)", "Lo-Fi Study", "Hip hop", "guitar", 78, 2, "C3"),
    ],
  },
  {
    id: "house", name: "Deep House", description: "Four-on-the-floor with deep moving basslines.",
    color: "#3b82f6",
    loops: [
      make("dh-kick", "House - Midnight (Kick)", "Deep House", "EDM", "kick", 124),
      make("dh-bass", "House - Midnight (Bass)", "Deep House", "EDM", "bass", 124, 2, "A1"),
      make("dh-hat", "House - Midnight (Hats)", "Deep House", "EDM", "hi-hats", 124),
      make("dh-clap", "House - Midnight (Clap)", "Deep House", "EDM", "clap", 124),
      make("dh-chord", "House - Midnight (Chords)", "Deep House", "EDM", "synth", 124, 4, "A3"),
    ],
  },
] as const;

export const ALL_LOOPS: LoopDef[] = LOOP_PACKS.flatMap(p => p.loops as unknown as LoopDef[]);

export const CATEGORY_CHIPS: { label: string; cat: LoopDef["category"] }[] = [
  { label: "Drums", cat: "drums" },
  { label: "808", cat: "808" },
  { label: "Hi hats", cat: "hi-hats" },
  { label: "Snare", cat: "snare" },
  { label: "Kick", cat: "kick" },
  { label: "Clap", cat: "clap" },
  { label: "Synth", cat: "synth" },
  { label: "Bass", cat: "bass" },
  { label: "Piano", cat: "piano" },
  { label: "Guitar", cat: "guitar" },
  { label: "Vocal", cat: "vocal" },
  { label: "SFX", cat: "sfx" },
];

export const GENRES = ["Hip hop", "Rage", "Synth", "EDM", "Trap", "Pop", "Rock", "RnB"];
