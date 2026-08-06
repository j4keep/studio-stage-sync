/** YAJ Deals taxonomy & helpers — separate from Marketplace. */

export const DEAL_CATEGORIES = [
  {
    id: "food-drink",
    label: "Food & Drink",
    blurb: "Restaurants · Coffee · Desserts",
    emoji: "🍕",
    gradient: "from-orange-400/90 via-rose-400/80 to-amber-300/90",
    icon: "UtensilsCrossed",
  },
  {
    id: "shopping",
    label: "Shopping",
    blurb: "Fashion · Electronics · Home",
    emoji: "🛍️",
    gradient: "from-rose-400/90 via-orange-300/80 to-pink-300/90",
    icon: "ShoppingBag",
  },
  {
    id: "beauty",
    label: "Beauty",
    blurb: "Salons · Skincare · Spa",
    emoji: "✨",
    gradient: "from-fuchsia-400/80 via-rose-300/80 to-amber-200/90",
    icon: "Sparkles",
  },
  {
    id: "fitness",
    label: "Fitness",
    blurb: "Gyms · Yoga · Trials",
    emoji: "💪",
    gradient: "from-emerald-400/90 via-teal-400/80 to-lime-300/90",
    icon: "Dumbbell",
  },
  {
    id: "entertainment",
    label: "Entertainment",
    blurb: "Movies · Music · Fun",
    emoji: "🎬",
    gradient: "from-sky-400/90 via-indigo-400/70 to-cyan-300/90",
    icon: "Clapperboard",
  },
  {
    id: "events",
    label: "Events",
    blurb: "Tickets · Shows · Nights out",
    emoji: "🎟️",
    gradient: "from-violet-400/80 via-fuchsia-400/70 to-orange-300/90",
    icon: "Ticket",
  },
  {
    id: "automotive",
    label: "Automotive",
    blurb: "Service · Wash · Care",
    emoji: "🚗",
    gradient: "from-slate-500/90 via-sky-400/70 to-slate-300/90",
    icon: "Car",
  },
  {
    id: "home-services",
    label: "Home Services",
    blurb: "Cleaning · Repair · Pros",
    emoji: "🏠",
    gradient: "from-amber-400/90 via-orange-300/80 to-yellow-200/90",
    icon: "Home",
  },
  {
    id: "professional",
    label: "Professional",
    blurb: "Legal · Tax · Consulting",
    emoji: "💼",
    gradient: "from-blue-500/80 via-sky-400/70 to-slate-300/90",
    icon: "Briefcase",
  },
  {
    id: "family",
    label: "Family",
    blurb: "Kids · Learning · Activities",
    emoji: "👨‍👩‍👧",
    gradient: "from-teal-400/90 via-emerald-300/80 to-cyan-200/90",
    icon: "Users",
  },
  {
    id: "travel",
    label: "Travel",
    blurb: "Getaways · Tours · Stays",
    emoji: "✈️",
    gradient: "from-cyan-400/90 via-sky-300/80 to-amber-200/90",
    icon: "Plane",
  },
  {
    id: "online",
    label: "Online Deals",
    blurb: "Codes · Delivery · Digital",
    emoji: "🌐",
    gradient: "from-orange-500/90 via-amber-400/80 to-yellow-300/90",
    icon: "Globe",
  },
] as const;

export const DEAL_FILTERS = [
  { id: "for-you", label: "For You" },
  { id: "near-me", label: "Near Me" },
  { id: "ending-soon", label: "Ending Soon" },
  { id: "new", label: "New" },
  { id: "popular", label: "Most Popular" },
  { id: "online", label: "Online" },
  { id: "free", label: "Free" },
  { id: "under-10", label: "Under $10" },
] as const;

export const DEAL_TYPES = [
  { id: "percent_off", label: "Percent off" },
  { id: "amount_off", label: "Amount off" },
  { id: "bogo", label: "Buy one, get one" },
  { id: "free_item", label: "Free item" },
  { id: "member_special", label: "Member special" },
  { id: "limited_time", label: "Limited time" },
  { id: "fixed_price", label: "Fixed price" },
  { id: "other", label: "Other" },
] as const;

export const REDEMPTION_TYPES = [
  { id: "promo_code", label: "Promo code", cta: "Get Code" },
  { id: "qr_code", label: "QR code", cta: "Claim Deal" },
  { id: "barcode", label: "Barcode", cta: "Claim Deal" },
  { id: "claim_in_app", label: "Claim in app", cta: "Claim Deal" },
  { id: "show_screen", label: "Show at checkout", cta: "Show at Checkout" },
  { id: "external_website", label: "External website", cta: "Visit Website" },
  { id: "call", label: "Call to redeem", cta: "Call Business" },
  { id: "directions", label: "Directions", cta: "Get Directions" },
] as const;

export const DEAL_STATUSES = [
  "draft",
  "pending_review",
  "approved",
  "active",
  "paused",
  "rejected",
  "expired",
  "sold_out",
  "archived",
] as const;

export const DEAL_REPORT_REASONS = [
  { id: "misleading_promotion", label: "Misleading promotion" },
  { id: "scam", label: "Scam" },
  { id: "prohibited_item", label: "Prohibited item" },
  { id: "expired_offer", label: "Expired offer" },
  { id: "unsafe_location", label: "Unsafe location" },
  { id: "discrimination", label: "Discrimination" },
  { id: "other", label: "Other" },
] as const;

export const DEAL_PUBLISHING_POLICY_PATH = "/deals/publishing-policy";

export type DealCategoryId = (typeof DEAL_CATEGORIES)[number]["id"];
export type DealFilterId = (typeof DEAL_FILTERS)[number]["id"];
export type DealTypeId = (typeof DEAL_TYPES)[number]["id"];
export type RedemptionTypeId = (typeof REDEMPTION_TYPES)[number]["id"];
export type DealStatus = (typeof DEAL_STATUSES)[number];

export type DealLocationPrefs = {
  city: string;
  state: string;
  postalCode: string;
  radiusMiles: number;
  lat?: number | null;
  lng?: number | null;
};

const LOCATION_KEY = "yaj_deals_location";
const DEFAULT_LOCATION: DealLocationPrefs = {
  city: "Hollywood",
  state: "FL",
  postalCode: "",
  radiusMiles: 15,
  lat: 26.0112,
  lng: -80.1495,
};

export function getDealLocationPrefs(): DealLocationPrefs {
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    if (!raw) return { ...DEFAULT_LOCATION };
    return { ...DEFAULT_LOCATION, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_LOCATION };
  }
}

export function setDealLocationPrefs(prefs: Partial<DealLocationPrefs>) {
  const next = { ...getDealLocationPrefs(), ...prefs };
  localStorage.setItem(LOCATION_KEY, JSON.stringify(next));
  return next;
}

export function formatDealLocationLabel(prefs?: DealLocationPrefs | null) {
  const p = prefs || getDealLocationPrefs();
  if (p.postalCode?.trim()) return `Near ${p.postalCode.trim()}`;
  const place = [p.city, p.state].filter(Boolean).join(", ");
  return place ? `Near ${place}` : "Near you";
}

export function formatMoney(n: number | null | undefined, currency = "USD") {
  if (n == null || Number.isNaN(Number(n))) return null;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: Number(n) % 1 === 0 ? 0 : 2,
  }).format(Number(n));
}

export function computeSavings(regular?: number | null, deal?: number | null) {
  if (regular == null || deal == null) return null;
  const s = Number(regular) - Number(deal);
  return s > 0 ? s : null;
}

export function formatDiscountBadge(deal: {
  discount_badge?: string | null;
  deal_type?: string | null;
  discount_value?: number | null;
  regular_price?: number | null;
  deal_price?: number | null;
}): string {
  if (deal.discount_badge?.trim()) return deal.discount_badge.trim().toUpperCase();
  switch (deal.deal_type) {
    case "percent_off":
      return deal.discount_value != null ? `${Math.round(Number(deal.discount_value))}% OFF` : "SALE";
    case "amount_off":
      return deal.discount_value != null ? `$${Math.round(Number(deal.discount_value))} OFF` : "$ OFF";
    case "bogo":
      return "BUY 1, GET 1";
    case "free_item":
      return "FREE ITEM";
    case "member_special":
      return "MEMBER SPECIAL";
    case "limited_time":
      return "LIMITED TIME";
    case "fixed_price":
      return deal.deal_price != null ? formatMoney(deal.deal_price) || "DEAL" : "DEAL";
    default: {
      const savings = computeSavings(deal.regular_price, deal.deal_price);
      if (savings != null && deal.regular_price) {
        const pct = Math.round((savings / Number(deal.regular_price)) * 100);
        if (pct > 0) return `${pct}% OFF`;
      }
      return "DEAL";
    }
  }
}

export function formatExpiresLabel(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const ms = d.getTime() - now;
  if (ms <= 0) return "Expired";
  const hours = ms / 3_600_000;
  if (hours < 24) return `Ends in ${Math.max(1, Math.round(hours))}h`;
  const days = Math.ceil(hours / 24);
  if (days <= 7) {
    return `Valid through ${d.toLocaleDateString(undefined, { weekday: "long" })}`;
  }
  return `Ends ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function isEndingSoon(iso: string | null | undefined, withinHours = 48) {
  if (!iso) return false;
  const ms = new Date(iso).getTime() - Date.now();
  return ms > 0 && ms <= withinHours * 3_600_000;
}

export function isNewDeal(createdAt: string | null | undefined, withinHours = 72) {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() <= withinHours * 3_600_000;
}

export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(
  miles: number | null | undefined,
  locationType?: string | null,
) {
  if (locationType === "online") return "Online";
  if (miles == null || Number.isNaN(miles)) return locationType === "both" ? "Online / Local" : null;
  if (miles < 0.1) return "Nearby";
  return `${miles.toFixed(1)} miles away`;
}

export function mapsUrl(opts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  label?: string | null;
}) {
  if (opts.latitude != null && opts.longitude != null) {
    return `https://maps.google.com/?q=${opts.latitude},${opts.longitude}`;
  }
  const q = [opts.label, opts.address, opts.city, opts.state, opts.postal_code]
    .filter(Boolean)
    .join(", ");
  return q ? `https://maps.google.com/?q=${encodeURIComponent(q)}` : null;
}

export function redemptionCta(type: string | null | undefined) {
  return REDEMPTION_TYPES.find((r) => r.id === type)?.cta || "View Deal";
}

export function canClaimDeal(deal: {
  status?: string | null;
  expires_at?: string | null;
  total_claim_limit?: number | null;
  claims_count?: number | null;
}) {
  if (deal.status === "sold_out" || deal.status === "expired" || deal.status === "paused") return false;
  if (deal.status !== "active") return false;
  if (deal.expires_at && new Date(deal.expires_at).getTime() <= Date.now()) return false;
  if (
    deal.total_claim_limit != null &&
    deal.claims_count != null &&
    deal.claims_count >= deal.total_claim_limit
  ) {
    return false;
  }
  return true;
}

export function remainingClaims(deal: {
  total_claim_limit?: number | null;
  claims_count?: number | null;
}) {
  if (deal.total_claim_limit == null) return null;
  return Math.max(0, deal.total_claim_limit - (deal.claims_count || 0));
}

export function statusBadges(deal: {
  status?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  is_sponsored?: boolean | null;
  location_type?: string | null;
  claims_count?: number | null;
}): string[] {
  const badges: string[] = [];
  if (deal.status === "sold_out") badges.push("Sold Out");
  else if (deal.status === "expired" || (deal.expires_at && new Date(deal.expires_at) <= new Date())) {
    badges.push("Expired");
  } else {
    if (isNewDeal(deal.created_at)) badges.push("New");
    if (isEndingSoon(deal.expires_at)) badges.push("Ending Soon");
    if ((deal.claims_count || 0) >= 20) badges.push("Popular");
    if (deal.location_type === "online") badges.push("Online");
    if (deal.location_type === "in_store") badges.push("In Store");
  }
  if (deal.is_sponsored) badges.push("Sponsored");
  return badges;
}

export function getCategoryLabel(id: string | undefined | null) {
  return DEAL_CATEGORIES.find((c) => c.id === id)?.label || id || "Deal";
}

export function conversionRate(views: number, claims: number) {
  if (!views) return 0;
  return Math.round((claims / views) * 1000) / 10;
}
