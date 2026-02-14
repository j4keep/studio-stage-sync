export const GENRES = [
  "Trap",
  "R&B & Soul",
  "Drill",
  "Future Pop",
  "Emo Rap",
  "Reggaeton",
  "Hip Hop/Rap",
  "Afrobeat",
  "Indie RnB",
  "All Music",
] as const;

export type Genre = (typeof GENRES)[number];
