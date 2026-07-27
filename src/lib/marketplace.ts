/** YAJ Marketplace taxonomy & helpers (OfferUp workflow, YAJ design). */

export const MARKETPLACE_CATEGORIES = [
  { id: "for-sale", label: "For Sale", emoji: "🏷" },
  { id: "vehicles", label: "Vehicles", emoji: "🚗" },
  { id: "electronics", label: "Electronics", emoji: "📱" },
  { id: "home", label: "Home", emoji: "🏠" },
  { id: "fashion", label: "Fashion", emoji: "👗" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "collectibles", label: "Collectibles", emoji: "🧸" },
  { id: "sports", label: "Sports", emoji: "⚽" },
  { id: "baby-kids", label: "Baby & Kids", emoji: "🍼" },
  { id: "tools", label: "Tools", emoji: "🔧" },
  { id: "free", label: "Free", emoji: "🎁" },
  { id: "rentals", label: "Rentals", emoji: "🔑" },
  { id: "local-businesses", label: "Local Businesses", emoji: "🏪" },
] as const;

export const LISTING_TYPES = [
  { id: "item", label: "Item for Sale" },
  { id: "vehicle", label: "Vehicle" },
  { id: "motorcycle", label: "Motorcycle" },
  { id: "boat", label: "Boat" },
  { id: "rv", label: "Recreational Vehicle" },
  { id: "rental", label: "Rental" },
  { id: "free", label: "Free Item" },
] as const;

export const CONDITIONS = ["New", "Like New", "Good", "Fair", "For Parts"] as const;

export const VEHICLE_LISTING_TYPES = new Set(["vehicle", "motorcycle", "boat", "rv"]);

export type ListingType = (typeof LISTING_TYPES)[number]["id"];
export type ListingStatus = "draft" | "active" | "pending" | "sold" | "expired" | "archived" | "removed";

export function formatPrice(price: number | null | undefined, listingType?: string) {
  if (listingType === "free" || price == null || Number(price) === 0) return "Free";
  return `$${Number(price).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function getCategory(id: string | undefined) {
  return MARKETPLACE_CATEGORIES.find((c) => c.id === id) || null;
}

export function sanitizeDescription(raw: string) {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export function approxLocation(city?: string | null, state?: string | null, approx?: string | null) {
  if (approx?.trim()) return approx.trim();
  const bits = [city, state].filter(Boolean);
  return bits.length ? bits.join(", ") : "Nearby";
}

const RECENT_KEY = "yaj_marketplace_recent";

export function pushRecentSearch(term: string) {
  try {
    const prev: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    const next = [term, ...prev.filter((r) => r !== term)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

export function removeRecentSearch(term: string) {
  try {
    const prev: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    localStorage.setItem(RECENT_KEY, JSON.stringify(prev.filter((r) => r !== term)));
  } catch {
    /* ignore */
  }
}
