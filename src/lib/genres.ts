export const GENRES = [
  "Beats",
  "Country",
  "R&B & Soul",
  "Rock",
  "Future Pop",
  "Hip Hop/Rap",
  "Reggaeton",
  "Haitian",
  "Afrobeat",
  "Latin Music",
  "All Music",
] as const;

export const BEAT_SUB_GENRES = [
  "Country",
  "R&B & Soul",
  "Rock",
  "Future Pop",
  "Hip Hop/Rap",
  "Reggaeton",
  "Haitian",
  "Afrobeat",
  "Latin Music",
] as const;

export type Genre = (typeof GENRES)[number];
