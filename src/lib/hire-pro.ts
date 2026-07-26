/** Nextdoor / Thumbtack-style Hire a Pro taxonomy for YAJ gigs. */

export type HireCategory = {
  id: string;
  label: string;
  searchPlaceholder: string;
  image: string;
};

export type ServiceOption = { id: string; label: string };

export const HIRE_CATEGORIES: HireCategory[] = [
  {
    id: "house-cleaning",
    label: "House cleaning",
    searchPlaceholder: "Search house cleaning",
    image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&q=80",
  },
  {
    id: "electrical",
    label: "Electrical and wiring repair",
    searchPlaceholder: "Search electrical",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
  },
  {
    id: "handyman",
    label: "Handyman",
    searchPlaceholder: "Search handyman",
    image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80",
  },
  {
    id: "appliance",
    label: "Appliance repair or maintenance",
    searchPlaceholder: "Search appliance repair",
    image: "https://images.unsplash.com/photo-1556912173-46c336c7fd55?w=800&q=80",
  },
  {
    id: "painting",
    label: "Interior painting",
    searchPlaceholder: "Search painting",
    image: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=800&q=80",
  },
  {
    id: "moving",
    label: "Local moving (under 50 miles)",
    searchPlaceholder: "Search movers",
    image: "https://images.unsplash.com/photo-1600518464441-9154a4dea21b?w=800&q=80",
  },
  {
    id: "lawn",
    label: "Full service lawn care",
    searchPlaceholder: "Search lawn care",
    image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80",
  },
  {
    id: "junk",
    label: "Junk removal",
    searchPlaceholder: "Search junk removal",
    image: "https://images.unsplash.com/photo-1611284446314-60a98e75b2f4?w=800&q=80",
  },
  {
    id: "tree",
    label: "Tree trimming and removal",
    searchPlaceholder: "Search tree service",
    image: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800&q=80",
  },
  {
    id: "plumbing",
    label: "Plumber pipe repair",
    searchPlaceholder: "Search plumber",
    image: "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=800&q=80",
  },
];

export const PROJECT_TYPES: ServiceOption[] = [
  { id: "repairs", label: "Repairs" },
  { id: "installation", label: "Installation" },
  { id: "maintenance", label: "Maintenance" },
  { id: "assembly", label: "Assembly" },
  { id: "painting", label: "Painting" },
  { id: "cleaning", label: "Cleaning" },
];

export const WORK_FOCUS: ServiceOption[] = [
  { id: "walls-inside", label: "Walls (inside)" },
  { id: "walls-outside", label: "Walls (outside)" },
  { id: "cabinets", label: "Cabinets" },
  { id: "shelving", label: "Shelving" },
  { id: "molding", label: "Molding or baseboards" },
  { id: "electrical", label: "Electrical" },
  { id: "lighting", label: "Lighting" },
  { id: "wall-hangings", label: "Wall hangings" },
  { id: "doors", label: "Doors" },
  { id: "tiling", label: "Tiling" },
  { id: "appliances", label: "Appliances" },
  { id: "plumbing", label: "Plumbing" },
  { id: "furniture", label: "Furniture" },
];

export const TIMELINE_OPTIONS = [
  "Within 48 hours",
  "This week",
  "Within 2 weeks",
  "Flexible",
];

export const HOURS_OPTIONS = [
  "Less than 2 hours",
  "2–4 hours",
  "Half day",
  "Full day",
  "Multi-day",
];

export function getHireCategory(id: string | undefined) {
  return HIRE_CATEGORIES.find((c) => c.id === id) || null;
}

export function defaultServiceMap(options: ServiceOption[], enabled = true): Record<string, boolean> {
  return Object.fromEntries(options.map((o) => [o.id, enabled]));
}

export function formatHourly(rate: number | null | undefined) {
  if (rate == null || !Number.isFinite(Number(rate))) return null;
  return `$${Number(rate)}/hour`;
}

export function formatResponseTime(minutes: number | null | undefined) {
  const m = minutes ?? 60;
  if (m < 60) return `Responds in about ${m} min`;
  const h = Math.round(m / 60);
  return h <= 1 ? "Responds in about 1 hour" : `Responds in about ${h} hours`;
}
