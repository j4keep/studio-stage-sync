import { X } from "lucide-react";
import { LocationId } from "@/lib/neighborhood/map";

type Props = {
  locationId: LocationId | null;
  onClose: () => void;
};

const CONTENT: Partial<Record<LocationId, { title: string; blurb: string; accent: string }>> = {
  cafe: {
    title: "Cafe",
    blurb: "Warm light, the smell of fresh coffee, a chalkboard menu behind the counter. Maya's usually working the register out front.",
    accent: "#6B3FA0",
  },
  corner_store: {
    title: "Corner Store",
    blurb: "Shelves of snacks, a lotto sign in the window, and Ms. Rosa keeping an eye on the register.",
    accent: "#2FB6C4",
  },
  community_center: {
    title: "Community Center",
    blurb: "A bulletin board covered in flyers, a few folding tables, and Marcus running the front desk.",
    accent: "#FF7A59",
  },
};

/** Lightweight "you stepped inside" overlay — a Phase-1-appropriate stand-in for a fully
 *  modeled interior, per the brief's explicit allowance. */
export default function LocationOverlay({ locationId, onClose }: Props) {
  if (!locationId) return null;
  const content = CONTENT[locationId];
  if (!content) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#1c1430] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <p className="text-lg font-black uppercase tracking-wide text-white" style={{ color: content.accent }}>
            {content.title}
          </p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/60">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/75">{content.blurb}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-full py-2.5 text-sm font-black text-white"
          style={{ backgroundColor: content.accent }}
        >
          Step back outside
        </button>
      </div>
    </div>
  );
}
