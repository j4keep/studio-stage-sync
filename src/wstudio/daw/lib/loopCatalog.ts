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
      make("slime-808", "Storm Pattern (808)", "Slime", "Rage", "808", 150, 2, "Eb1"),
      make("slime-full", "Storm Pattern (Full Drum)", "Slime", "Rage", "drums", 150),
      make("slime-fx", "Storm Pattern (FX Crowd)", "Slime", "Rage", "sfx", 150),
      make("slime-hh", "Storm Pattern (Hi Hats)", "Slime", "Rage", "hi-hats", 150),
      make("slime-inst", "Storm Pattern (Instrumental)", "Slime", "Rage", "synth", 150, 4, "Eb3"),
      make("slime-kick", "Storm Pattern (Kick)", "Slime", "Rage", "kick", 150),
      make("slime-snare", "Storm Pattern (Snare)", "Slime", "Rage", "snare", 150),
      make("slime-sbass", "Storm Pattern (Synth Bass)", "Slime", "Rage", "bass", 150, 2, "Eb2"),
      make("slime-slead", "Storm Pattern (Synth Lead)", "Slime", "Rage", "synth", 150, 2, "Eb4"),
      make("slime-pad", "Storm Pattern (Synth Pad)", "Slime", "Rage", "synth", 150, 4, "Eb3"),
    ],
  },
  {
    id: "boom", name: "Boom Bap", description: "Dusty drums, sample-style chops, classic east-coast feel.",
    color: "#f97316",
    loops: [
      make("bb-drums", "Boom Bap - Street Pattern (Drums)", "Boom Bap", "Hip hop", "drums", 92),
      make("bb-bass", "Boom Bap - Street Pattern (Bass)", "Boom Bap", "Hip hop", "bass", 92, 2, "A1"),
      make("bb-piano", "Boom Bap - Street Pattern (Rhodes)", "Boom Bap", "Hip hop", "piano", 92, 2, "A3"),
      make("bb-hat", "Boom Bap - Street Pattern (Hats)", "Boom Bap", "Hip hop", "hi-hats", 92),
      make("bb-snare", "Boom Bap - Street Pattern (Snare)", "Boom Bap", "Hip hop", "snare", 92),
    ],
  },
  {
    id: "neon", name: "Neon Nights", description: "Synthwave leads and pulsing basses, retro futurism.",
    color: "#a855f7",
    loops: [
      make("nn-bass", "Neon - Drive (Bass)", "Neon Nights", "Synth", "bass", 110, 2, "F1"),
      make("nn-lead", "Neon - Drive (Lead)", "Neon Nights", "Synth", "synth", 110, 4, "F3"),
      make("nn-pad", "Neon - Drive (Pad)", "Neon Nights", "Synth", "synth", 110, 4, "F3"),
      make("nn-drums", "Neon - Drive (Drums)", "Neon Nights", "Synth", "drums", 110),
      make("nn-fx", "Neon - Drive (Riser)", "Neon Nights", "Synth", "sfx", 110, 2),
    ],
  },
  {
    id: "future", name: "Future Bass", description: "Sparkly synth chords and snappy snares.",
    color: "#8b5cf6",
    loops: [
      make("fb-chord", "Future - Aurora (Chords)", "Future Bass", "EDM", "synth", 140, 2, "G3"),
      make("fb-drums", "Future - Aurora (Drums)", "Future Bass", "EDM", "drums", 140),
      make("fb-bass", "Future - Aurora (Bass)", "Future Bass", "EDM", "bass", 140, 2, "G1"),
      make("fb-vocal", "Future - Aurora (Vocal Chop)", "Future Bass", "EDM", "vocal", 140, 2, "G3"),
      make("fb-clap", "Future - Aurora (Clap)", "Future Bass", "EDM", "clap", 140),
    ],
  },
  {
    id: "lofi", name: "Lo-Fi Study", description: "Warm pianos and lazy drums for chill sessions.",
    color: "#10b981",
    loops: [
      make("lf-piano", "Lo-Fi - Drizzle (Piano)", "Lo-Fi Study", "Hip hop", "piano", 78, 2, "C3"),
      make("lf-drums", "Lo-Fi - Drizzle (Drums)", "Lo-Fi Study", "Hip hop", "drums", 78),
      make("lf-bass", "Lo-Fi - Drizzle (Bass)", "Lo-Fi Study", "Hip hop", "bass", 78, 2, "C2"),
      make("lf-guitar", "Lo-Fi - Drizzle (Guitar)", "Lo-Fi Study", "Hip hop", "guitar", 78, 2, "C3"),
    ],
  },
  {
    id: "house", name: "Deep House", description: "Four-on-the-floor with deep moving basslines.",
    color: "#3b82f6",
    loops: [
      make("dh-kick", "House - Late Hour (Kick)", "Deep House", "EDM", "kick", 124),
      make("dh-bass", "House - Late Hour (Bass)", "Deep House", "EDM", "bass", 124, 2, "A1"),
      make("dh-hat", "House - Late Hour (Hats)", "Deep House", "EDM", "hi-hats", 124),
      make("dh-clap", "House - Late Hour (Clap)", "Deep House", "EDM", "clap", 124),
      make("dh-chord", "House - Late Hour (Chords)", "Deep House", "EDM", "synth", 124, 4, "A3"),
    ],
  },
  {
    id: "trap", name: "Trap Royalty", description: "Booming 808s, triplet hats, dark melodies.",
    color: "#ef4444",
    loops: [
      make("tr-808", "Trap - Throne (808)", "Trap Royalty", "Trap", "808", 145, 2, "F1"),
      make("tr-hat", "Trap - Throne (Triplet Hats)", "Trap Royalty", "Trap", "hi-hats", 145),
      make("tr-snare", "Trap - Throne (Snare)", "Trap Royalty", "Trap", "snare", 145),
      make("tr-kick", "Trap - Throne (Kick)", "Trap Royalty", "Trap", "kick", 145),
      make("tr-piano", "Trap - Throne (Dark Piano)", "Trap Royalty", "Trap", "piano", 145, 4, "F3"),
      make("tr-lead", "Trap - Throne (Lead)", "Trap Royalty", "Trap", "synth", 145, 4, "F4"),
      make("tr-pad", "Trap - Throne (Pad)", "Trap Royalty", "Trap", "synth", 145, 4, "F3"),
      make("tr-vox", "Trap - Throne (Vocal Chop)", "Trap Royalty", "Trap", "vocal", 145, 2, "F3"),
    ],
  },
  {
    id: "drill", name: "UK Drill", description: "Sliding 808s, dark strings, half-time drums.",
    color: "#71717a",
    loops: [
      make("dr-808", "Drill - Street (Sliding 808)", "UK Drill", "Trap", "808", 140, 2, "D1"),
      make("dr-hat", "Drill - Street (Hats)", "UK Drill", "Trap", "hi-hats", 140),
      make("dr-snare", "Drill - Street (Snare)", "UK Drill", "Trap", "snare", 140),
      make("dr-kick", "Drill - Street (Kick)", "UK Drill", "Trap", "kick", 140),
      make("dr-string", "Drill - Street (Strings)", "UK Drill", "Trap", "synth", 140, 4, "D3"),
      make("dr-bell", "Drill - Street (Bell)", "UK Drill", "Trap", "synth", 140, 2, "D4"),
    ],
  },
  {
    id: "afro", name: "Afro Wave", description: "Percussion-heavy grooves with melodic guitars.",
    color: "#f59e0b",
    loops: [
      make("af-perc", "Afro - Morning (Percussion)", "Afro Wave", "Pop", "drums", 105),
      make("af-bass", "Afro - Morning (Bass)", "Afro Wave", "Pop", "bass", 105, 2, "G1"),
      make("af-guitar", "Afro - Morning (Guitar)", "Afro Wave", "Pop", "guitar", 105, 4, "G3"),
      make("af-vox", "Afro - Morning (Vox)", "Afro Wave", "Pop", "vocal", 105, 2, "G3"),
      make("af-kick", "Afro - Morning (Kick)", "Afro Wave", "Pop", "kick", 105),
      make("af-shaker", "Afro - Morning (Shaker)", "Afro Wave", "Pop", "hi-hats", 105),
    ],
  },
  {
    id: "techno", name: "Techno Pulse", description: "Driving kicks and modular synths.",
    color: "#22d3ee",
    loops: [
      make("te-kick", "Techno - Engine (Kick)", "Techno Pulse", "EDM", "kick", 128),
      make("te-bass", "Techno - Engine (Acid Bass)", "Techno Pulse", "EDM", "bass", 128, 2, "C1"),
      make("te-hat", "Techno - Engine (Hats)", "Techno Pulse", "EDM", "hi-hats", 128),
      make("te-clap", "Techno - Engine (Clap)", "Techno Pulse", "EDM", "clap", 128),
      make("te-lead", "Techno - Engine (Modular)", "Techno Pulse", "EDM", "synth", 128, 4, "C3"),
      make("te-fx", "Techno - Engine (Riser)", "Techno Pulse", "EDM", "sfx", 128),
    ],
  },
  {
    id: "rnb", name: "R&B Silk", description: "Smooth chords, finger snaps, deep bass.",
    color: "#fb7185",
    loops: [
      make("rb-piano", "RnB - Silk (Rhodes)", "R&B Silk", "RnB", "piano", 88, 4, "Eb3"),
      make("rb-bass", "RnB - Silk (Bass)", "R&B Silk", "RnB", "bass", 88, 2, "Eb1"),
      make("rb-drums", "RnB - Silk (Drums)", "R&B Silk", "RnB", "drums", 88),
      make("rb-snap", "RnB - Silk (Snaps)", "R&B Silk", "RnB", "clap", 88),
      make("rb-vox", "RnB - Silk (Vocal)", "R&B Silk", "RnB", "vocal", 88, 4, "Eb3"),
      make("rb-pad", "RnB - Silk (Pad)", "R&B Silk", "RnB", "synth", 88, 4, "Eb3"),
    ],
  },
  {
    id: "rock", name: "Indie Rock", description: "Live drums and jangle guitars.",
    color: "#22c55e",
    loops: [
      make("ro-drums", "Rock - Dusk (Drums)", "Indie Rock", "Rock", "drums", 118),
      make("ro-bass", "Rock - Dusk (Bass)", "Indie Rock", "Rock", "bass", 118, 2, "E1"),
      make("ro-guitar", "Rock - Dusk (Guitar)", "Indie Rock", "Rock", "guitar", 118, 4, "E3"),
      make("ro-lead", "Rock - Dusk (Lead)", "Indie Rock", "Rock", "guitar", 118, 4, "E4"),
      make("ro-crash", "Rock - Dusk (Crash)", "Indie Rock", "Rock", "sfx", 118),
    ],
  },
  {
    id: "pop", name: "Pop Shine", description: "Bright synths, catchy claps, polished mix.",
    color: "#f472b6",
    loops: [
      make("po-chord", "Pop - Shine (Chords)", "Pop Shine", "Pop", "synth", 120, 4, "C4"),
      make("po-drums", "Pop - Shine (Drums)", "Pop Shine", "Pop", "drums", 120),
      make("po-bass", "Pop - Shine (Bass)", "Pop Shine", "Pop", "bass", 120, 2, "C2"),
      make("po-clap", "Pop - Shine (Clap)", "Pop Shine", "Pop", "clap", 120),
      make("po-vox", "Pop - Shine (Vox)", "Pop Shine", "Pop", "vocal", 120, 2, "C4"),
      make("po-lead", "Pop - Shine (Lead)", "Pop Shine", "Pop", "synth", 120, 4, "C5"),
    ],
  },
  {
    id: "dnb", name: "Drum & Bass", description: "Fast breakbeats with sub-shaking bass.",
    color: "#84cc16",
    loops: [
      make("db-break", "DnB - Flow (Break)", "Drum & Bass", "EDM", "drums", 174),
      make("db-bass", "DnB - Flow (Reese)", "Drum & Bass", "EDM", "bass", 174, 2, "F1"),
      make("db-pad", "DnB - Flow (Pad)", "Drum & Bass", "EDM", "synth", 174, 4, "F3"),
      make("db-vox", "DnB - Flow (Vocal)", "Drum & Bass", "EDM", "vocal", 174, 2, "F3"),
      make("db-fx", "DnB - Flow (Sweep)", "Drum & Bass", "EDM", "sfx", 174),
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
