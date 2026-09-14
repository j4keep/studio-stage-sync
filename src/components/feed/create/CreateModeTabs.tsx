import { ImagePlus } from "lucide-react";
import type { CreateMode } from "@/lib/create-modes";
import { CREATE_MODES } from "@/lib/create-modes";

interface Props {
  value: CreateMode;
  onChange: (mode: CreateMode) => void;
  disabled?: boolean;
  onOpenGallery?: () => void;
}

export default function CreateModeTabs({ value, onChange, disabled, onOpenGallery }: Props) {
  return (
    <div className="absolute bottom-[max(env(safe-area-inset-bottom),0.6rem)] left-0 right-0 z-30 flex items-center justify-center pointer-events-auto px-4">
      <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/45 p-1.5 shadow-xl backdrop-blur-md">
        {value === "post" && onOpenGallery && (
          <button
            type="button"
            disabled={disabled}
            onClick={onOpenGallery}
            className="mr-1 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition active:scale-95 disabled:opacity-40"
            aria-label="Open photo and video library"
            title="Open library"
          >
            <ImagePlus className="h-4 w-4" strokeWidth={2.25} />
          </button>
        )}

        {CREATE_MODES.map((mode) => {
          const selected = value === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(mode.id)}
              className={`min-w-[4.6rem] rounded-full px-4 py-2 text-[13px] font-black tracking-wide transition active:scale-[0.98] disabled:opacity-40 ${
                selected ? "bg-white text-black shadow-sm" : "text-white/60"
              }`}
              aria-pressed={selected}
            >
              {mode.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
