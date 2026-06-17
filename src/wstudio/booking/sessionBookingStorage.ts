import type { SessionBookingRecord } from "./bookingTypes";

const PREFIX = "wstudio_booking_v1_";

export function bookingStorageKey(sessionId: string): string {
  return `${PREFIX}${sessionId.trim()}`;
}

export function loadSessionBooking(sessionId: string): SessionBookingRecord | null {
  if (!sessionId.trim()) return null;
  try {
    const raw = localStorage.getItem(bookingStorageKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionBookingRecord;
    if (!parsed || parsed.sessionId !== sessionId.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSessionBooking(record: SessionBookingRecord): void {
  try {
    localStorage.setItem(bookingStorageKey(record.sessionId), JSON.stringify(record));
  } catch {
    /* ignore quota */
  }
}

export function clearSessionBooking(sessionId: string): void {
  try {
    localStorage.removeItem(bookingStorageKey(sessionId));
  } catch {
    /* ignore */
  }
}
