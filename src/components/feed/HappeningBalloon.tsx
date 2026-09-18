import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  Handshake,
  ShoppingBag,
  Sparkles,
  Tv,
  Wrench,
} from "lucide-react";
import type { HappeningItem, HappeningKind } from "@/lib/happening-items";
import { happeningKindLabel } from "@/lib/happening-items";

const SETTING_KEY = "yaj_happening_balloons";
const CATEGORY_KEY = "yaj_happening_balloon_categories";
const SETTING_EVENT = "yaj-happening-balloon-setting";

export const HAPPENING_BALLOON_CATEGORIES: Array<{ kind: HappeningKind; label: string }> = [
  { kind: "job", label: "Jobs" },
  { kind: "marketplace", label: "Marketplace" },
  { kind: "gig", label: "Gigs" },
  { kind: "service", label: "Services" },
  { kind: "event", label: "Events" },
  { kind: "tv", label: "YAJ TV" },
  { kind: "post", label: "Posts" },
];

const DEFAULT_CATEGORIES = HAPPENING_BALLOON_CATEGORIES.map((item) => item.kind);

const ICONS: Record<HappeningKind, typeof Sparkles> = {
  post: Sparkles,
  marketplace: ShoppingBag,
  job: BriefcaseBusiness,
  gig: Handshake,
  tv: Tv,
  service: Wrench,
  event: CalendarDays,
};

const ACCENTS: Record<HappeningKind, string> = {
  post: "from-violet-500 to-fuchsia-500",
  marketplace: "from-emerald-400 to-teal-500",
  job: "from-blue-500 to-cyan-400",
  gig: "from-orange-400 to-rose-500",
  tv: "from-fuchsia-500 to-violet-600",
  service: "from-amber-400 to-orange-500",
  event: "from-rose-500 to-red-500",
};

export function happeningBalloonsEnabled() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(SETTING_KEY) !== "false";
}

export function setHappeningBalloonsEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTING_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent(SETTING_EVENT, { detail: { enabled } }));
}

export function getHappeningBalloonCategories(): HappeningKind[] {
  if (typeof window === "undefined") return DEFAULT_CATEGORIES;
  try {
    const raw = window.localStorage.getItem(CATEGORY_KEY);
    if (!raw) return DEFAULT_CATEGORIES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_CATEGORIES;
    const valid = new Set(DEFAULT_CATEGORIES);
    return parsed.filter((kind): kind is HappeningKind => valid.has(kind));
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export function setHappeningBalloonCategories(categories: HappeningKind[]) {
  if (typeof window === "undefined") return;
  const valid = new Set(DEFAULT_CATEGORIES);
  const next = Array.from(new Set(categories.filter((kind) => valid.has(kind))));
  window.localStorage.setItem(CATEGORY_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(SETTING_EVENT, { detail: { categories: next } }));
}

type Props = {
  items: HappeningItem[];
  currentSourceId?: string | null;
  onOpen: (item: HappeningItem) => void;
};

/**
 * Lightweight discovery nudge shown only while a user is inside an opened Feed post.
 * It reuses the same Happening data/routes as the home rail instead of creating a
 * second activity system.
 */
export default function HappeningBalloon({ items, currentSourceId, onOpen }: Props) {
  const [enabled, setEnabled] = useState(happeningBalloonsEnabled);
  const [categories, setCategories] = useState<HappeningKind[]>(getHappeningBalloonCategories);
  const [visible, setVisible] = useState(false);
  const [cursor, setCursor] = useState(0);

  const candidates = useMemo(
    () =>
      items
        .filter((item) => categories.includes(item.kind))
        .filter((item) => !(item.kind === "post" && item.sourceId === currentSourceId))
        .slice(0, 12),
    [categories, currentSourceId, items],
  );

  useEffect(() => {
    const sync = (event?: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean; categories?: HappeningKind[] }> | undefined)?.detail;
      setEnabled(typeof detail?.enabled === "boolean" ? detail.enabled : happeningBalloonsEnabled());
      setCategories(Array.isArray(detail?.categories) ? detail.categories : getHappeningBalloonCategories());
    };
    window.addEventListener(SETTING_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SETTING_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    setCursor(0);
    setVisible(false);
    if (!enabled || candidates.length === 0) return;

    const entrance = window.setTimeout(() => setVisible(true), 3200);
    const rotate = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setCursor((value) => (value + 1) % candidates.length);
        setVisible(true);
      }, 420);
    }, 9000);

    return () => {
      window.clearTimeout(entrance);
      window.clearInterval(rotate);
    };
  }, [candidates.length, currentSourceId, enabled]);

  if (!enabled || !visible || candidates.length === 0) return null;

  const item = candidates[cursor % candidates.length];
  const Icon = ICONS[item.kind];

  return (
    <div className="pointer-events-none absolute left-1/2 top-[calc(env(safe-area-inset-top)+4rem)] z-[78] max-w-[min(84vw,320px)] -translate-x-1/2 sm:top-5">
      <div className="yaj-happening-balloon-enter">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(item);
          }}
          className="yaj-happening-balloon-drift pointer-events-auto group relative flex min-w-[210px] max-w-[310px] items-center gap-2.5 rounded-[28px] border border-white/25 bg-black/78 p-2.5 pr-4 text-left text-white shadow-[0_18px_45px_rgba(0,0,0,0.38)] backdrop-blur-xl active:scale-[0.97]"
          aria-label={`Open ${happeningKindLabel(item.kind)}: ${item.title}`}
        >
          <span className={`relative flex h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gradient-to-br ${ACCENTS[item.kind]} shadow-lg ring-2 ring-white/25`}>
            {item.coverUrl ? (
              <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <Icon className="h-5 w-5" />
              </span>
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-[0.13em] text-white/70">Happening</span>
              <span className={`rounded-full bg-gradient-to-r ${ACCENTS[item.kind]} px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-white`}>
                {happeningKindLabel(item.kind)}
              </span>
            </span>
            <span className="mt-1 block truncate text-[12px] font-extrabold leading-tight">{item.title}</span>
            <span className="mt-0.5 block text-[9px] font-semibold text-white/60">Tap to open</span>
          </span>

          <span className="absolute -bottom-2 right-8 h-5 w-5 rotate-45 rounded-br-[7px] bg-black/78" />
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-primary/90 shadow-[0_0_16px_hsl(var(--primary))]" />
          <span className="absolute -right-4 top-7 h-2 w-2 rounded-full bg-white/55" />
        </button>
      </div>
    </div>
  );
}
