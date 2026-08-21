import { Crosshair, Radar, Ship, Target, X } from "lucide-react";

const STEPS = [
  { Icon: Ship, title: "Place your fleet", body: "Pick a boat, tap the water to drop it, tap Rotate to turn it. Tap a placed boat again to pick it back up." },
  { Icon: Crosshair, title: "Find the enemy", body: "Once both fleets are set, tap a water sector in Enemy Waters, then tap FIRE. A splash means you missed; a hit shows damage." },
  { Icon: Radar, title: "Watch for hits", body: "Successful shots reveal enemy positions. Use Sonar Pulse once or twice a match to scan a small zone for a boat without revealing the exact tile." },
  { Icon: Target, title: "Take down the fleet", body: "Disable every enemy boat to win. First to sink all five of the opponent's boats takes the waters." },
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
          <h2 className="text-lg font-black text-white">How to Play YAJ Fleet Clash</h2>
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
          Start Battle
        </button>
      </div>
    </div>
  );
}
