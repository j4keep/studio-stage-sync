import type { MyLocation } from "@/hooks/use-marketplace-location";

export type LocalAreaMode = "nearby" | "anywhere";

export function getLocalAreaMode(location: MyLocation): LocalAreaMode {
  return location.sharing && location.lat != null && location.lng != null ? "nearby" : "anywhere";
}

export function extractZip(value: string | null | undefined) {
  return String(value || "").match(/\b\d{5}(?:-\d{4})?\b/)?.[0]?.slice(0, 5) || null;
}

function normalize(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cityFromSavedAddress(address: string | null | undefined) {
  const raw = String(address || "").trim();
  if (!raw) return null;
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  // Normal US geocoder labels generally look like:
  // street, city, ST ZIP, country. A ZIP-only save has no city and stays ZIP-only.
  if (parts.length >= 3) return normalize(parts[parts.length - 3]) || null;
  return null;
}

export function localAreaLabel(location: MyLocation) {
  const zip = extractZip(location.address);
  if (zip) return zip;
  return location.address || "your area";
}

/**
 * Match a discovery item's location against the user's saved YAJ Local Area.
 * Prefer exact ZIP. If a listing was created with only "City, ST", fall back
 * to matching the city from the saved geocoded address so older records still
 * remain discoverable.
 */
export function matchesLocalArea(
  itemLocation: string | null | undefined,
  savedLocation: MyLocation,
  explicitZip?: string | null,
) {
  if (getLocalAreaMode(savedLocation) === "anywhere") return true;

  const wantedZip = extractZip(savedLocation.address);
  const rowZip = extractZip(explicitZip || itemLocation);
  if (wantedZip && rowZip) return wantedZip === rowZip;

  const text = normalize([itemLocation, explicitZip].filter(Boolean).join(" "));
  if (!text) return false;
  if (wantedZip && text.includes(wantedZip)) return true;

  const city = cityFromSavedAddress(savedLocation.address);
  return Boolean(city && text.includes(city));
}
