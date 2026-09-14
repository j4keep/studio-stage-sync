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
    <div
      className="absolute inset-x-0 z-30 flex items-center justify-center px-4 pointer-events-auto"
      style={{ bottom: "calc(max(env(safe-area-inset-bottom), 0.45rem) + 0.2rem)" }}
    >
      <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/60 p-1 shadow-2xl backdrop-blur-xl">
        {value === "post" && onOpenGallery && (
          <button
            type="button"
            disabled={disabled}
            onClick={onOpenGallery}
            className="ml-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition active:scale-95 disabled:opacity-40"
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
              className={`min-w-[4.7rem] rounded-full px-4 py-2.5 text-[13px] font-black tracking-wide transition active:scale-[0.98] disabled:opacity-40 ${
                selected ? "bg-white text-black shadow-sm" : "text-white/65"
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
