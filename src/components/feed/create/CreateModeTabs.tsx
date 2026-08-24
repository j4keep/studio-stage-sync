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
    <div className="absolute bottom-[max(env(safe-area-inset-bottom),0.5rem)] left-0 right-0 z-30 flex items-center justify-center gap-6 pointer-events-auto px-4">
      {CREATE_MODES.map((mode) => (
        <div key={mode.id} className="flex items-center gap-1.5">
          {mode.id === "post" && value === "post" && onOpenGallery && (
            <button
              type="button"
              disabled={disabled}
              onClick={onOpenGallery}
              className="w-8 h-8 rounded-lg border border-white/25 bg-white/10 flex items-center justify-center text-white active:scale-95 disabled:opacity-40"
              aria-label="Upload from gallery"
            >
              <ImagePlus className="w-4 h-4" strokeWidth={2.25} />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(mode.id)}
            className={`text-sm font-black tracking-wide transition-all disabled:opacity-40 ${
              value === mode.id ? "text-white scale-105" : "text-white/45"
            }`}
          >
            {mode.label}
          </button>
        </div>
      ))}
    </div>
  );
}
