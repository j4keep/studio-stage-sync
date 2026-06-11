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
  {
    id: "trap", name: "Trap Royalty", description: "Booming 808s, triplet hats, dark melodies.",
    color: "#ef4444",
    loops: [
      make("tr-808", "Trap - Crown (808)", "Trap Royalty", "Trap", "808", 145, 2, "F1"),
      make("tr-hat", "Trap - Crown (Triplet Hats)", "Trap Royalty", "Trap", "hi-hats", 145),
      make("tr-snare", "Trap - Crown (Snare)", "Trap Royalty", "Trap", "snare", 145),
      make("tr-kick", "Trap - Crown (Kick)", "Trap Royalty", "Trap", "kick", 145),
      make("tr-piano", "Trap - Crown (Dark Piano)", "Trap Royalty", "Trap", "piano", 145, 4, "F3"),
      make("tr-lead", "Trap - Crown (Lead)", "Trap Royalty", "Trap", "synth", 145, 4, "F4"),
      make("tr-pad", "Trap - Crown (Pad)", "Trap Royalty", "Trap", "synth", 145, 4, "F3"),
      make("tr-vox", "Trap - Crown (Vocal Chop)", "Trap Royalty", "Trap", "vocal", 145, 2, "F3"),
    ],
  },
  {
    id: "drill", name: "UK Drill", description: "Sliding 808s, dark strings, half-time drums.",
    color: "#71717a",
    loops: [
      make("dr-808", "Drill - Block (Sliding 808)", "UK Drill", "Trap", "808", 140, 2, "D1"),
      make("dr-hat", "Drill - Block (Hats)", "UK Drill", "Trap", "hi-hats", 140),
      make("dr-snare", "Drill - Block (Snare)", "UK Drill", "Trap", "snare", 140),
      make("dr-kick", "Drill - Block (Kick)", "UK Drill", "Trap", "kick", 140),
      make("dr-string", "Drill - Block (Strings)", "UK Drill", "Trap", "synth", 140, 4, "D3"),
      make("dr-bell", "Drill - Block (Bell)", "UK Drill", "Trap", "synth", 140, 2, "D4"),
    ],
  },
  {
    id: "afro", name: "Afro Wave", description: "Percussion-heavy grooves with melodic guitars.",
    color: "#f59e0b",
    loops: [
      make("af-perc", "Afro - Sun (Percussion)", "Afro Wave", "Pop", "drums", 105),
      make("af-bass", "Afro - Sun (Bass)", "Afro Wave", "Pop", "bass", 105, 2, "G1"),
      make("af-guitar", "Afro - Sun (Guitar)", "Afro Wave", "Pop", "guitar", 105, 4, "G3"),
      make("af-vox", "Afro - Sun (Vox)", "Afro Wave", "Pop", "vocal", 105, 2, "G3"),
      make("af-kick", "Afro - Sun (Kick)", "Afro Wave", "Pop", "kick", 105),
      make("af-shaker", "Afro - Sun (Shaker)", "Afro Wave", "Pop", "hi-hats", 105),
    ],
  },
  {
    id: "techno", name: "Techno Pulse", description: "Driving kicks and modular synths.",
    color: "#22d3ee",
    loops: [
      make("te-kick", "Techno - Pulse (Kick)", "Techno Pulse", "EDM", "kick", 128),
      make("te-bass", "Techno - Pulse (Acid Bass)", "Techno Pulse", "EDM", "bass", 128, 2, "C1"),
      make("te-hat", "Techno - Pulse (Hats)", "Techno Pulse", "EDM", "hi-hats", 128),
      make("te-clap", "Techno - Pulse (Clap)", "Techno Pulse", "EDM", "clap", 128),
      make("te-lead", "Techno - Pulse (Modular)", "Techno Pulse", "EDM", "synth", 128, 4, "C3"),
      make("te-fx", "Techno - Pulse (Riser)", "Techno Pulse", "EDM", "sfx", 128),
    ],
  },
  {
    id: "rnb", name: "R&B Velvet", description: "Smooth chords, finger snaps, deep bass.",
    color: "#fb7185",
    loops: [
      make("rb-piano", "RnB - Velvet (Rhodes)", "R&B Velvet", "RnB", "piano", 88, 4, "Eb3"),
      make("rb-bass", "RnB - Velvet (Bass)", "R&B Velvet", "RnB", "bass", 88, 2, "Eb1"),
      make("rb-drums", "RnB - Velvet (Drums)", "R&B Velvet", "RnB", "drums", 88),
      make("rb-snap", "RnB - Velvet (Snaps)", "R&B Velvet", "RnB", "clap", 88),
      make("rb-vox", "RnB - Velvet (Vocal)", "R&B Velvet", "RnB", "vocal", 88, 4, "Eb3"),
      make("rb-pad", "RnB - Velvet (Pad)", "R&B Velvet", "RnB", "synth", 88, 4, "Eb3"),
    ],
  },
  {
    id: "rock", name: "Indie Rock", description: "Live drums and jangle guitars.",
    color: "#22c55e",
    loops: [
      make("ro-drums", "Rock - Sundown (Drums)", "Indie Rock", "Rock", "drums", 118),
      make("ro-bass", "Rock - Sundown (Bass)", "Indie Rock", "Rock", "bass", 118, 2, "E1"),
      make("ro-guitar", "Rock - Sundown (Guitar)", "Indie Rock", "Rock", "guitar", 118, 4, "E3"),
      make("ro-lead", "Rock - Sundown (Lead)", "Indie Rock", "Rock", "guitar", 118, 4, "E4"),
      make("ro-crash", "Rock - Sundown (Crash)", "Indie Rock", "Rock", "sfx", 118),
    ],
  },
  {
    id: "pop", name: "Pop Sparkle", description: "Bright synths, catchy claps, polished mix.",
    color: "#f472b6",
    loops: [
      make("po-chord", "Pop - Sparkle (Chords)", "Pop Sparkle", "Pop", "synth", 120, 4, "C4"),
      make("po-drums", "Pop - Sparkle (Drums)", "Pop Sparkle", "Pop", "drums", 120),
      make("po-bass", "Pop - Sparkle (Bass)", "Pop Sparkle", "Pop", "bass", 120, 2, "C2"),
      make("po-clap", "Pop - Sparkle (Clap)", "Pop Sparkle", "Pop", "clap", 120),
      make("po-vox", "Pop - Sparkle (Vox)", "Pop Sparkle", "Pop", "vocal", 120, 2, "C4"),
      make("po-lead", "Pop - Sparkle (Lead)", "Pop Sparkle", "Pop", "synth", 120, 4, "C5"),
    ],
  },
  {
    id: "dnb", name: "Drum & Bass", description: "Fast breakbeats with sub-shaking bass.",
    color: "#84cc16",
    loops: [
      make("db-break", "DnB - Liquid (Break)", "Drum & Bass", "EDM", "drums", 174),
      make("db-bass", "DnB - Liquid (Reese)", "Drum & Bass", "EDM", "bass", 174, 2, "F1"),
      make("db-pad", "DnB - Liquid (Pad)", "Drum & Bass", "EDM", "synth", 174, 4, "F3"),
      make("db-vox", "DnB - Liquid (Vocal)", "Drum & Bass", "EDM", "vocal", 174, 2, "F3"),
      make("db-fx", "DnB - Liquid (Sweep)", "Drum & Bass", "EDM", "sfx", 174),
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
