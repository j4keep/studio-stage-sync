export const GENRES = [
  "Beats",
  "Trap",
  "R&B & Soul",
  "Drill",
  "Future Pop",
  "Emo Rap",
  "Reggaeton",
  "Hip Hop/Rap",
  "Afrobeat",
  "Latin Music",
  "All Music",
] as const;

export const BEAT_SUB_GENRES = [
  "Trap",
  "R&B & Soul",
  "Drill",
  "Future Pop",
  "Emo Rap",
  "Reggaeton",
  "Hip Hop/Rap",
  "Afrobeat",
  "Latin Music",
] as const;

export type Genre = (typeof GENRES)[number];
