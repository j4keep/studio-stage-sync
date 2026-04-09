/** Ephemeral index of Quick Join session IDs (localStorage). For testing until booking ships. */

const REGISTRY_KEY = "wstudio_quick_sessions_v1";

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function writeIds(ids: string[]): void {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(ids));
  } catch {
    /* ignore quota */
  }
}

/** True if this session id was already registered (another tab or earlier create). */
export function quickSessionExists(sessionId: string): boolean {
  const id = sessionId.trim();
  if (!id) return false;
  return readIds().includes(id);
}

/** Mark session as known so the next join with this id is treated as “existing”. */
export function registerQuickSession(sessionId: string): void {
  const id = sessionId.trim();
  if (!id) return;
  const ids = readIds();
  if (!ids.includes(id)) {
    ids.push(id);
    writeIds(ids);
  }
}
