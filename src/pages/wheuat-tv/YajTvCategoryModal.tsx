import { X, Check } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_MENU, type CategorySelection } from "./yajTvMeta";

export function YajTvCategoryModal({
  open,
  current,
  onSelect,
  onClose,
}: {
  open: boolean;
  current: CategorySelection;
  onSelect: (c: CategorySelection) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-black/97 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-3">
        <h2 className="text-lg font-bold text-white">Browse YAJ.TV</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATEGORY_MENU.map((key) => {
            const active = key === current;
            return (
              <button
                key={key}
                onClick={() => {
                  onSelect(key);
                  onClose();
                }}
                className={`flex items-center justify-between rounded-xl border px-3.5 py-3 text-left text-sm font-semibold transition-colors ${
                  active
                    ? "border-white bg-white text-black"
                    : "border-white/15 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                {CATEGORY_LABELS[key]}
                {active && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
