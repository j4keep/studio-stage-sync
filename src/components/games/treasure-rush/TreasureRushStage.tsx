import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import { Hand, Play, X } from "lucide-react";
import ObbyAvatar from "@/components/games/obby/ObbyAvatar";
import { useCharacterAppearance } from "@/contexts/CharacterAppearanceContext";
import LostCityScene from "@/components/games/treasure-rush/LostCityScene";
import TreasureRushHud, { HudSnapshot } from "@/components/games/treasure-rush/TreasureRushHud";
import TreasureStick from "@/components/games/treasure-rush/TreasureStick";
import { TrState, initialTreasureRush, promptFor, step } from "@/lib/treasure-rush/engine";
import { breakdownOf, liveScore, ScoreBreakdown } from "@/lib/treasure-rush/score";
import { trSfx } from "@/lib/treasure-rush-sfx";

export type TrOutcome = ScoreBreakdown & {
  status: TrState["status"];
  hearts: number;
  coins: number;
  gems: number;
  chests: number;
  goldChests: number;
};

type Props = {
  runKey: number;
  myColor: string;
  best?: number | null;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  onQuit?: () => void;
  onEnd: (outcome: TrOutcome) => void;
  /** Solo mode: no countdown or timeup fail — only hearts or a manual quit end the run. */
  noTimer?: boolean;
};

/** Runs the engine each frame and keeps the camera trailing the explorer. */
function Explorer({
  state,
  inputRef,
  pausedRef,
  color,
  onEvents,
}: {
  state: React.MutableRefObject<TrState>;
  inputRef: React.MutableRefObject<{ ax: number; az: number; interact: boolean }>;
  pausedRef: React.MutableRefObject<boolean>;
  color: string;
  onEvents: (evts: string[]) => void;
}) {
  const rig = useRef<Group>(null);
  const { camera } = useThree();
  const { skinTone } = useCharacterAppearance();

  useFrame((_, dt) => {
    const s = state.current;
    if (!pausedRef.current) {
      const input = inputRef.current;
      const evts = step(s, input, dt);
      input.interact = false;
      if (evts.length) onEvents(evts);
    }

    if (rig.current) {
      rig.current.position.set(s.x, 0, s.z);
      rig.current.rotation.y = s.facing;
    }

    // Slightly angled 2.5D chase camera.
    const camY = 12.5;
    const camZ = s.z + 12;
    camera.position.x += (s.x - camera.position.x) * Math.min(1, dt * 5);
    camera.position.y += (camY - camera.position.y) * Math.min(1, dt * 5);
    camera.position.z += (camZ - camera.position.z) * Math.min(1, dt * 5);
    camera.lookAt(s.x, 1, s.z - 1.5);
  });

  const s = state.current;
  const flashing = s.invuln > 0 && Math.floor(s.invuln / 120) % 2 === 0;

  return (
    <group ref={rig}>
      <ObbyAvatar color={color} skin={skinTone} moving={s.moving} ghost={flashing} />
      {s.powers.shield > 0 && (
        <mesh position={[0, 1.1, 0]}>
          <sphereGeometry args={[1.25, 18, 18]} />
          <meshStandardMaterial color="#37c8ff" emissive="#37c8ff" emissiveIntensity={0.6} transparent opacity={0.22} />
        </mesh>
      )}
      {s.powers.magnet > 0 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <ringGeometry args={[2.4, 2.7, 32]} />
          <meshStandardMaterial color="#ff6ba8" emissive="#ff6ba8" emissiveIntensity={0.8} transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

type FullSnapshot = HudSnapshot & {
  itemsRef: TrState["items"];
  gatesRef: TrState["gates"];
  padsRef: TrState["switches"];
  spikesRef: TrState["spikes"];
  barrelsRef: TrState["barrels"];
};

const HOW_TO = [
  "Steer with the stick — the market is open, explore any direction.",
  "Walk over coins, gems and power-ups to collect them.",
  "Tap the golden button to open chests, press switches and unlock gates.",
  "Watch the spikes and rolling barrels: 3 hearts and the run is over.",
  "Grab the treasure, then reach the green exit arch before the timer hits 0:00.",
];

export default function TreasureRushStage({ runKey, myColor, best, muted, onToggleMute, onBack, onQuit, onEnd, noTimer }: Props) {
  const state = useRef<TrState>(initialTreasureRush(noTimer));
  const inputRef = useRef({ ax: 0, az: 0, interact: false });
  const pausedRef = useRef(false);
  const ended = useRef(false);

  const [paused, setPaused] = useState(false);
  const [hud, setHud] = useState<FullSnapshot>(() => snapshot(state.current));
  const [prompt, setPrompt] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    state.current = initialTreasureRush(noTimer);
    inputRef.current = { ax: 0, az: 0, interact: false };
    ended.current = false;
    pausedRef.current = false;
    setPaused(false);
    setHud(snapshot(state.current));
  }, [runKey]);

  // HUD refresh at 10Hz keeps React work off the render loop.
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = state.current;
      setHud(snapshot(s));
      setPrompt(promptFor(s)?.label ?? null);
    }, 100);
    return () => window.clearInterval(id);
  }, [runKey]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 1400);
  }, []);

  const handleEvents = useCallback(
    (evts: string[]) => {
      evts.forEach((e) => {
        switch (e) {
          case "coin":
            trSfx.coin();
            break;
          case "gem":
            trSfx.gem();
            break;
          case "chest":
            trSfx.chest();
            flash("Treasure chest opened!");
            break;
          case "gold_chest":
            trSfx.goldChest();
            flash("Gold chest — jackpot!");
            break;
          case "key":
            trSfx.key();
            flash("Key found");
            break;
          case "unlock":
            trSfx.unlock();
            flash("Gate open");
            break;
          case "locked":
            trSfx.locked();
            flash("It's locked — find the key");
            break;
          case "switch":
            trSfx.switchPress();
            break;
          case "power":
            trSfx.power();
            break;
          case "trap":
            trSfx.trap();
            break;
          case "heart":
            trSfx.heartLost();
            break;
          case "warn":
            trSfx.timerWarning();
            break;
          default:
            break;
        }
      });

      const s = state.current;
      if (s.status !== "playing" && !ended.current) {
        ended.current = true;
        if (s.status === "complete") trSfx.complete();
        else trSfx.failed();
        const b = breakdownOf(s);
        if (best && b.total > best) trSfx.highScore();
        window.setTimeout(
          () =>
            onEnd({
              ...b,
              status: s.status,
              hearts: s.hearts,
              coins: s.coins,
              gems: s.gems,
              chests: s.chests,
              goldChests: s.goldChests,
            }),
          s.status === "complete" ? 900 : 500,
        );
      }
    },
    [best, flash, onEnd],
  );

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    pausedRef.current = next;
  };

  const scene = useMemo(
    () => (
      <LostCityScene
        items={hud.itemsRef}
        gates={hud.gatesRef}
        pads={hud.padsRef}
        spikes={hud.spikesRef}
        barrels={hud.barrelsRef}
      />
    ),
    [hud],
  );

  return (
    <div className="absolute inset-0">
      <Canvas shadows camera={{ position: [0, 13, 14], fov: 55 }} dpr={[1, 1.8]}>
        <color attach="background" args={["#1b1226"]} />
        <fog attach="fog" args={["#1b1226", 34, 62]} />
        <hemisphereLight intensity={0.85} groundColor="#5b4632" color="#ffe6c0" />
        <directionalLight position={[18, 26, 12]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />
        {scene}
        <Explorer state={state} inputRef={inputRef} pausedRef={pausedRef} color={myColor} onEvents={handleEvents} />
      </Canvas>

      <TreasureStick
        onAxis={(ax, az) => {
          inputRef.current.ax = ax;
          inputRef.current.az = az;
        }}
      />

      <TreasureRushHud
        hud={hud}
        best={best}
        muted={muted}
        paused={paused}
        onBack={onBack}
        onQuit={onQuit}
        onToggleMute={onToggleMute}
        onTogglePause={togglePause}
      />

      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-sm font-black text-amber-200 backdrop-blur-md animate-fade-in">
          {toast}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-end gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          {prompt && <p className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-black text-white">{prompt}</p>}
          <button
            type="button"
            onClick={() => {
              inputRef.current.interact = true;
            }}
            aria-label="Interact"
            className="flex h-20 w-20 flex-col items-center justify-center rounded-full text-black active:scale-95"
            style={{
              background: "linear-gradient(150deg, #ffe08a, #f0b429)",
              boxShadow: "0 0 26px rgba(240,180,41,0.6), 0 6px 12px rgba(0,0,0,0.5)",
              opacity: prompt ? 1 : 0.55,
            }}
          >
            <Hand className="h-6 w-6" />
            <span className="text-[10px] font-black uppercase">Use</span>
          </button>
        </div>
      </div>

      {paused && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 backdrop-blur-md">
          <h2 className="text-2xl font-black text-white">Paused</h2>
          <ul className="max-w-sm space-y-2">
            {HOW_TO.map((line) => (
              <li key={line} className="text-xs font-semibold text-white/80">
                • {line}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={togglePause}
            className="flex items-center gap-2 rounded-full bg-amber-400 px-6 py-3 text-sm font-black text-black active:scale-95"
          >
            <Play className="h-4 w-4" fill="currentColor" /> Resume run
          </button>
          <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-white/70">
            <X className="h-3.5 w-3.5" /> Leave the market
          </button>
        </div>
      )}
    </div>
  );
}

function snapshot(s: TrState): FullSnapshot {
  return {
    hearts: s.hearts,
    timeLeft: s.timeLeft,
    noTimer: s.noTimer,
    score: liveScore(s),
    coins: s.coins,
    gems: s.gems,
    chests: s.chests,
    goldChests: s.goldChests,
    keys: { ...s.keys },
    powers: { ...s.powers },
    x: s.x,
    z: s.z,
    visited: Array.from(s.visited),
    itemsRef: s.items.map((i) => ({ ...i })),
    gatesRef: s.gates.map((g) => ({ ...g })),
    padsRef: s.switches.map((p) => ({ ...p })),
    spikesRef: s.spikes.map((p) => ({ ...p })),
    barrelsRef: s.barrels.map((b) => ({ ...b })),
  };
}
