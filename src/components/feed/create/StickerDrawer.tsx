import { useState, useRef, useEffect } from "react";
import {
  Search,
  X,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  STICKER_CATEGORIES,
  getStickersByCategory,
  getSuggestedStickers,
  loadRecentStickers,
  pushRecentSticker,
  type StickerCategory,
  type StickerDef,
} from "@/lib/sticker-library";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (stickerId: string) => void;
  mediaType: "image" | "video";
  hasMusic?: boolean;
  caption?: string;
}

export default function StickerDrawer({
  open,
  onClose,
  onPick,
  mediaType,
  hasMusic = false,
  caption = "",
}: Props) {
  const [category, setCategory] = useState<StickerCategory>("trending");
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>(() => loadRecentStickers());

  const suggestions = getSuggestedStickers({
    mediaType,
    hasMusic,
    caption,
    likelyHasFace: mediaType === "video" || mediaType === "image",
  });
  const stickers = getStickersByCategory(category, recent, query);

  const handlePick = (id: string) => {
    setRecent(pushRecentSticker(id));
    onPick(id);
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[92] bg-black/50"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-[93] mx-auto max-w-lg rounded-t-2xl bg-zinc-950 border-t border-white/10 flex flex-col max-h-[min(62dvh,520px)] safe-area-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
          <div className="flex-1 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2.5">
            <Search className="w-4 h-4 text-white/50 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sticker packs"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
              inputMode="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-white/80 rounded-full active:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Smart suggestions */}
        {suggestions.length > 0 && !query && (
          <div className="px-3 pt-2 pb-1 border-b border-white/5">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300">Suggested for you</span>
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {suggestions.slice(0, 8).map((s) => (
                <SuggestionChip key={s.id} sticker={s} onPick={() => handlePick(s.id)} />
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-1.5 px-2 py-2 overflow-x-auto scrollbar-hide border-b border-white/10">
          {STICKER_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                category === c.id
                  ? "bg-violet-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.5)]"
                  : "text-white/55 bg-white/5"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 scrollbar-hide overscroll-contain">
          {stickers.length === 0 ? (
            <p className="text-center text-white/40 text-sm py-10">No stickers in this pack</p>
          ) : (
            <div className="grid grid-cols-4 gap-2.5">
              {stickers.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handlePick(s.id)}
                  className="aspect-square rounded-2xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-2.5 hover:border-violet-400/40 active:scale-95 transition-all shadow-inner"
                >
                  <img src={s.src} alt={s.label} className="w-full h-full object-contain drop-shadow-lg" draggable={false} />
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function SuggestionChip({ sticker, onPick }: { sticker: StickerDef; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="shrink-0 w-14 h-14 rounded-xl bg-violet-500/15 border border-violet-400/30 p-1.5 active:scale-95"
    >
      <img src={sticker.src} alt={sticker.label} className="w-full h-full object-contain" draggable={false} />
    </button>
  );
}
