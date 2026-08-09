/** YAJ Marketplace taxonomy & helpers (OfferUp workflow, YAJ design). */

export const MARKETPLACE_CATEGORIES = [
  { id: "for-sale", label: "For Sale", emoji: "🏷" },
  { id: "vehicles", label: "Automotive", emoji: "🚗" },
  { id: "electronics", label: "Electronics", emoji: "📱" },
  { id: "home", label: "Home", emoji: "🏠" },
  { id: "fashion", label: "Fashion", emoji: "👗" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "collectibles", label: "Collectibles", emoji: "🧸" },
  { id: "sports", label: "Sports", emoji: "⚽" },
  { id: "baby-kids", label: "Baby & Kids", emoji: "🍼" },
  { id: "tools", label: "Tools", emoji: "🔧" },
  { id: "free", label: "Free", emoji: "🎁" },
  { id: "rentals", label: "Homes & Rentals", emoji: "🔑" },
  { id: "local-businesses", label: "Local Businesses", emoji: "🏪" },
] as const;

export const LISTING_TYPES = [
  { id: "item", label: "Item for Sale" },
  { id: "automotive", label: "Automotive" },
  { id: "home", label: "Home or Space" },
  { id: "five_under", label: "$1–$5 Find" },
  { id: "free", label: "Free Item" },
] as const;

export const CONDITIONS = ["New", "Like New", "Good", "Fair", "For Parts"] as const;

/** Legacy ids stay supported so older listings keep rendering. */
export const VEHICLE_LISTING_TYPES = new Set(["automotive", "vehicle", "motorcycle", "boat", "rv"]);
export const HOME_LISTING_TYPES = new Set(["home", "rental"]);

/** One automotive flow — the seller picks the kind of vehicle. */
export const VEHICLE_KINDS = [
  "Car / Truck / SUV",
  "Motorcycle",
  "Boat",
  "RV / Camper",
  "Trailer",
  "Powersports / ATV",
  "Commercial",
] as const;

export const HOME_DEAL_TYPES = ["For rent", "For sale"] as const;

export const PROPERTY_TYPES = [
  "Apartment",
  "House",
  "Townhouse",
  "Condo",
  "Duplex",
  "Room",
  "Studio",
  "Mobile / Manufactured",
  "Land / Lot",
  "Office / Commercial space",
  "Storage / Parking space",
] as const;

export const LAUNDRY_TYPES = ["In unit", "In building", "Hookups only", "None"] as const;
export const PARKING_TYPES = ["Garage", "Driveway", "Assigned spot", "Street", "None"] as const;
export const AC_TYPES = ["Central", "Wall / Window unit", "Mini split", "None"] as const;
export const HEATING_TYPES = ["Central", "Electric", "Gas", "Baseboard", "None"] as const;
export const LEASE_TERMS = ["Month to month", "6 months", "12 months", "Short term"] as const;

export const HOME_AMENITIES = [
  "Balcony",
  "Basement",
  "Bike parking",
  "Cable TV",
  "Dishwasher",
  "Elevator",
  "Furnished",
  "Gym",
  "Pool",
  "Pets allowed",
  "Wheelchair accessible",
  "Yard",
  "Utilities included",
  "Washer / Dryer",
] as const;

/** Hard cap for the $1–$5 Finds section. */
export const FIVE_UNDER_MIN = 1;
export const FIVE_UNDER_MAX = 5;

export function isFiveUnderListing(l: { listing_type?: string | null; price?: number | null }) {
  const price = Number(l.price ?? 0);
  return String(l.listing_type) === "five_under" && price >= FIVE_UNDER_MIN && price <= FIVE_UNDER_MAX;
}

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
