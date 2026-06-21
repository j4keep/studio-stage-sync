// W.STUDIO Podcast — local-first session scheduling store.
// Stores scheduled podcast sessions in localStorage (per-device).
// Does NOT touch LiveKit, recording, editor, ffmpeg, or invite logic.
//
// Each scheduled session is identified by `id` (also used as LiveKit room id
// and Supabase realtime channel suffix, so the existing room + doorman work
// unchanged).

export type PodcastVisibility = "public" | "invite" | "password";
export type PodcastSessionStatus = "upcoming" | "live" | "ended" | "cancelled";

export type ScheduledPodcastSession = {
  id: string;
  title: string;
  description: string;
  hostId: string | null;
  hostName: string;
  scheduledAt: number;      // epoch ms
  durationMin: number;
  visibility: PodcastVisibility;
  password?: string;
  status: PodcastSessionStatus;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  cancelledAt?: number;
};

const KEY = "wstudio.podcast.sessions.v1";

type Listener = () => void;
const listeners = new Set<Listener>();

const read = (): ScheduledPodcastSession[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
};

const write = (rows: ScheduledPodcastSession[]) => {
  try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch {}
  listeners.forEach((l) => { try { l(); } catch {} });
};

const newId = () =>
  `pod_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const PodcastSessionStore = {
  list(): ScheduledPodcastSession[] {
    // auto-reconcile status based on time
    const now = Date.now();
    const rows = read();
    let changed = false;
    rows.forEach((r) => {
      if (r.status === "cancelled" || r.status === "ended") return;
      const endAt = r.scheduledAt + r.durationMin * 60_000;
      if (now >= r.scheduledAt && r.status === "upcoming") {
        r.status = "live"; changed = true;
      }
      if (now >= endAt + 4 * 60 * 60_000 && r.status === "live") {
        // safety: 4h after planned end, auto-mark ended
        r.status = "ended";
        r.endedAt = r.endedAt || endAt;
        changed = true;
      }
    });
    if (changed) write(rows);
    return rows.slice().sort((a, b) => a.scheduledAt - b.scheduledAt);
  },

  get(id: string): ScheduledPodcastSession | undefined {
    return read().find((r) => r.id === id);
  },

  create(input: Omit<ScheduledPodcastSession, "id" | "status" | "createdAt"> & { id?: string }): ScheduledPodcastSession {
    const rows = read();
    const row: ScheduledPodcastSession = {
      id: input.id || newId(),
      title: input.title.trim() || "Untitled Podcast",
      description: input.description || "",
      hostId: input.hostId ?? null,
      hostName: input.hostName || "Host",
      scheduledAt: input.scheduledAt,
      durationMin: Math.max(5, Math.round(input.durationMin || 60)),
      visibility: input.visibility || "public",
      password: input.password,
      status: "upcoming",
      createdAt: Date.now(),
    };
    rows.push(row);
    write(rows);
    return row;
  },

  update(id: string, patch: Partial<ScheduledPodcastSession>) {
    const rows = read();
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return;
    rows[idx] = { ...rows[idx], ...patch };
    write(rows);
  },

  cancel(id: string) {
    this.update(id, { status: "cancelled", cancelledAt: Date.now() });
  },

  markLive(id: string) {
    const r = this.get(id);
    if (!r || r.status === "cancelled" || r.status === "ended") return;
    this.update(id, { status: "live", startedAt: r.startedAt || Date.now() });
  },

  markEnded(id: string) {
    this.update(id, { status: "ended", endedAt: Date.now() });
  },

  remove(id: string) {
    write(read().filter((r) => r.id !== id));
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/* ---------------- Join window helpers ---------------- */

export const JOIN_WINDOW_MS = 15 * 60_000;

export type JoinGate =
  | { kind: "too-early"; minutesUntil: number }
  | { kind: "open" }                    // within 15 min before start, or live
  | { kind: "live" }
  | { kind: "ended" }
  | { kind: "cancelled" }
  | { kind: "unscheduled" };            // no scheduling record — legacy/ad-hoc

export const evaluateJoinGate = (s: ScheduledPodcastSession | undefined, now = Date.now()): JoinGate => {
  if (!s) return { kind: "unscheduled" };
  if (s.status === "cancelled") return { kind: "cancelled" };
  if (s.status === "ended") return { kind: "ended" };
  if (s.status === "live") return { kind: "live" };
  const diff = s.scheduledAt - now;
  if (diff > JOIN_WINDOW_MS) {
    return { kind: "too-early", minutesUntil: Math.ceil(diff / 60_000) };
  }
  return { kind: "open" };
};

/* ---------------- Local reminders (notifications) ---------------- */

const REMINDED_KEY = "wstudio.podcast.reminded.v1";
const readReminded = (): Record<string, number[]> => {
  try { return JSON.parse(localStorage.getItem(REMINDED_KEY) || "{}"); } catch { return {}; }
};
const writeReminded = (v: Record<string, number[]>) => {
  try { localStorage.setItem(REMINDED_KEY, JSON.stringify(v)); } catch {}
};

const OFFSETS_MS: { ms: number; label: string }[] = [
  { ms: 24 * 60 * 60_000, label: "in 24 hours" },
  { ms: 60 * 60_000, label: "in 1 hour" },
  { ms: 10 * 60_000, label: "in 10 minutes" },
];

const fireNotification = (title: string, body: string) => {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body });
      return;
    }
  } catch {}
  // soft fallback via custom event the lobby listens to (optional)
  try {
    window.dispatchEvent(new CustomEvent("wstudio:podcast-reminder", { detail: { title, body } }));
  } catch {}
};

/** Call once on app/lobby mount. Idempotent. */
export const schedulePodcastReminders = () => {
  if (typeof window === "undefined") return;
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    try { Notification.requestPermission(); } catch {}
  }
  const sweep = () => {
    const now = Date.now();
    const reminded = readReminded();
    let changed = false;
    PodcastSessionStore.list().forEach((s) => {
      if (s.status !== "upcoming") return;
      const fired = reminded[s.id] || [];
      OFFSETS_MS.forEach(({ ms, label }) => {
        const fireAt = s.scheduledAt - ms;
        if (now >= fireAt && now < s.scheduledAt && !fired.includes(ms)) {
          fireNotification(`"${s.title}" starts ${label}`, s.description || "W.STUDIO Podcast");
          fired.push(ms);
          changed = true;
        }
      });
      reminded[s.id] = fired;
    });
    if (changed) writeReminded(reminded);
  };
  sweep();
  const id = window.setInterval(sweep, 60_000);
  return () => window.clearInterval(id);
};
