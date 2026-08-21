import { X, Circle, CircleDot, CircleCheck } from "lucide-react";
import { MISSIONS, MissionsState } from "@/lib/neighborhood/missions";

type Props = {
  open: boolean;
  missions: MissionsState;
  onClose: () => void;
};

/** A compact list, not a big quest log — five lines, statuses, done. */
export default function MissionListSheet({ open, missions, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="mb-6 w-[92%] max-w-sm rounded-2xl border border-white/15 bg-[#241a3d] p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-black uppercase tracking-wide text-white">Missions</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {MISSIONS.map((m) => {
            const status = missions[m.id].status;
            return (
              <div key={m.id} className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                {status === "complete" ? (
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2FB6C4]" />
                ) : status === "active" ? (
                  <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-[#FFD166]" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
                )}
                <div>
                  <p className={`text-xs font-black ${status === "complete" ? "text-white/50 line-through" : "text-white"}`}>{m.title}</p>
                  <p className="text-[11px] text-white/60">{m.summary}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
