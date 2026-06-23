import { useState } from "react";
import { Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  STICKER_CATEGORIES,
  getStickersByCategory,
  loadRecentStickers,
  pushRecentSticker,
  type StickerCategory,
} from "@/lib/sticker-library";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (stickerId: string) => void;
}

export default function StickerDrawer({ open, onClose, onPick }: Props) {
  const [category, setCategory] = useState<StickerCategory>("recent");
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>(() => loadRecentStickers());

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
        className="fixed inset-0 z-[92] bg-black/40"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-[93] mx-auto max-w-lg rounded-t-2xl bg-zinc-900 border-t border-white/10 flex flex-col max-h-[min(58dvh,480px)] safe-area-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
          <div className="flex-1 flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2">
            <Search className="w-4 h-4 text-white/40 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search stickers"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-white/70">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-1 px-2 py-2 overflow-x-auto scrollbar-hide border-b border-white/10">
          {STICKER_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                category === c.id ? "bg-white text-black" : "text-white/60 hover:text-white"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 scrollbar-hide">
          {stickers.length === 0 ? (
            <p className="text-center text-white/40 text-sm py-8">No stickers here yet</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {stickers.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handlePick(s.id)}
                  className="aspect-square rounded-xl bg-white/5 border border-white/10 p-2 hover:bg-white/12 active:scale-95 transition-all"
                >
                  <img src={s.src} alt={s.label} className="w-full h-full object-contain drop-shadow-md" />
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
