import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ArrowLeft, HelpCircle, Volume2, VolumeX } from "lucide-react";
import ObbyAvatar from "@/components/games/obby/ObbyAvatar";
import {
  CityRunState,
  CityRunWorld,
  Entity,
  LANES,
  POWER_META,
  PowerKind,
  initialRun,
  obstacleColor,
  obstacleSize,
  scoreOf,
  step,
} from "@/lib/city-run";
import { obbySfx } from "@/lib/obby-sfx";

type Input = { lane: 0 | 1 | 2; jump: boolean; slide: boolean };

type Hud = {
  score: number;
  coins: number;
  distance: number;
  speed: number;
  powers: Record<PowerKind, number>;
};

type Props = {
  myColor: string;
  onBack: () => void;
  onEnd: (score: number, coins: number, distance: number) => void;
  headline: string;
  subline: string;
  howToPlay: string[];
  muted: boolean;
  onToggleMute: () => void;
  best?: number | null;
  /** Bumped by the page to start a fresh run. */
  runKey: number;
};

/* --------------------------------------------------------------- scenery */

function Street() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[13, 5000]} />
        <meshStandardMaterial color="#33334a" roughness={0.9} />
      </mesh>
      {[-6.3, 6.3].map((x) => (
        <mesh key={x} position={[x, 0.16, 0]}>
          <boxGeometry args={[2.4, 0.34, 5000]} />
          <meshStandardMaterial color="#5a5a72" />
        </mesh>
      ))}
    </group>
  );
}

/** Lane dashes + street blocks recycled around the runner so the city never ends. */
function ScrollingCity({ zRef }: { zRef: React.MutableRefObject<number> }) {
  const dashes = useRef<any>(null);
  const blocks = useRef<any[]>([]);
  const seeds = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        i,
        side: i % 2 === 0 ? -1 : 1,
        h: 8 + ((i * 37) % 22),
        w: 5 + ((i * 13) % 5),
        hue: (i * 47) % 360,
      })),
    [],
  );
  const dashSeeds = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  useFrame(() => {
    const z = zRef.current;
    dashSeeds.forEach((i) => {
      const m = dashes.current?.children[i];
      if (!m) return;
      const span = 60 * 6;
      m.position.z = z + 20 + (((i * 6 - (z % span)) + span) % span);
    });
    seeds.forEach((s, i) => {
      const m = blocks.current[i];
      if (!m) return;
      const span = 17 * 24;
      m.position.z = z + 30 + (((s.i * 24 - (z % span)) + span) % span);
    });
  });

  return (
    <group>
      <group ref={dashes}>
        {dashSeeds.map((i) => (
          <mesh key={i} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.28, 2.6]} />
            <meshStandardMaterial color="#f3f0d8" emissive="#c9c49c" emissiveIntensity={0.2} />
          </mesh>
        ))}
      </group>
      {seeds.map((s, i) => (
        <mesh
          key={s.i}
          ref={(el) => {
            blocks.current[i] = el;
          }}
          position={[s.side * (11 + (s.w / 2)), s.h / 2, 0]}
          castShadow
        >
          <boxGeometry args={[s.w, s.h, 14]} />
          <meshStandardMaterial color={`hsl(${s.hue} 22% 34%)`} emissive={`hsl(${s.hue} 60% 20%)`} emissiveIntensity={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function EntityMesh({ e }: { e: Entity }) {
  const spin = useRef<any>(null);
  useFrame(({ clock }) => {
    if (spin.current) spin.current.rotation.y = clock.elapsedTime * 2.4;
  });
  const x = LANES[e.lane];

  if (e.kind === "coin") {
    return (
      <mesh ref={spin} position={[x, 1.15, e.z]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.1, 18]} />
        <meshStandardMaterial color="#ffd23f" emissive="#ffae00" emissiveIntensity={0.5} metalness={0.6} roughness={0.25} />
      </mesh>
    );
  }

  if (e.kind === "magnet" || e.kind === "shield" || e.kind === "boost") {
    const meta = POWER_META[e.kind];
    return (
      <mesh ref={spin} position={[x, 1.4, e.z]}>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <meshStandardMaterial color={meta.color} emissive={meta.color} emissiveIntensity={0.7} transparent opacity={0.9} />
      </mesh>
    );
  }

  const [w, h, d] = obstacleSize(e.kind);
  const y = e.kind === "sign" ? 2.3 : h / 2;
  return (
    <mesh position={[x, y, e.z]} castShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={obstacleColor(e.kind)} roughness={0.5} />
    </mesh>
  );
}

/* ---------------------------------------------------------------- runner */

function Runner({
  color,
  inputRef,
  onHud,
  onEnd,
  zRef,
  runKey,
}: {
  color: string;
  inputRef: React.MutableRefObject<Input>;
  onHud: (h: Hud) => void;
  onEnd: (score: number, coins: number, distance: number) => void;
  zRef: React.MutableRefObject<number>;
  runKey: number;
}) {
  const group = useRef<any>(null);
  const { camera } = useThree();
  const stateRef = useRef<CityRunState>(initialRun());
  const worldRef = useRef(new CityRunWorld());
  const [entities, setEntities] = useState<Entity[]>([]);
  const ended = useRef(false);
  const lastHud = useRef(0);

  useEffect(() => {
    stateRef.current = initialRun();
    worldRef.current = new CityRunWorld();
    ended.current = false;
    setEntities([]);
  }, [runKey]);

  useFrame(({ clock }, dt) => {
    const s = stateRef.current;
    if (ended.current) return;

    const events = step(s, inputRef.current, dt);
    worldRef.current.ensure(s);
    zRef.current = s.z;

    events.forEach((ev) => {
      if (ev === "jump") obbySfx.jump();
      else if (ev === "coin") obbySfx.land();
      else if (ev === "power") obbySfx.win();
      else if (ev === "hit") obbySfx.fall();
      else if (ev === "crash") obbySfx.fall();
    });

    if (clock.elapsedTime - lastHud.current > 0.1) {
      lastHud.current = clock.elapsedTime;
      setEntities([...s.entities]);
      onHud({
        score: scoreOf(s),
        coins: s.coins,
        distance: s.distance,
        speed: s.speed,
        powers: { ...s.powers },
      });
    }

    if (group.current) {
      const squash = s.sliding > 0 ? 0.5 : 1;
      group.current.position.set(s.x, s.y, s.z);
      group.current.scale.set(1, squash, 1);
      group.current.rotation.y = Math.PI; // facing away, down the street
    }

    camera.position.x += (s.x * 0.55 - camera.position.x) * Math.min(1, dt * 5);
    camera.position.y += (s.y * 0.35 + 4.6 - camera.position.y) * Math.min(1, dt * 4);
    camera.position.z = s.z - 9.5;
    camera.lookAt(s.x * 0.6, s.y + 1.3, s.z + 9);

    if (s.over) {
      ended.current = true;
      onEnd(scoreOf(s), s.coins, s.distance);
    }
  });

  const s = stateRef.current;

  return (
    <group>
      {entities.map((e) => (
        <EntityMesh key={e.id} e={e} />
      ))}
      <group ref={group}>
        <ObbyAvatar color={color} moving airborne={s.y > 0.6} />
        {s.powers.shield > 0 && (
          <mesh position={[0, 1.05, 0]}>
            <sphereGeometry args={[1.25, 20, 20]} />
            <meshStandardMaterial color="#37c8ff" transparent opacity={0.28} emissive="#37c8ff" emissiveIntensity={0.6} />
          </mesh>
        )}
      </group>
    </group>
  );
}

/* ----------------------------------------------------------------- stage */

export default function CityRunStage({
  myColor,
  onBack,
  onEnd,
  headline,
  subline,
  howToPlay,
  muted,
  onToggleMute,
  best,
  runKey,
}: Props) {
  const inputRef = useRef<Input>({ lane: 1, jump: false, slide: false });
  const zRef = useRef(0);
  const [hud, setHud] = useState<Hud>({ score: 0, coins: 0, distance: 0, speed: 0, powers: { magnet: 0, shield: 0, boost: 0 } });
  const [help, setHelp] = useState(false);

  useEffect(() => {
    inputRef.current = { lane: 1, jump: false, slide: false };
  }, [runKey]);

  const move = (dir: -1 | 1) => {
    inputRef.current.lane = Math.max(0, Math.min(2, inputRef.current.lane + dir)) as 0 | 1 | 2;
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") move(-1);
      else if (e.code === "ArrowRight" || e.code === "KeyD") move(1);
      else if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        inputRef.current.jump = true;
        e.preventDefault();
      } else if (e.code === "ArrowDown" || e.code === "KeyS") inputRef.current.slide = true;
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  // Swipe anywhere on the street: left/right to change lane, up to jump, down to slide.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    touch.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: React.PointerEvent) => {
    const t = touch.current;
    touch.current = null;
    if (!t) return;
    const dx = e.clientX - t.x;
    const dy = e.clientY - t.y;
    if (Math.hypot(dx, dy) < 24) {
      inputRef.current.jump = true;
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
    else if (dy < 0) inputRef.current.jump = true;
    else inputRef.current.slide = true;
  };

  const activePowers = (Object.keys(hud.powers) as PowerKind[]).filter((k) => hud.powers[k] > 0);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#12142a]">
      <div className="absolute inset-0 touch-none" onPointerDown={onDown} onPointerUp={onUp}>
        <Canvas shadows dpr={[1, 1.6]} camera={{ position: [0, 4.6, -9.5], fov: 66 }}>
          <color attach="background" args={["#1b2140"]} />
          <fog attach="fog" args={["#1b2140", 45, 150]} />
          <hemisphereLight args={["#ffd7a8", "#2a2f52", 0.85]} />
          <directionalLight position={[10, 26, 30]} intensity={1.25} castShadow shadow-mapSize={[1024, 1024]} />
          <Street />
          <ScrollingCity zRef={zRef} />
          <Runner color={myColor} inputRef={inputRef} onHud={setHud} onEnd={onEnd} zRef={zRef} runKey={runKey} />
        </Canvas>
      </div>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3">
        <div className="pointer-events-auto flex items-start gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="rounded-full bg-black/45 p-2 text-primary-foreground backdrop-blur-md active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 rounded-2xl bg-black/45 px-3 py-2 backdrop-blur-md">
            <p className="truncate text-xs font-black text-primary-foreground">{headline}</p>
            <p className="truncate text-[10px] text-primary-foreground/70">{subline}</p>
            <div className="mt-1 flex items-center justify-between text-[11px] font-black text-primary-foreground">
              <span>{hud.score.toLocaleString()} pts</span>
              <span className="text-primary-foreground/80">
                {Math.round(hud.distance)}m · 🪙 {hud.coins}
              </span>
            </div>
            {best ? <p className="text-[10px] text-primary-foreground/60">Best — {best.toLocaleString()} pts</p> : null}
          </div>
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            className="rounded-full bg-black/45 p-2 text-primary-foreground backdrop-blur-md active:scale-95"
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => setHelp((v) => !v)}
            aria-label="How to play"
            className="rounded-full bg-black/45 p-2 text-primary-foreground backdrop-blur-md active:scale-95"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>

        {activePowers.length > 0 && (
          <div className="mt-2 flex gap-2">
            {activePowers.map((k) => (
              <span
                key={k}
                className="rounded-full px-2.5 py-1 text-[10px] font-black text-black"
                style={{ background: POWER_META[k].color }}
              >
                {POWER_META[k].emoji} {(hud.powers[k] / 1000).toFixed(1)}s
              </span>
            ))}
          </div>
        )}

        {help && (
          <ul className="pointer-events-auto mt-2 animate-fade-in space-y-1 rounded-2xl bg-black/55 p-3 text-[11px] text-primary-foreground/85 backdrop-blur-md">
            {howToPlay.map((l) => (
              <li key={l}>• {l}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 pb-8">
        <div className="flex gap-2">
          <button
            type="button"
            onPointerDown={() => move(-1)}
            aria-label="Move left"
            className="h-16 w-16 touch-none rounded-2xl border border-white/25 bg-white/15 text-lg font-black text-primary-foreground backdrop-blur-md active:scale-95"
          >
            ◀
          </button>
          <button
            type="button"
            onPointerDown={() => move(1)}
            aria-label="Move right"
            className="h-16 w-16 touch-none rounded-2xl border border-white/25 bg-white/15 text-lg font-black text-primary-foreground backdrop-blur-md active:scale-95"
          >
            ▶
          </button>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onPointerDown={() => {
              inputRef.current.slide = true;
            }}
            className="h-16 w-20 touch-none rounded-2xl border border-white/25 bg-white/15 text-xs font-black uppercase text-primary-foreground backdrop-blur-md active:scale-95"
          >
            Slide
          </button>
          <button
            type="button"
            onPointerDown={() => {
              inputRef.current.jump = true;
            }}
            className="h-20 w-20 touch-none rounded-full border border-white/30 bg-primary/85 text-sm font-black uppercase tracking-wide text-primary-foreground backdrop-blur-md active:scale-95"
          >
            Jump
          </button>
        </div>
      </div>
    </div>
  );
}
