import { X, Search, Plus, Sparkles, Film, Wand2, ImageIcon, Captions, Scissors } from "lucide-react";
import { CREATE_TOOLS, TEMPLATE_CATEGORIES, TEMPLATE_ITEMS } from "@/lib/create-modes";
import CreateModeTabs from "./CreateModeTabs";
import type { CreateMode } from "@/lib/create-modes";

const TOOL_ICONS: Record<string, typeof Sparkles> = {
  "ai-cast": Sparkles,
  "photo-editor": ImageIcon,
  autocut: Film,
  "ai-video": Wand2,
  "ai-image": ImageIcon,
  captions: Captions,
};

interface Props {
  createMode: CreateMode;
  onModeChange: (mode: CreateMode) => void;
  onClose: () => void;
  onNewVideo: () => void;
  onUploadVideo: () => void;
}

export default function CreateHubView({
  createMode,
  onModeChange,
  onClose,
  onNewVideo,
  onUploadVideo,
}: Props) {
  return (
    <div className="absolute inset-0 bg-black text-white flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2">
        <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center">
          <X className="w-6 h-6" />
        </button>
        <span className="text-sm font-black tracking-widest">CREATE</span>
        <div className="w-10" />
      </div>

      <div className="px-3 py-2 overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 min-w-max">
          {CREATE_TOOLS.map((tool) => {
            const Icon = TOOL_ICONS[tool.id] || Scissors;
            return (
              <button
                key={tool.id}
                type="button"
                className="flex flex-col items-center gap-1 w-[4.5rem] shrink-0"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[9px] text-white/70 text-center leading-tight">{tool.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-3 flex gap-3">
        <button
          type="button"
          onClick={onNewVideo}
          className="flex-1 h-28 rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-300 text-black flex flex-col items-center justify-center gap-2 font-bold"
        >
          <Plus className="w-8 h-8" />
          New video
        </button>
        <button
          type="button"
          onClick={onUploadVideo}
          className="w-28 h-28 rounded-2xl bg-zinc-900 border border-white/15 flex flex-col items-center justify-center gap-1 text-xs text-white/70"
        >
          <div className="w-full h-14 bg-zinc-800 rounded-t-2xl mb-1" />
          Upload any length
        </button>
      </div>

      <div className="px-4 flex items-center justify-between">
        <h2 className="text-base font-bold">Templates</h2>
        <button type="button" className="p-2 text-white/60">
          <Search className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 py-2 flex gap-4 overflow-x-auto scrollbar-hide border-b border-white/10">
        {TEMPLATE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`shrink-0 text-sm font-semibold pb-2 border-b-2 ${
              cat === "For You" ? "text-white border-white" : "text-white/45 border-transparent"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 grid grid-cols-2 gap-3 content-start">
        {TEMPLATE_ITEMS.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={onUploadVideo}
            className="rounded-xl overflow-hidden bg-zinc-900 border border-white/10 text-left"
          >
            <div className="aspect-[3/4] bg-gradient-to-br from-violet-600/40 to-orange-500/30" />
            <div className="p-2">
              <p className="text-sm font-bold truncate">{tpl.title}</p>
              <p className="text-[10px] text-white/50">
                {tpl.uses} videos · {tpl.clips} clips
              </p>
            </div>
          </button>
        ))}
      </div>

      <CreateModeTabs value={createMode} onChange={onModeChange} />
    </div>
  );
}
