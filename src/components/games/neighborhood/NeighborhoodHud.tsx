import { ArrowLeft, Hand, ListChecks, Pause, Sparkles, Volume2, VolumeX } from "lucide-react";
import { NeighborhoodState, nearestInteractable, waypointTarget } from "@/lib/neighborhood/engine";
import { activeMainMission, missionsCompleteCount, trackerProgressLabel, MISSIONS } from "@/lib/neighborhood/missions";
import NeighborhoodMiniMap from "./NeighborhoodMiniMap";

type Props = {
  st: NeighborhoodState;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onBack: () => void;
  onInteract: () => void;
  onOpenMissions: () => void;
};

export default function NeighborhoodHud({ st, muted, onToggleMute, onPause, onBack, onInteract, onOpenMissions }: Props) {
  const mission = activeMainMission(st.missions);
  const progress = mission ? st.missions[mission.id] : null;
  const done = missionsCompleteCount(st.missions);
  const wp = mission ? waypointTarget(st) : null;
  const dist = wp ? Math.round(Math.hypot(wp.x - st.x, wp.y - st.y) / 44) : null;
  const target = st.dialogue === null && st.openLocation === null ? nearestInteractable(st) : null;

  const interactLabel = target?.kind === "npc" ? "TALK" : target?.kind === "pickup" ? "PICK UP" : target?.kind === "location" ? "ENTER" : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none">
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="flex max-w-[220px] flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur"
              aria-label="Leave the neighborhood"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onOpenMissions}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white backdrop-blur"
            >
              <ListChecks className="h-3.5 w-3.5" />
              Missions {done}/{MISSIONS.length}
            </button>
          </div>

          {mission && progress && (
            <div className="rounded-lg border border-white/15 bg-black/45 px-3 py-2 backdrop-blur">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#FFD166]">{mission.title}</p>
              <p className="text-[11px] font-bold text-white">{mission.summary}</p>
              {trackerProgressLabel(mission, progress) && (
                <p className="mt-0.5 text-[10px] font-bold text-white/60">{trackerProgressLabel(mission, progress)}</p>
              )}
              {dist !== null && (
                <p className="mt-0.5 text-[10px] font-bold text-[#2FB6C4]">~{dist} blocks to {wp?.label}</p>
              )}
            </div>
          )}

          {st.carrying.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {st.carrying.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] font-bold text-white/85 backdrop-blur"
                >
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-2.5 py-1.5 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-[#FFD166]" />
              <span className="text-sm font-black tabular-nums text-white">{st.starsCollected.filter(Boolean).length}</span>
              <span className="text-[10px] font-bold text-white/50">/{st.starsCollected.length}</span>
            </div>
            <button
              type="button"
              onClick={onToggleMute}
              className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onPause}
              className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur"
              aria-label="Pause"
            >
              <Pause className="h-4 w-4" />
            </button>
          </div>

          <NeighborhoodMiniMap st={st} />
        </div>
      </div>

      {/* toast */}
      {st.toast && (
        <div className="absolute inset-x-0 top-24 flex justify-center">
          <p className="rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-black text-white backdrop-blur">
            {st.toast.text}
          </p>
        </div>
      )}

      {/* contextual interact button */}
      {interactLabel && (
        <div className="absolute inset-x-0 bottom-28 flex justify-center">
          <button
            type="button"
            onClick={onInteract}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#FF7A59] px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg"
          >
            <Hand className="h-4 w-4" />
            {interactLabel}
          </button>
        </div>
      )}
    </div>
  );
}
