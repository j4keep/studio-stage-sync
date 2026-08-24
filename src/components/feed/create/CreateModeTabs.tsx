import type { CreateMode } from "@/lib/create-modes";
import { CREATE_MODES } from "@/lib/create-modes";

interface Props {
  value: CreateMode;
  onChange: (mode: CreateMode) => void;
  disabled?: boolean;
  onOpenGallery?: () => void;
}

export default function CreateModeTabs({ value, onChange, disabled }: Props) {
  return (
    <div className="absolute bottom-[max(env(safe-area-inset-bottom),0.45rem)] left-0 right-0 z-30 flex items-center justify-center pointer-events-auto px-4">
      <div className="rounded-full bg-black/35 border border-white/15 backdrop-blur-xl px-1.5 py-1 flex items-center gap-1 shadow-lg">
        {CREATE_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(mode.id)}
            className={`min-w-[5.25rem] rounded-full px-4 py-2 text-xs font-extrabold tracking-wide transition-all disabled:opacity-40 ${
              value === mode.id ? "bg-white text-black shadow-md" : "text-white/70"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}
