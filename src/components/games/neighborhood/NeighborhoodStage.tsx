import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import {
  NInput,
  NO_INPUT,
  NeighborhoodEvent,
  NeighborhoodState,
  acceptMission,
  closeDialogue,
  closeLocation,
  deliverMission,
  performInteract,
  step,
} from "@/lib/neighborhood/engine";
import {
  neighborhoodAmbienceStart,
  neighborhoodAmbienceStop,
  neighborhoodSetMuted,
  neighborhoodSfx,
} from "@/lib/neighborhood-sfx";
import { Camera, drawNeighborhood, makeCamera } from "./render";
import NeighborhoodHud from "./NeighborhoodHud";
import NeighborhoodControls from "./NeighborhoodControls";
import NeighborhoodAvatars from "./NeighborhoodAvatars";
import DialogueOverlay from "./DialogueOverlay";
import MissionListSheet from "./MissionListSheet";
import LocationOverlay from "./LocationOverlay";

type Props = {
  initial: NeighborhoodState;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  /** Fired right after a meaningful progress event (mission accepted/completed, star, discovery,
   *  item pickup) so the page can checkpoint-save immediately, plus on pause (event undefined). */
  onCheckpoint: (st: NeighborhoodState, event?: NeighborhoodEvent) => void;
};

export default function NeighborhoodStage({ initial, muted, onToggleMute, onBack, onCheckpoint }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stRef = useRef<NeighborhoodState>(initial);
  const camRef = useRef<Camera | undefined>(undefined);
  const inputRef = useRef<NInput>({ ...NO_INPUT });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    neighborhoodSetMuted(muted);
    if (!muted) neighborhoodAmbienceStart();
  }, [muted]);

  useEffect(() => {
    neighborhoodSfx.unlock();
    neighborhoodAmbienceStart();
    return () => neighborhoodAmbienceStop();
  }, []);

  const dialogueOpen = stRef.current.dialogue !== null;
  const locationOpen = stRef.current.openLocation !== null;
  const suspended = paused || missionsOpen || dialogueOpen || locationOpen;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      const g = canvas.getContext("2d");
      if (g) g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const g = canvas.getContext("2d");
      if (!g) return;
      const rect = canvas.getBoundingClientRect();
      const dt = lastRef.current ? Math.min(80, now - lastRef.current) : 16;
      lastRef.current = now;

      const isSuspended = paused || missionsOpen;
      if (!isSuspended) {
        const next = step(stRef.current, inputRef.current, dt);
        stRef.current = next;
        for (const ev of next.events) {
          if (ev === "star") neighborhoodSfx.star();
          else if (ev === "item_pickup") neighborhoodSfx.itemPickup();
          else if (ev === "npc_interact") neighborhoodSfx.npcInteract();
          else if (ev === "discovery") neighborhoodSfx.locationDiscovery();
          else if (ev === "mission_accepted") neighborhoodSfx.missionAccepted();
          else if (ev === "mission_completed") neighborhoodSfx.missionCompleted();
          if (ev === "mission_accepted" || ev === "mission_completed" || ev === "star" || ev === "discovery") {
            onCheckpoint(stRef.current, ev);
          }
        }
      }

      camRef.current = makeCamera(stRef.current, rect.width, rect.height, camRef.current);
      drawNeighborhood(g, stRef.current, camRef.current, rect.width, rect.height);
      setTick((t) => (t + 1) % 1_000_000);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = 0;
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, missionsOpen, onCheckpoint]);

  const st = stRef.current;

  const doInteract = () => {
    stRef.current = performInteract(stRef.current);
    for (const ev of stRef.current.events) {
      if (ev === "npc_interact") neighborhoodSfx.npcInteract();
      if (ev === "item_pickup") {
        neighborhoodSfx.itemPickup();
        onCheckpoint(stRef.current, "item_pickup");
      }
    }
    setTick((t) => t + 1);
  };

  const doAccept = (missionId: string) => {
    stRef.current = acceptMission(stRef.current, missionId as any);
    neighborhoodSfx.missionAccepted();
    onCheckpoint(stRef.current, "mission_accepted");
    setTick((t) => t + 1);
  };

  const doDeliver = (missionId: string) => {
    stRef.current = deliverMission(stRef.current, missionId as any);
    neighborhoodSfx.missionCompleted();
    onCheckpoint(stRef.current, "mission_completed");
    setTick((t) => t + 1);
  };

  const doCloseDialogue = () => {
    stRef.current = closeDialogue(stRef.current);
    setTick((t) => t + 1);
  };

  const doCloseLocation = () => {
    stRef.current = closeLocation(stRef.current);
    setTick((t) => t + 1);
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#cfe9d8]">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />
      <NeighborhoodAvatars stateRef={stRef} cameraRef={camRef} />

      <NeighborhoodHud
        st={st}
        muted={muted}
        onToggleMute={onToggleMute}
        onPause={() => {
          setPaused((p) => !p);
          onCheckpoint(stRef.current);
        }}
        onBack={onBack}
        onInteract={doInteract}
        onOpenMissions={() => setMissionsOpen(true)}
      />

      {!suspended && <NeighborhoodControls input={inputRef} />}

      <DialogueOverlay dialogue={st.dialogue} onAccept={doAccept} onDeliver={doDeliver} onClose={doCloseDialogue} />
      <MissionListSheet open={missionsOpen} missions={st.missions} onClose={() => setMissionsOpen(false)} />
      <LocationOverlay locationId={st.openLocation} onClose={doCloseLocation} />

      {paused && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center backdrop-blur-sm">
          <p className="text-2xl font-black uppercase tracking-widest text-white">Paused</p>
          <p className="max-w-[300px] text-xs text-white/60">
            Drag anywhere to move. Talk to people, pick up mission items, and find hidden YAJ Stars around the block.
          </p>
          <button
            type="button"
            onClick={() => setPaused(false)}
            className="flex items-center gap-2 rounded-full bg-[#FF7A59] px-6 py-3 text-sm font-black text-white"
          >
            <Play className="h-4 w-4" /> Resume
          </button>
          <button type="button" onClick={onBack} className="text-xs font-bold text-white/60 underline">
            Leave the neighborhood
          </button>
        </div>
      )}
    </div>
  );
}
