import type { CreateMode } from "@/lib/create-modes";
import { CREATE_MODES } from "@/lib/create-modes";

interface Props {
  value: CreateMode;
  onChange: (mode: CreateMode) => void;
  disabled?: boolean;
}

export default function CreateModeTabs({ value, onChange, disabled }: Props) {
  return (
    <div className="absolute bottom-[max(env(safe-area-inset-bottom),0.5rem)] left-0 right-0 z-30 flex items-center justify-center gap-8 pointer-events-auto">
      {CREATE_MODES.map((mode) => (
        <button
          key={mode.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(mode.id)}
          className={`text-sm font-black tracking-wide transition-all disabled:opacity-40 ${
            value === mode.id ? "text-white scale-105" : "text-white/45"
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
