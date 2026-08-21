import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Volume2, VolumeX } from "lucide-react";
import ObbyAvatar, { AvatarPose } from "@/components/games/obby/ObbyAvatar";

const COURSE_LENGTH = 280;
const RIVER_HALF = 10.5;
const PLAYER_SPEED = 12.5;
const STEER_SPEED = 9;
const PROJECTILE_SPEED = 34;

type Vec = { x: number; y: number; z: number };
type Enemy = { id: number; x: number; z: number; hp: number; fireAt: number; phase: number };
type Shot = { id: number; owner: "player" | "enemy"; x: number; y: number; z: number; vx: number; vz: number; targetId?: number };
type Obstacle = { id: number; x: number; z: number; r: number; kind: "rock" | "island" | "buoy" };

type Runtime = {
  x: number;
  z: number;
  health: number;
  score: number;
  enemies: Enemy[];
  shots: Shot[];
  hitCooldown: number;
  duckUntil: number;
  finished: boolean;
  won: boolean;
  nextShotId: number;
};

type Input = { x: number; z: number };

type Props = {
  playerColor?: string;
  opponentName?: string;
  muted: boolean;
  onToggleMute: () => void;
  onStatus: (status: string) => void;
  onFinish: (won: boolean, score: number) => void;
};

const obstacles: Obstacle[] = [
  { id: 1, x: -5.8, z: 35, r: 2.2, kind: "rock" },
  { id: 2, x: 6.2, z: 52, r: 2.8, kind: "island" },
  { id: 3, x: -6.4, z: 73, r: 2.5, kind: "island" },
  { id: 4, x: 2.8, z: 95, r: 1.7, kind: "rock" },
  { id: 5, x: -2.5, z: 118, r: 1.3, kind: "buoy" },
  { id: 6, x: 6.5, z: 136, r: 2.4, kind: "rock" },
  { id: 7, x: -6.7, z: 158, r: 2.8, kind: "island" },
  { id: 8, x: 4.8, z: 181, r: 1.8, kind: "rock" },
  { id: 9, x: -4.4, z: 207, r: 2.1, kind: "rock" },
  { id: 10, x: 6.1, z: 232, r: 2.7, kind: "island" },
  { id: 11, x: -1.5, z: 255, r: 1.25, kind: "buoy" },
];

const enemySeeds: Enemy[] = [
  { id: 1, x: 5.5, z: 45, hp: 2, fireAt: 3.5, phase: 0.5 },
  { id: 2, x: -5.2, z: 86, hp: 2, fireAt: 4.5, phase: 1.7 },
  { id: 3, x: 4.8, z: 128, hp: 3, fireAt: 3.3, phase: 2.8 },
  { id: 4, x: -4.8, z: 172, hp: 2, fireAt: 3.8, phase: 4.2 },
  { id: 5, x: 5.6, z: 218, hp: 3, fireAt: 3.2, phase: 5.4 },
  { id: 6, x: 0, z: 262, hp: 4, fireAt: 2.8, phase: 6.6 },
];

function Palm({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, 0.2, z]} scale={s}>
      <mesh position={[0, 1.8, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.24, 3.6, 7]} />
        <meshStandardMaterial color="#81572e" roughness={0.8} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} position={[0, 3.6, 0]} rotation={[0, (Math.PI * 2 * i) / 6, Math.PI / 2.7]} castShadow>
          <boxGeometry args={[0.24, 2.3, 0.5]} />
          <meshStandardMaterial color={i % 2 ? "#3a9d57" : "#53bb66"} roughness={0.75} />
        </mesh>
      ))}
    </group>
  );
}

function RiverWorld() {
  return (
    <group>
      <mesh position={[0, -0.25, COURSE_LENGTH / 2]} receiveShadow>
        <boxGeometry args={[RIVER_HALF * 2, 0.45, COURSE_LENGTH + 40]} />
        <meshStandardMaterial color="#1796c8" roughness={0.28} metalness={0.05} />
      </mesh>
      <mesh position={[-17, 0, COURSE_LENGTH / 2]} receiveShadow>
        <boxGeometry args={[13, 0.8, COURSE_LENGTH + 60]} />
        <meshStandardMaterial color="#6fa44c" roughness={0.95} />
      </mesh>
      <mesh position={[17, 0, COURSE_LENGTH / 2]} receiveShadow>
        <boxGeometry args={[13, 0.8, COURSE_LENGTH + 60]} />
        <meshStandardMaterial color="#6fa44c" roughness={0.95} />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => (
        <group key={i}>
          <Palm x={-12.8 - (i % 2) * 2} z={12 + i * 25} s={0.8 + (i % 3) * 0.08} />
          <Palm x={12.6 + (i % 2) * 1.8} z={20 + i * 24} s={0.75 + ((i + 1) % 3) * 0.08} />
        </group>
      ))}
      {obstacles.map((o) => {
        if (o.kind === "island") {
          return (
            <group key={o.id} position={[o.x, 0, o.z]}>
              <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[o.r, o.r * 1.15, 0.6, 10]} />
                <meshStandardMaterial color="#d9c07b" roughness={0.9} />
              </mesh>
              <mesh position={[0.2, 0.4, -0.1]} castShadow>
                <cylinderGeometry args={[o.r * 0.72, o.r * 0.85, 0.5, 9]} />
                <meshStandardMaterial color="#58a95f" roughness={0.85} />
              </mesh>
              <Palm x={0.15} z={0.1} s={0.55} />
            </group>
          );
        }
        if (o.kind === "buoy") {
          return (
            <group key={o.id} position={[o.x, 0.3, o.z]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.45, 0.62, 1.2, 10]} />
                <meshStandardMaterial color="#ff7043" roughness={0.55} />
              </mesh>
              <mesh position={[0, 0.28, 0]}>
                <cylinderGeometry args={[0.46, 0.46, 0.18, 10]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
            </group>
          );
        }
        return (
          <mesh key={o.id} position={[o.x, 0.45, o.z]} castShadow>
            <dodecahedronGeometry args={[o.r, 0]} />
            <meshStandardMaterial color="#657381" roughness={0.88} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.04, COURSE_LENGTH + 2]} receiveShadow>
        <boxGeometry args={[20, 0.12, 1.2]} />
        <meshStandardMaterial color="#ffd84a" emissive="#ffb300" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function Boat({ color, enemy = false, pose = null }: { color: string; enemy?: boolean; pose?: AvatarPose | null }) {
  return (
    <group>
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.7, 0.42, 5.1]} />
        <meshStandardMaterial color={enemy ? "#ef6a57" : color} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.46, -0.25]} castShadow>
        <boxGeometry args={[3.2, 0.18, 4.5]} />
        <meshStandardMaterial color={enemy ? "#ff967f" : "#78d4c4"} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.72, 1.65]} castShadow>
        <boxGeometry args={[2.6, 0.2, 0.45]} />
        <meshStandardMaterial color="#6c4a2b" />
      </mesh>
      <group position={[-0.75, 0.68, 0.05]} scale={0.72}>
        <ObbyAvatar color={enemy ? "#f06f57" : color} moving pose={pose} speedMul={0.65} />
      </group>
      <group position={[0.8, 0.68, -0.35]} scale={0.64} rotation={[0, Math.PI, 0]}>
        <ObbyAvatar color={enemy ? "#ffb14a" : "#7e57c2"} moving pose={pose === "stumble" ? "stumble" : pose === "celebrate" ? "celebrate" : null} speedMul={0.55} />
      </group>
      <mesh position={[0, 1.0, -1.6]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 2.0, 10]} />
        <meshStandardMaterial color="#30343c" metalness={0.35} roughness={0.4} />
      </mesh>
    </group>
  );
}

function ProjectileMesh({ shot }: { shot: Shot }) {
  return (
    <mesh position={[shot.x, shot.y, shot.z]} castShadow>
      <sphereGeometry args={[0.22, 12, 12]} />
      <meshStandardMaterial color={shot.owner === "player" ? "#ffd43b" : "#ff675c"} emissive={shot.owner === "player" ? "#ff9f1a" : "#ff2d55"} emissiveIntensity={1.1} />
    </mesh>
  );
}

function BattleScene({ inputRef, fireRef, duckRef, onHud, onStatus, onFinish }: {
  inputRef: MutableRefObject<Input>;
  fireRef: MutableRefObject<boolean>;
  duckRef: MutableRefObject<boolean>;
  onHud: (health: number, score: number, progress: number) => void;
  onStatus: (status: string) => void;
  onFinish: (won: boolean, score: number) => void;
}) {
  const playerGroup = useRef<any>(null);
  const enemyRefs = useRef<Record<number, any>>({});
  const { camera } = useThree();
  const runtime = useRef<Runtime>({
    x: 0,
    z: 0,
    health: 3,
    score: 0,
    enemies: enemySeeds.map((e) => ({ ...e })),
    shots: [],
    hitCooldown: 0,
    duckUntil: 0,
    finished: false,
    won: false,
    nextShotId: 1,
  });
  const lastHud = useRef(0);
  const lastStatus = useRef(0);
  const [shots, setShots] = useState<Shot[]>([]);
  const [enemyState, setEnemyState] = useState<Enemy[]>(runtime.current.enemies);
  const [playerPose, setPlayerPose] = useState<AvatarPose | null>(null);

  const shootPlayer = (s: Runtime) => {
    const live = s.enemies.filter((e) => e.hp > 0 && e.z > s.z - 4 && e.z < s.z + 42);
    if (!live.length) {
      onStatus("No target in range — keep moving");
      return;
    }
    live.sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z));
    const target = live[0];
    const dx = target.x - s.x;
    const dz = target.z - s.z;
    const len = Math.hypot(dx, dz) || 1;
    s.shots.push({ id: s.nextShotId++, owner: "player", x: s.x, y: 1.2, z: s.z + 2.0, vx: (dx / len) * PROJECTILE_SPEED, vz: (dz / len) * PROJECTILE_SPEED, targetId: target.id });
    setPlayerPose("interact");
    window.setTimeout(() => setPlayerPose(null), 260);
    onStatus("FIRE! Direct the boat and clear the river");
  };

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const t = clock.elapsedTime;
    const s = runtime.current;
    if (s.finished) return;

    const input = inputRef.current;
    const steer = input.x * STEER_SPEED;
    s.x += steer * dt;
    s.x = Math.max(-RIVER_HALF + 2.2, Math.min(RIVER_HALF - 2.2, s.x));
    const forwardMul = 1 + Math.max(-0.25, Math.min(0.45, -input.z * 0.35));
    s.z += PLAYER_SPEED * forwardMul * dt;
    s.hitCooldown = Math.max(0, s.hitCooldown - dt);
    if (duckRef.current) s.duckUntil = t + 0.18;

    if (fireRef.current) {
      fireRef.current = false;
      shootPlayer(s);
    }

    // River hazards
    for (const o of obstacles) {
      if (Math.abs(o.z - s.z) > 3.5) continue;
      const d = Math.hypot(o.x - s.x, o.z - s.z);
      if (d < o.r + 1.25 && s.hitCooldown <= 0) {
        s.hitCooldown = 1.2;
        s.health -= 1;
        s.x += s.x <= o.x ? -2.2 : 2.2;
        setPlayerPose("stumble");
        window.setTimeout(() => setPlayerPose(null), 520);
        onStatus("Watch the river! You clipped an obstacle");
      }
    }

    // Enemy motion + firing
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const ref = enemyRefs.current[e.id];
      const bobX = Math.sin(t * 0.85 + e.phase) * 1.2;
      const ex = Math.max(-RIVER_HALF + 2, Math.min(RIVER_HALF - 2, e.x + bobX));
      if (ref) {
        ref.position.set(ex, 0.05 + Math.sin(t * 2 + e.phase) * 0.05, e.z);
        ref.rotation.z = Math.sin(t * 1.6 + e.phase) * 0.025;
      }
      const dz = e.z - s.z;
      if (dz > -6 && dz < 34) {
        e.fireAt -= dt;
        if (e.fireAt <= 0) {
          e.fireAt = 3.2 + (e.id % 3) * 0.65;
          const dx = s.x - ex;
          const len = Math.hypot(dx, dz) || 1;
          s.shots.push({ id: s.nextShotId++, owner: "enemy", x: ex, y: 1.1, z: e.z - 2.0, vx: (dx / len) * PROJECTILE_SPEED * 0.75, vz: (-Math.abs(dz) / len) * PROJECTILE_SPEED * 0.75 });
          if (t - lastStatus.current > 0.8) {
            lastStatus.current = t;
            onStatus("Incoming! STEER or DUCK");
          }
        }
      }
    }

    // Projectiles
    const remaining: Shot[] = [];
    for (const sh of s.shots) {
      sh.x += sh.vx * dt;
      sh.z += sh.vz * dt;
      sh.y = 1.15 + Math.sin((sh.z + sh.x) * 0.2) * 0.08;
      if (sh.owner === "player") {
        const target = s.enemies.find((e) => e.id === sh.targetId && e.hp > 0);
        if (target && Math.hypot(sh.x - target.x, sh.z - target.z) < 2.3) {
          target.hp -= 1;
          s.score += target.hp <= 0 ? 500 : 180;
          onStatus(target.hp <= 0 ? "Enemy boat disabled!" : "Direct hit!");
          setEnemyState(s.enemies.map((e) => ({ ...e })));
          continue;
        }
      } else {
        if (Math.hypot(sh.x - s.x, sh.z - s.z) < 2.25) {
          const ducking = t < s.duckUntil;
          if (ducking) {
            s.score += 60;
            onStatus("Nice duck! Shot missed the crew");
          } else if (s.hitCooldown <= 0) {
            s.health -= 1;
            s.hitCooldown = 1.0;
            setPlayerPose("stumble");
            window.setTimeout(() => setPlayerPose(null), 520);
            onStatus("Hit! Keep moving");
          }
          continue;
        }
      }
      if (sh.z > s.z + 58 || sh.z < s.z - 18 || Math.abs(sh.x) > 28) continue;
      remaining.push(sh);
    }
    s.shots = remaining;
    setShots(remaining.map((q) => ({ ...q })));

    if (playerGroup.current) {
      playerGroup.current.position.set(s.x, 0.08 + Math.sin(t * 2.2) * 0.05, s.z);
      playerGroup.current.rotation.z = -steer * 0.008 + Math.sin(t * 1.8) * 0.012;
      playerGroup.current.rotation.y = -steer * 0.015;
    }

    // Chase camera like YAJ Obby, but higher/wider for the raft and river.
    camera.position.x += (s.x * 0.34 - camera.position.x) * Math.min(1, dt * 5.5);
    camera.position.y += (10.2 - camera.position.y) * Math.min(1, dt * 4.8);
    camera.position.z += (s.z - 13.5 - camera.position.z) * Math.min(1, dt * 5.5);
    camera.lookAt(s.x * 0.25, 0.75, s.z + 7.5);

    if (t - lastHud.current > 0.12) {
      lastHud.current = t;
      onHud(Math.max(0, s.health), s.score, Math.min(1, s.z / COURSE_LENGTH));
    }

    if (s.health <= 0) {
      s.finished = true;
      s.won = false;
      setPlayerPose("stumble");
      onStatus("Fleet down — run over");
      onFinish(false, s.score);
    } else if (s.z >= COURSE_LENGTH) {
      s.finished = true;
      s.won = true;
      setPlayerPose("celebrate");
      s.score += 1000 + s.health * 250;
      onStatus("Cove cleared — Fleet Victory!");
      onFinish(true, s.score);
    }
  });

  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[8, 18, -4]} intensity={1.8} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <hemisphereLight args={["#dff5ff", "#446b3b", 0.85]} />
      <RiverWorld />
      <group ref={playerGroup}>
        <Boat color="#7f4be8" pose={playerPose} />
      </group>
      {enemyState.map((e) => e.hp > 0 && (
        <group key={e.id} ref={(node) => { enemyRefs.current[e.id] = node; }} position={[e.x, 0.05, e.z]}>
          <Boat color="#ef6a57" enemy pose={e.hp === 1 ? "stumble" : null} />
        </group>
      ))}
      {shots.map((sh) => <ProjectileMesh key={sh.id} shot={sh} />)}
    </>
  );
}

const STICK_MAX = 54;
function Joystick({ inputRef }: { inputRef: MutableRefObject<Input> }) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState<{ ox: number; oy: number; dx: number; dy: number } | null>(null);

  const update = (x: number, y: number) => {
    const o = origin.current;
    if (!o) return;
    let dx = x - o.x;
    let dy = y - o.y;
    const len = Math.hypot(dx, dy) || 1;
    const m = Math.min(STICK_MAX, len);
    dx = (dx / len) * m;
    dy = (dy / len) * m;
    inputRef.current.x = dx / STICK_MAX;
    inputRef.current.z = dy / STICK_MAX;
    setKnob({ ox: o.x, oy: o.y, dx, dy });
  };

  return (
    <div
      className="absolute inset-0 z-20 touch-none"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        origin.current = { x: e.clientX, y: e.clientY };
        setKnob({ ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 });
        update(e.clientX, e.clientY);
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => origin.current && update(e.clientX, e.clientY)}
      onPointerUp={() => {
        origin.current = null;
        inputRef.current = { x: 0, z: 0 };
        setKnob(null);
      }}
      onPointerCancel={() => {
        origin.current = null;
        inputRef.current = { x: 0, z: 0 };
        setKnob(null);
      }}
    >
      {knob && (
        <>
          <div className="pointer-events-none fixed z-30 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/35 bg-black/15" style={{ left: knob.ox, top: knob.oy }} />
          <div className="pointer-events-none fixed z-30 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-white/70 shadow-xl" style={{ left: knob.ox + knob.dx, top: knob.oy + knob.dy }} />
        </>
      )}
    </div>
  );
}

export default function FleetClashStage({ playerColor = "#7f4be8", opponentName = "Computer", muted, onToggleMute, onStatus, onFinish }: Props) {
  const inputRef = useRef<Input>({ x: 0, z: 0 });
  const fireRef = useRef(false);
  const duckRef = useRef(false);
  const [health, setHealth] = useState(3);
  const [score, setScore] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") inputRef.current.x = -1;
      if (e.key === "ArrowRight" || e.key === "d") inputRef.current.x = 1;
      if (e.key === "ArrowUp" || e.key === "w") inputRef.current.z = -1;
      if (e.key === "ArrowDown" || e.key === "s") inputRef.current.z = 1;
      if (e.key === " ") fireRef.current = true;
      if (e.key.toLowerCase() === "q") duckRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "a", "d"].includes(e.key)) inputRef.current.x = 0;
      if (["ArrowUp", "ArrowDown", "w", "s"].includes(e.key)) inputRef.current.z = 0;
      if (e.key.toLowerCase() === "q") duckRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  return (
    <div className="relative mx-auto h-[68dvh] min-h-[520px] max-h-[720px] w-full max-w-[520px] overflow-hidden rounded-[28px] border border-white/15 bg-sky-900 shadow-[0_22px_70px_rgba(0,0,0,.35)]">
      <Canvas shadows camera={{ position: [0, 10.2, -13.5], fov: 55 }} dpr={[1, 1.55]}>
        <BattleScene
          inputRef={inputRef}
          fireRef={fireRef}
          duckRef={duckRef}
          onHud={(h, s, p) => { setHealth(h); setScore(s); setProgress(p); }}
          onStatus={onStatus}
          onFinish={onFinish}
        />
      </Canvas>

      <div className="pointer-events-none absolute left-3 right-3 top-3 z-30 flex items-start justify-between gap-2">
        <div className="rounded-2xl border border-white/15 bg-slate-950/65 px-3 py-2 backdrop-blur-md">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">Hull</div>
          <div className="mt-1 flex gap-1 text-lg">{[0, 1, 2].map((i) => <span key={i} className={i < health ? "opacity-100" : "opacity-20"}>❤️</span>)}</div>
        </div>
        <div className="min-w-[120px] rounded-2xl border border-white/15 bg-slate-950/65 px-3 py-2 text-center backdrop-blur-md">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">River cleared</div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <div className="mt-1 text-xs font-black text-white">{Math.round(progress * 100)}%</div>
        </div>
        <div className="rounded-2xl border border-white/15 bg-slate-950/65 px-3 py-2 text-right backdrop-blur-md">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">Score</div>
          <div className="text-lg font-black text-white">{score.toLocaleString()}</div>
        </div>
      </div>

      <button type="button" onClick={onToggleMute} className="absolute right-3 top-[88px] z-40 rounded-full border border-white/15 bg-slate-950/65 p-3 text-white backdrop-blur-md" aria-label="Toggle sound">
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      <Joystick inputRef={inputRef} />

      <div className="absolute bottom-5 left-4 right-4 z-40 flex items-end justify-between pointer-events-none">
        <div className="rounded-2xl border border-white/15 bg-slate-950/55 px-3 py-2 text-[11px] font-bold text-white/75 backdrop-blur-md">
          Drag anywhere to steer<br/><span className="text-white/45">Move around rocks & islands</span>
        </div>
        <div className="flex gap-2 pointer-events-auto">
          <button
            type="button"
            onPointerDown={() => { duckRef.current = true; }}
            onPointerUp={() => { duckRef.current = false; }}
            onPointerCancel={() => { duckRef.current = false; }}
            className="h-16 w-16 rounded-full border border-white/25 bg-slate-950/75 text-[11px] font-black uppercase text-white shadow-xl active:scale-95"
          >
            Duck
          </button>
          <button
            type="button"
            onClick={() => { fireRef.current = true; }}
            className="h-20 w-20 rounded-full border-2 border-yellow-200/60 bg-gradient-to-br from-orange-400 to-red-500 text-sm font-black uppercase text-white shadow-[0_0_28px_rgba(255,138,0,.35)] active:scale-95"
          >
            Fire
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-[110px] left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/70 backdrop-blur-sm">
        vs {opponentName}
      </div>
    </div>
  );
}
