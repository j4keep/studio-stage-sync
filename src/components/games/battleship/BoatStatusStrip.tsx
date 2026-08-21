import { Check, Flame, Skull } from "lucide-react";
import { Fleet, SHIP_LABELS, SHIP_ORDER } from "@/lib/battleship";
import { damageTier } from "./render";

/** Small per-boat status row for the player's own fleet — the opponent's individual boats
 *  stay hidden behind fog of war, so this only ever renders a known fleet (never null). */
export default function BoatStatusStrip({ fleet }: { fleet: Fleet | null }) {
  if (!fleet) return null;
  return (
    <div className="mx-auto flex max-w-[340px] flex-wrap justify-center gap-1.5">
      {SHIP_ORDER.map((id) => {
        const ship = fleet.find((s) => s.id === id);
        const tier = ship ? damageTier(ship.hits) : "healthy";
        const Icon = tier === "disabled" ? Skull : tier === "healthy" ? Check : Flame;
        const tone =
          tier === "disabled"
            ? "border-white/10 bg-white/5 text-white/40"
            : tier === "healthy"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              : "border-amber-400/30 bg-amber-400/10 text-amber-300";
        return (
          <span key={id} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone}`}>
            <Icon className="h-3 w-3" />
            {SHIP_LABELS[id]}
          </span>
        );
      })}
    </div>
  );
}
