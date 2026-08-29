import { Circle, RectangleHorizontal, Ban, SwitchCamera, X } from "lucide-react";

export type DualCameraLayout = "none" | "rectangle" | "circle";

type Props = {
  open: boolean;
  layout: DualCameraLayout;
  onLayoutChange: (layout: DualCameraLayout) => void;
  onClose: () => void;
  dualSupported?: boolean;
};

const OPTIONS: {
  id: DualCameraLayout;
  label: string;
  icon: typeof Ban;
}[] = [
  { id: "none", label: "None", icon: Ban },
  { id: "rectangle", label: "Rectangle", icon: RectangleHorizontal },
  { id: "circle", label: "Circle", icon: Circle },
];

/**
 * BIGO-style dual camera layout picker — front + back at once.
 * None turns dual off; Rectangle / Circle set the PiP shape.
 */
export default function DualCameraLayoutSheet({
  open,
  layout,
  onLayoutChange,
  onClose,
  dualSupported = true,
}: Props) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="w-full rounded-t-3xl bg-white px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-4 text-black"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
            <SwitchCamera className="h-4.5 w-4.5" />
          </span>
          <h2 className="text-[15px] font-black">Dual camera layout</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-700"
            aria-label="Close"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        <p className="mb-5 text-center text-[12px] text-neutral-500">
          Dual camera uses both the front and back cameras.
        </p>
        {!dualSupported && (
          <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-center text-[11px] font-semibold text-amber-800">
            This device may not run front and back cameras at the same time. We’ll try — if it fails, stay on one camera.
          </p>
        )}
        <div className="flex items-center justify-center gap-6 pb-2">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = layout === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onLayoutChange(opt.id)}
                className="flex flex-col items-center gap-2"
                aria-label={opt.label}
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-full border-2 ${
                    selected ? "border-sky-500 bg-sky-50 text-sky-600" : "border-neutral-200 bg-neutral-50 text-neutral-500"
                  }`}
                >
                  <Icon className="h-6 w-6" strokeWidth={selected ? 2.5 : 2} />
                </span>
                <span className={`text-[11px] font-bold ${selected ? "text-sky-600" : "text-neutral-500"}`}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
