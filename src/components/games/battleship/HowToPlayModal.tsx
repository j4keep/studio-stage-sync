import { Crosshair, Ship, Target, X } from "lucide-react";

const STEPS = [
  { Icon: Ship, title: "Place your fleet", body: "Pick a ship, tap the board to drop it, tap Rotate to turn it. Tap a placed ship again to pick it back up." },
  { Icon: Crosshair, title: "Take turns firing", body: "Once both fleets are set, tap a cell on Enemy Waters to fire. Red ✕ is a hit, a white dot is a miss." },
  { Icon: Target, title: "Sink the whole fleet", body: "Land every hit on a ship to sink it. First to sink all five of the opponent's ships wins." },
];

export default function HowToPlayModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/80 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-3xl border border-primary/30 p-5"
        style={{ background: "linear-gradient(180deg, hsl(232 42% 12%), hsl(234 45% 7%))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-white">How to Play Battleship</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-white/10 p-1.5 text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                <s.Icon className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-sm font-black text-white">{s.title}</p>
                <p className="text-xs text-white/60">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-primary py-3 text-sm font-black text-primary-foreground active:scale-[0.98]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
