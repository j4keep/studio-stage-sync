import type { FxInsertSlot } from "./types";
import { useDaw } from "./DawContext";

type Props = {
  slots: FxInsertSlot[];
};

/** Compact insert ladder for mixer strip; opens FX rack sheet on slot tap. */
export function TrackPluginSlots({ slots }: Props) {
  const daw = useDaw();
  return (
    <div className="flex w-full flex-col gap-px">
      {[0, 1, 2, 3].map((i) => {
        const s = slots[i];
        return (
          <button
            key={s?.id ?? `fx-slot-${i}`}
            type="button"
            title={s?.pluginId ? `FX: ${s.pluginId}` : `Insert slot ${i + 1}`}
            onClick={() => {
              daw.setStudioToolSheet("fx_rack");
            }}
            className="h-[9px] max-h-[9px] w-full cursor-pointer truncate rounded-[2px] border border-[#333] bg-[#181818] px-0.5 text-left text-[6px] leading-[9px] text-[#bbb] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            style={{ position: "relative", zIndex: 20, pointerEvents: "auto" }}
          >
            {s?.pluginId ?? "·"}
          </button>
        );
      })}
    </div>
  );
}

export function InsertRowPlaceholder() {
  return <div className="h-[39px] w-full rounded-[2px] border border-[#454549] bg-[#2a2a2e]" />;
}
