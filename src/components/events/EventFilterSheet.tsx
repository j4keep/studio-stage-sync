import { useState } from "react";
import { X } from "lucide-react";

export const EVENT_CATEGORIES = [
  { id: "business", label: "Business" },
  { id: "music", label: "Music" },
  { id: "arts", label: "Performing & visual arts" },
  { id: "health", label: "Health" },
  { id: "food", label: "Food & drink" },
  { id: "community", label: "Community" },
  { id: "sports", label: "Sports & fitness" },
  { id: "tech", label: "Science & tech" },
  { id: "party", label: "Party & nightlife" },
  { id: "gaming", label: "Gaming" },
  { id: "family", label: "Family & kids" },
  { id: "other", label: "Other" },
];

export type PriceFilter = "free" | "25" | "50" | "any";
export type SortFilter = "relevance" | "date";

export type EventFilters = {
  categories: string[];
  price: PriceFilter;
  sort: SortFilter;
};

export const DEFAULT_EVENT_FILTERS: EventFilters = {
  categories: [],
  price: "any",
  sort: "relevance",
};

const PRICES: { id: PriceFilter; label: string }[] = [
  { id: "free", label: "Free events only" },
  { id: "25", label: "$25 and under" },
  { id: "50", label: "$50 and under" },
  { id: "any", label: "Any price" },
];

const SORTS: { id: SortFilter; label: string }[] = [
  { id: "relevance", label: "Relevance" },
  { id: "date", label: "Date" },
];

/** Eventbrite-style filter sheet: categories, ticket price and sort. */
export default function EventFilterSheet({
  value,
  onApply,
  onClose,
}: {
  value: EventFilters;
  onApply: (f: EventFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<EventFilters>(value);
  const [showAll, setShowAll] = useState(false);
  const cats = showAll ? EVENT_CATEGORIES : EVENT_CATEGORIES.slice(0, 8);

  const toggleCat = (id: string) =>
    setDraft((d) => ({
      ...d,
      categories: d.categories.includes(id)
        ? d.categories.filter((c) => c !== id)
        : [...d.categories, id],
    }));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-xl font-black tracking-tight">Filter</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1">
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <section className="pt-5">
          <h3 className="text-base font-black">Category</h3>
          <div className="mt-2 divide-y divide-border">
            {cats.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCat(c.id)}
                className="flex w-full items-center justify-between py-3 text-left"
              >
                <span className="text-[15px]">{c.label}</span>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded border ${
                    draft.categories.includes(c.id)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border"
                  }`}
                >
                  {draft.categories.includes(c.id) ? "✓" : ""}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-2 text-sm font-bold underline-offset-2"
          >
            {showAll ? "Show less" : "Show all"}
          </button>
        </section>

        <section className="mt-6 border-t border-border pt-5">
          <h3 className="text-base font-black">Ticket price</h3>
          <div className="mt-2">
            {PRICES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, price: p.id }))}
                className="flex w-full items-center justify-between py-3 text-left"
              >
                <span className="text-[15px]">{p.label}</span>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    draft.price === p.id ? "border-primary" : "border-border"
                  }`}
                >
                  {draft.price === p.id ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6 border-t border-border pt-5">
          <h3 className="text-base font-black">Sort by</h3>
          <div className="mt-2">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, sort: s.id }))}
                className="flex w-full items-center justify-between py-3 text-left"
              >
                <span className="text-[15px]">{s.label}</span>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    draft.sort === s.id ? "border-primary" : "border-border"
                  }`}
                >
                  {draft.sort === s.id ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 pb-6">
        <button
          type="button"
          onClick={() => setDraft(DEFAULT_EVENT_FILTERS)}
          className="text-sm font-semibold text-muted-foreground underline"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => {
            onApply(draft);
            onClose();
          }}
          className="h-12 flex-1 rounded-full bg-primary text-sm font-bold text-primary-foreground"
        >
          Apply filters
        </button>
      </div>
    </div>
  );
}
