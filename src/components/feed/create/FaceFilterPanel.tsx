import { FACE_FILTERS, type FaceFilterId } from "@/hooks/useFaceFilters";

interface Props {
  open: boolean;
  onClose: () => void;
  selectedId: FaceFilterId;
  onSelect: (id: FaceFilterId) => void;
  loading?: boolean;
  error?: string | null;
}

/** Snapchat/Instagram/TikTok-style AR face filters — tracks your face in real time
 *  (see useFaceFilters) and draws stickers anchored to it, rather than a static overlay. */
export default function FaceFilterPanel({ open, onClose, selectedId, onSelect, loading, error }: Props) {
  if (!open) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 rounded-t-2xl bg-black/92 backdrop-blur-xl border-t border-white/10 flex flex-col pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-sm font-bold text-white">Face Filters</span>
        <button type="button" onClick={onClose} className="text-white text-xs font-bold px-2">
          Done
        </button>
      </div>

      {loading && <p className="px-3 pt-2 text-[11px] text-white/50">Loading filter…</p>}
      {error && <p className="px-3 pt-2 text-[11px] text-red-400">{error}</p>}

      <div className="max-h-[42dvh] overflow-y-auto">
        <div className="grid grid-cols-4 gap-2 p-3">
          {FACE_FILTERS.map((f) => {
            const active = selectedId === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onSelect(f.id)}
                className={`flex flex-col items-center gap-1 rounded-xl p-2 transition-all ${active ? "bg-white/15" : "bg-white/5"}`}
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-2xl ${active ? "border-white" : "border-white/10"}`}>
                  {f.emoji}
                </span>
                <span className="text-[10px] text-white/90 text-center leading-tight truncate w-full">{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
