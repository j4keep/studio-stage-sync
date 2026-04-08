import type { FxInsertSlot } from "./types";
import { useDaw } from "./DawContext";

type Props = {
  slots: FxInsertSlot[];
};

const slotFilled =
  "flex h-[12px] w-full cursor-pointer items-center justify-center truncate rounded-[3px] border border-[#0a4a72] bg-gradient-to-b from-[#4a98cc] to-[#2870a6] px-0.5 text-center text-[7px] font-semibold leading-none text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]";
const slotEmpty =
  "flex h-[12px] w-full cursor-pointer items-center justify-center truncate rounded-[3px] border border-[#2c2c30] bg-[#1a1a1e] px-0.5 text-center text-[7px] leading-none text-[#5a5a60] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]";

/** Logic-style insert ladder — full-width cyan when loaded, charcoal when empty */
export function TrackPluginSlots({ slots }: Props) {
  const daw = useDaw();
  return (
    <div className="flex w-full flex-col gap-[2px]">
      {[0, 1, 2, 3].map((i) => {
        const s = slots[i];
        const filled = Boolean(s?.pluginId);
        return (
          <button
            key={s?.id ?? `fx-slot-${i}`}
            type="button"
            title={filled ? `FX: ${s!.pluginId}` : `Empty insert ${i + 1}`}
            onClick={() => {
              daw.setStudioToolSheet("fx_rack");
            }}
            className={filled ? slotFilled : slotEmpty}
            style={{ position: "relative", zIndex: 15, pointerEvents: "auto" }}
          >
            {filled ? s!.pluginId : "—"}
          </button>
        );
      })}
    </div>
  );
}

export function InsertRowPlaceholder() {
  return (
    <div className="flex w-full flex-col gap-[2px]">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-[12px] w-full rounded-[3px] border border-[#2c2c30] bg-[#1a1a1d] shadow-[inset_0_2px_4px_rgba(0,0,0,0.45)]"
        />
      ))}
    </div>
  );
}
