import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import ObbyAvatar, { AvatarPose } from "@/components/games/obby/ObbyAvatar";
import { useCharacterAppearance } from "@/contexts/CharacterAppearanceContext";
import { battleshipSfx } from "@/lib/battleship-sfx";

const COURSE_LENGTH = 1450;
const RIVER_HALF = 11.5;
const STORM_START = 825;
const STORM_END = 1050;
const SHARK_START = 1050;
const SHARK_END = 1280;
const PLAYER_SPEED = 13.4;
const RIVAL_SPEED = 13.0;
const STEER_SPEED = 11.2;
const PROJECTILE_SPEED = 42;
const MAX_CREW = 4;
const DEFAULT_CREW = 2;

type Input = { x: number; z: number };
type Vec = { x: number; y: number; z: number };
type Shot = {
  id: number;
  owner: "player" | "rival";
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
};
type Obstacle = { id: number; x: number; z: number; r: number; kind: "rock" | "island" | "buoy" | "log" | "shark" };
type CrewState = { knockedUntil: number; side: -1 | 1 };

type Runtime = {
  x: number;
  z: number;
  rivalX: number;
  rivalZ: number;
  health: number;
  rivalHealth: number;
  score: number;
  shots: Shot[];
  playerCrew: CrewState[];
  rivalCrew: CrewState[];
  hitCooldown: number;
  rivalHitCooldown: number;
  duckUntil: number;
  fireCooldown: number;
  rivalFireCooldown: number;
  finished: boolean;
  nextShotId: number;
  zoneIndex: number;
};

type Props = {
  playerColor?: string;
  opponentName?: string;
  muted: boolean;
  onToggleMute: () => void;
  onStatus: (status: string) => void;
  onFinish: (won: boolean, score: number) => void;
  onBack?: () => void;
  liveDock?: ReactNode;
};

type Zone = {
  name: string;
  start: number;
  end: number;
  water: string;
  bank: string;
  accent: string;
};

const zones: Zone[] = [
  { name: "Tropical Run", start: 0, end: 170, water: "#169bc9", bank: "#6ea34c", accent: "#ffd95a" },
  { name: "Rock Canyon", start: 170, end: 340, water: "#148ab7", bank: "#78654e", accent: "#ff9a55" },
  { name: "Tunnel Run", start: 340, end: 505, water: "#1179a4", bank: "#485361", accent: "#7ce8ff" },
  { name: "Wild Rapids", start: 505, end: 690, water: "#18a5cf", bank: "#4f8b58", accent: "#ffffff" },
  { name: "Falls Gorge", start: 690, end: STORM_START, water: "#0f7ca7", bank: "#594d43", accent: "#77e9ff" },
  { name: "Storm Reach", start: STORM_START, end: STORM_END, water: "#1a4f72", bank: "#3d4a4a", accent: "#c7e3ff" },
  { name: "Shark Shallows", start: STORM_END, end: SHARK_END, water: "#0e8f8a", bank: "#8a7a4e", accent: "#ff5a5a" },
  { name: "Final Cove", start: SHARK_END, end: COURSE_LENGTH, water: "#1598bd", bank: "#3e7d50", accent: "#ffd84a" },
];

function zoneAt(z: number) {
  return zones.findIndex((zone) => z >= zone.start && z < zone.end);
}

function riverY(z: number) {
  if (z < 700) return 0;
  if (z < 755) {
    const t = (z - 700) / 55;
    return -1.8 * (t * t * (3 - 2 * t));
  }
  return -1.8;
}

function seededNoise(n: number) {
  const x = Math.sin(n * 9283.1337) * 43758.5453;
  return x - Math.floor(x);
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** How much the river bends at this point in the course — 0 while running through the
 *  tunnel/rapids/falls (those hazards are fixed structures, so that stretch stays straight),
 *  a smooth S-curve everywhere else so the channel genuinely turns rather than running dead
 *  straight the whole race. */
function curveEnvelope(z: number) {
  if (z < 340) return smoothstep(0, 60, z) * (1 - smoothstep(280, 340, z));
  return smoothstep(765, STORM_START, z);
}

function riverCenterX(z: number) {
  return curveEnvelope(z) * (Math.sin(z * 0.0065) * 5.5 + Math.sin(z * 0.0021 + 1.4) * 3.0);
}

const obstacles: Obstacle[] = (() => {
  const out: Obstacle[] = [];
  let id = 1;
  for (let z = 55; z < COURSE_LENGTH - 40; z += 20) {
    const difficulty = z / COURSE_LENGTH;
    const count = z < 170 ? 1 : difficulty < 0.55 ? 2 : 2 + (id % 3 === 0 ? 1 : 0);
    for (let j = 0; j < count; j++) {
      const n = seededNoise(id * 7.13 + j * 3.7);
      const zPos = z + j * 5.2;
      const x = riverCenterX(zPos) + (-8.5 + n * 17);
      const inSharks = zPos >= SHARK_START + 15 && zPos < SHARK_END - 15;
      const kinds: Obstacle["kind"][] = z > 500 ? ["rock", "rock", "log", "buoy", "island"] : ["rock", "buoy", "island"];
      const kind: Obstacle["kind"] = inSharks && (id + j) % 4 === 0 ? "shark" : kinds[(id + j) % kinds.length];
      const r = kind === "island" ? 2.25 + difficulty * 0.9 : kind === "log" ? 1.55 : kind === "buoy" ? 0.8 : kind === "shark" ? 1.4 : 1.3 + difficulty * 0.9;
      out.push({ id: id++, x: kind === "shark" ? riverCenterX(zPos) + (n - 0.5) * 6 : x, z: zPos, r, kind });
    }
  }
  return out;
})();

function Palm({ x, z, y = 0, s = 1 }: { x: number; z: number; y?: number; s?: number }) {
  return (
    <group position={[x, y + 0.2, z]} scale={s}>
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

function TunnelSection() {
  const arches = Array.from({ length: 8 }, (_, i) => 355 + i * 18);
  return (
    <group>
      {arches.map((z) => (
        <group key={z} position={[0, riverY(z), z]}>
          <mesh position={[-10.9, 3.2, 0]} castShadow>
            <boxGeometry args={[1.1, 6.2, 1.25]} />
            <meshStandardMaterial color="#394450" roughness={0.95} />
          </mesh>
          <mesh position={[10.9, 3.2, 0]} castShadow>
            <boxGeometry args={[1.1, 6.2, 1.25]} />
            <meshStandardMaterial color="#394450" roughness={0.95} />
          </mesh>
          <mesh position={[0, 6.0, 0]} castShadow>
            <boxGeometry args={[22.8, 0.8, 1.25]} />
            <meshStandardMaterial color="#313a45" roughness={0.95} />
          </mesh>
          <mesh position={[0, 5.55, 0.15]}>
            <boxGeometry args={[9.5, 0.16, 0.2]} />
            <meshStandardMaterial color="#74e2ff" emissive="#36c6ff" emissiveIntensity={1.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Rapids() {
  return (
    <group>
      {Array.from({ length: 22 }, (_, i) => {
        const z = 520 + i * 8;
        return (
          <mesh key={z} position={[(i % 2 ? -2.5 : 2.2), riverY(z) + 0.02, z]} rotation={[-Math.PI / 2, 0, i % 2 ? 0.1 : -0.1]}>
            <planeGeometry args={[7.5, 0.35]} />
            <meshBasicMaterial color="#dffaff" transparent opacity={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}

const RIVER_SEG = 20;

function RiverWorld() {
  return (
    <group>
      {zones.map((zone) => {
        const segCount = Math.ceil((zone.end - zone.start) / RIVER_SEG);
        return (
          <group key={zone.name}>
            {Array.from({ length: segCount }, (_, i) => {
              const segStart = zone.start + i * RIVER_SEG;
              const segLen = Math.min(RIVER_SEG, zone.end - segStart);
              const mid = segStart + segLen / 2;
              const y = riverY(mid);
              const cx = riverCenterX(mid);
              return (
                <group key={i}>
                  <mesh position={[cx, y - 0.25, mid]} receiveShadow>
                    <boxGeometry args={[RIVER_HALF * 2, 0.45, segLen + 1]} />
                    <meshStandardMaterial color={zone.water} roughness={0.26} metalness={0.04} />
                  </mesh>
                  <mesh position={[cx - 18, y, mid]} receiveShadow>
                    <boxGeometry args={[13.4, 0.9, segLen + 1.5]} />
                    <meshStandardMaterial color={zone.bank} roughness={0.95} />
                  </mesh>
                  <mesh position={[cx + 18, y, mid]} receiveShadow>
                    <boxGeometry args={[13.4, 0.9, segLen + 1.5]} />
                    <meshStandardMaterial color={zone.bank} roughness={0.95} />
                  </mesh>
                </group>
              );
            })}
          </group>
        );
      })}

      {Array.from({ length: 48 }).map((_, i) => {
        const z = 18 + i * 31;
        const z2 = z + 11;
        return (
          <group key={i}>
            <Palm x={riverCenterX(z) - 13.3 - (i % 2) * 1.8} z={z} y={riverY(z)} s={0.72 + (i % 3) * 0.08} />
            <Palm x={riverCenterX(z2) + 13.2 + (i % 2) * 1.7} z={z2} y={riverY(z2)} s={0.72 + ((i + 1) % 3) * 0.08} />
          </group>
        );
      })}

      <TunnelSection />
      <Rapids />

      {/* Waterfall lip + spray. */}
      <group position={[0, -0.7, 726]}>
        <mesh position={[0, 0.45, 0]} rotation={[-0.18, 0, 0]} receiveShadow>
          <boxGeometry args={[22.6, 0.35, 54]} />
          <meshStandardMaterial color="#1494c1" roughness={0.22} />
        </mesh>
        {[-8, -4, 0, 4, 8].map((x) => (
          <mesh key={x} position={[x, 1.2, 24]}>
            <sphereGeometry args={[0.55, 10, 10]} />
            <meshBasicMaterial color="#e7fbff" transparent opacity={0.72} />
          </mesh>
        ))}
      </group>

      {obstacles.map((o) => {
        const y = riverY(o.z);
        if (o.kind === "island") {
          return (
            <group key={o.id} position={[o.x, y, o.z]}>
              <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[o.r, o.r * 1.15, 0.6, 10]} />
                <meshStandardMaterial color="#d9c07b" roughness={0.9} />
              </mesh>
              <mesh position={[0.2, 0.4, -0.1]} castShadow>
                <cylinderGeometry args={[o.r * 0.72, o.r * 0.85, 0.5, 9]} />
                <meshStandardMaterial color="#58a95f" roughness={0.85} />
              </mesh>
              <Palm x={0.15} z={0.1} s={0.45} />
            </group>
          );
        }
        if (o.kind === "buoy") {
          return (
            <group key={o.id} position={[o.x, y + 0.3, o.z]}>
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
        if (o.kind === "log") {
          return (
            <mesh key={o.id} position={[o.x, y + 0.35, o.z]} rotation={[0, 0, Math.PI / 2.7]} castShadow>
              <cylinderGeometry args={[0.48, 0.62, o.r * 3.2, 10]} />
              <meshStandardMaterial color="#6c4a2b" roughness={0.95} />
            </mesh>
          );
        }
        if (o.kind === "shark") {
          return <SharkMesh key={o.id} x={o.x} z={o.z} y={y} />;
        }
        return (
          <mesh key={o.id} position={[o.x, y + 0.45, o.z]} castShadow>
            <dodecahedronGeometry args={[o.r, 0]} />
            <meshStandardMaterial color="#657381" roughness={0.88} />
          </mesh>
        );
      })}

      <mesh position={[riverCenterX(COURSE_LENGTH), riverY(COURSE_LENGTH) + 0.04, COURSE_LENGTH]} receiveShadow>
        <boxGeometry args={[22, 0.12, 1.5]} />
        <meshStandardMaterial color="#ffd84a" emissive="#ffb300" emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
}

/** A shark that patrols just under the surface and periodically leaps clear across the
 *  river — the fin telegraphs it, then it arcs up out of the water forcing a duck. */
function SharkMesh({ x, z, y }: { x: number; z: number; y: number }) {
  const group = useRef<any>(null);
  const phase = useRef(seededNoise(x * 3.1 + z * 1.7) * Math.PI * 2);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime + phase.current;
    const cycle = 3.2;
    const p = (t % cycle) / cycle;
    const leap = Math.max(0, Math.sin(p * Math.PI * 2.4));
    const arcHeight = leap > 0 ? leap * 2.6 : 0;
    group.current.position.set(x, y + 0.15 + arcHeight, z);
    group.current.rotation.x = -leap * 0.9;
    group.current.rotation.z = Math.sin(t * 4) * 0.12;
  });

  return (
    <group ref={group} position={[x, y + 0.15, z]}>
      <mesh rotation={[0, 0, 0]} castShadow>
        <coneGeometry args={[0.42, 2.1, 8]} />
        <meshStandardMaterial color="#5a6b78" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.55, -0.3]} rotation={[Math.PI, 0, 0]} castShadow>
        <coneGeometry args={[0.32, 0.6, 6]} />
        <meshStandardMaterial color="#5a6b78" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.55, 0.5]} castShadow>
        <coneGeometry args={[0.16, 0.5, 5]} />
        <meshStandardMaterial color="#3f4b55" roughness={0.6} />
      </mesh>
    </group>
  );
}

function CrewFigure({
  color,
  skin,
  pose,
  x,
  z,
  knocked = false,
}: {
  color: string;
  skin?: string;
  pose: AvatarPose | null;
  x: number;
  z: number;
  knocked?: boolean;
}) {
  return (
    <group position={[x, 0.75, z]} scale={0.58} rotation={[0, knocked ? Math.PI / 2 : 0, knocked ? -0.4 : 0]}>
      <ObbyAvatar color={color} skin={skin} moving pose={pose} speedMul={0.7} />
    </group>
  );
}

function TeamBoat({
  color,
  enemy = false,
  pose = null,
  crew,
  t,
}: {
  color: string;
  enemy?: boolean;
  pose?: AvatarPose | null;
  crew: CrewState[];
  t: number;
}) {
  const { skinTone } = useCharacterAppearance();
  const hull = enemy ? "#ff785f" : color;
  const trim = enemy ? "#ffb357" : "#61d3c2";
  const slots: Vec[] = [
    { x: -0.94, y: 0, z: 0.9 },
    { x: 0.94, y: 0, z: 0.9 },
    { x: -0.79, y: 0, z: -1.0 },
    { x: 0.79, y: 0, z: -1.0 },
  ];

  return (
    <group>
      {/* Narrow arcade river boat with a pointed bow and visible deck. */}
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.6, 0.48, 6.4]} />
        <meshStandardMaterial color={hull} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.22, 3.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[1.8, 1.5, 4]} />
        <meshStandardMaterial color={hull} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.45, -0.35]} castShadow>
        <boxGeometry args={[3.05, 0.2, 5.6]} />
        <meshStandardMaterial color={trim} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.72, 2.65]} rotation={[0.12, 0, 0]} castShadow>
        <boxGeometry args={[2.55, 0.26, 0.85]} />
        <meshStandardMaterial color="#e7f1f4" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.82, -2.25]} castShadow>
        <boxGeometry args={[1.65, 0.25, 0.65]} />
        <meshStandardMaterial color="#5d3f27" roughness={0.8} />
      </mesh>
      {/* Cannon / launcher. */}
      <mesh position={[0, 1.05, 2.0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 2.15, 10]} />
        <meshStandardMaterial color="#30343c" metalness={0.35} roughness={0.4} />
      </mesh>

      {slots.map((slot, i) => {
        if (i >= crew.length) return null;
        const knocked = crew[i].knockedUntil > t;
        if (knocked) return null;
        const shift = Math.sin(t * 1.2 + i * 1.7) * 0.1;
        return (
          <CrewFigure
            key={i}
            color={enemy ? (i % 2 ? "#ffb14a" : "#f06f57") : (i % 2 ? "#7e57c2" : color)}
            skin={enemy ? undefined : skinTone}
            pose={pose}
            x={slot.x + shift}
            z={slot.z}
          />
        );
      })}
    </group>
  );
}

function Swimmer({ color, x, z, y }: { color: string; x: number; z: number; y: number }) {
  return (
    <group position={[x, y + 0.12, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.78, 20]} />
        <meshBasicMaterial color="#d8fbff" transparent opacity={0.65} />
      </mesh>
      <group position={[0, 0.1, 0]} scale={0.38} rotation={[0, Math.PI / 2, 0]}>
        <ObbyAvatar color={color} moving pose="interact" speedMul={0.8} />
      </group>
    </group>
  );
}

/** Rain that follows the player boat through Storm Reach — a small pool of falling streaks
 *  recycled overhead so it always reads as rain right around the action. */
function Rain({ originRef }: { originRef: MutableRefObject<Runtime> }) {
  const drops = useMemo(
    () =>
      Array.from({ length: 55 }, () => ({
        ox: (Math.random() - 0.5) * 26,
        oz: (Math.random() - 0.5) * 26,
        oy: Math.random() * 10,
        speed: 15 + Math.random() * 7,
      })),
    [],
  );
  const refs = useRef<any[]>([]);

  useFrame((_, dt) => {
    const s = originRef.current;
    const baseY = riverY(s.z);
    drops.forEach((d, i) => {
      const m = refs.current[i];
      if (!m) return;
      d.oy -= d.speed * dt;
      if (d.oy < 0) d.oy = 10 + Math.random() * 4;
      m.position.set(s.x + d.ox, baseY + d.oy, s.z + d.oz);
    });
  });

  return (
    <group>
      {drops.map((_, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }}>
          <cylinderGeometry args={[0.02, 0.02, 0.55, 4]} />
          <meshBasicMaterial color="#cfe9ff" transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function ProjectileMesh({ shot }: { shot: Shot }) {
  return (
    <group position={[shot.x, shot.y, shot.z]}>
      <mesh castShadow>
        <sphereGeometry args={[0.24, 12, 12]} />
        <meshStandardMaterial
          color={shot.owner === "player" ? "#ffd43b" : "#ff675c"}
          emissive={shot.owner === "player" ? "#ff9f1a" : "#ff2d55"}
          emissiveIntensity={1.25}
        />
      </mesh>
      <mesh position={[0, 0, shot.owner === "player" ? -0.35 : 0.35]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshBasicMaterial color="#fff1a8" transparent opacity={0.65} />
      </mesh>
    </group>
  );
}

function activeCrew(crew: CrewState[], t: number) {
  return crew.reduce((n, c) => n + (c.knockedUntil <= t ? 1 : 0), 0);
}

function nextCrewHit(crew: CrewState[], t: number) {
  return crew.findIndex((c) => c.knockedUntil <= t);
}

function resetRuntime(): Runtime {
  return {
    x: -2.6,
    z: 0,
    rivalX: 2.8,
    rivalZ: 2.5,
    health: 3,
    rivalHealth: 3,
    score: 0,
    shots: [],
    playerCrew: Array.from({ length: DEFAULT_CREW }, (_, i) => ({ knockedUntil: 0, side: i % 2 ? 1 : -1 } as CrewState)),
    rivalCrew: Array.from({ length: DEFAULT_CREW }, (_, i) => ({ knockedUntil: 0, side: i % 2 ? 1 : -1 } as CrewState)),
    hitCooldown: 0,
    rivalHitCooldown: 0,
    duckUntil: 0,
    fireCooldown: 0,
    rivalFireCooldown: 1.3,
    finished: false,
    nextShotId: 1,
    zoneIndex: 0,
  };
}

function BattleScene({
  inputRef,
  fireRef,
  duckRef,
  onHud,
  onStatus,
  onFinish,
}: {
  inputRef: MutableRefObject<Input>;
  fireRef: MutableRefObject<boolean>;
  duckRef: MutableRefObject<boolean>;
  onHud: (health: number, rivalHealth: number, score: number, progress: number, rivalProgress: number, crew: number, rivalCrew: number, zone: string) => void;
  onStatus: (status: string) => void;
  onFinish: (won: boolean, score: number) => void;
}) {
  const playerGroup = useRef<any>(null);
  const rivalGroup = useRef<any>(null);
  const { camera } = useThree();
  const runtime = useRef<Runtime>(resetRuntime());
  const lastHud = useRef(0);
  const lastStatus = useRef(0);
  const ambientRef = useRef<any>(null);
  const dirRef = useRef<any>(null);
  const stormActiveRef = useRef(false);
  const lightningTimer = useRef(3);
  const lightningBoost = useRef(0);

  useEffect(() => () => battleshipSfx.rainStop(), []);
  const [shots, setShots] = useState<Shot[]>([]);
  const [playerPose, setPlayerPose] = useState<AvatarPose | null>(null);
  const [rivalPose, setRivalPose] = useState<AvatarPose | null>(null);
  const [crewSnapshot, setCrewSnapshot] = useState({ player: runtime.current.playerCrew.map((c) => ({ ...c })), rival: runtime.current.rivalCrew.map((c) => ({ ...c })) });
  const [animT, setAnimT] = useState(0);

  const shoot = (owner: "player" | "rival", s: Runtime, t: number) => {
    if (owner === "player") {
      if (s.fireCooldown > 0) return;
      if (activeCrew(s.playerCrew, t) <= 0) return;
      s.fireCooldown = 0.72;
      const dx = s.rivalX - s.x;
      const dz = s.rivalZ - s.z;
      const len = Math.hypot(dx, dz) || 1;
      s.shots.push({
        id: s.nextShotId++, owner: "player", x: s.x, y: riverY(s.z) + 1.2, z: s.z + 2.7,
        vx: (dx / len) * PROJECTILE_SPEED, vz: (dz / len) * PROJECTILE_SPEED,
      });
      setPlayerPose("interact");
      window.setTimeout(() => setPlayerPose(null), 240);
      onStatus("FIRE! Knock their crew overboard");
      battleshipSfx.launch();
    } else {
      if (s.rivalFireCooldown > 0) return;
      if (activeCrew(s.rivalCrew, t) <= 0) return;
      s.rivalFireCooldown = 0.95;
      const dx = s.x - s.rivalX;
      const dz = s.z - s.rivalZ;
      const len = Math.hypot(dx, dz) || 1;
      s.shots.push({
        id: s.nextShotId++, owner: "rival", x: s.rivalX, y: riverY(s.rivalZ) + 1.2, z: s.rivalZ - 2.7,
        vx: (dx / len) * PROJECTILE_SPEED, vz: (dz / len) * PROJECTILE_SPEED,
      });
      setRivalPose("interact");
      window.setTimeout(() => setRivalPose(null), 240);
      battleshipSfx.launch();
    }
  };

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const t = clock.elapsedTime;
    const s = runtime.current;
    if (s.finished) return;

    s.hitCooldown = Math.max(0, s.hitCooldown - dt);
    s.rivalHitCooldown = Math.max(0, s.rivalHitCooldown - dt);
    s.fireCooldown = Math.max(0, s.fireCooldown - dt);
    s.rivalFireCooldown = Math.max(0, s.rivalFireCooldown - dt);
    if (duckRef.current) s.duckUntil = t + 0.2;

    const playerCrewCount = Math.max(1, activeCrew(s.playerCrew, t));
    const rivalCrewCount = Math.max(1, activeCrew(s.rivalCrew, t));
    const crewSpeedMul = 0.78 + playerCrewCount * 0.11;
    const rivalCrewSpeedMul = 0.78 + rivalCrewCount * 0.11;

    // Screen gestures steer only; the river provides forward motion.
    s.x += inputRef.current.x * STEER_SPEED * dt;
    const playerChannel = riverCenterX(s.z);
    s.x = Math.max(playerChannel - RIVER_HALF + 2.0, Math.min(playerChannel + RIVER_HALF - 2.0, s.x));
    s.z += PLAYER_SPEED * crewSpeedMul * dt;

    // AI rival races alongside the user and gradually becomes more aggressive.
    const currentZone = Math.max(0, zoneAt(s.rivalZ));
    const difficulty = 1 + currentZone * 0.055;
    const rivalChannel = riverCenterX(s.rivalZ);
    const avoid = obstacles
      .filter((o) => o.z > s.rivalZ && o.z < s.rivalZ + 18)
      .sort((a, b) => a.z - b.z)[0];
    const desiredX = avoid && Math.abs(avoid.x - s.rivalX) < avoid.r + 2.3
      ? (avoid.x > 0 ? avoid.x - 5.3 : avoid.x + 5.3)
      : rivalChannel + Math.sin(t * 0.45 + s.rivalZ * 0.015) * 5.0;
    s.rivalX += Math.max(-1, Math.min(1, desiredX - s.rivalX)) * 4.5 * dt;
    s.rivalX = Math.max(rivalChannel - RIVER_HALF + 2.0, Math.min(rivalChannel + RIVER_HALF - 2.0, s.rivalX));
    const catchup = s.rivalZ < s.z - 18 ? 1.16 : s.rivalZ > s.z + 18 ? 0.9 : 1;
    s.rivalZ += RIVAL_SPEED * rivalCrewSpeedMul * difficulty * catchup * dt;

    if (fireRef.current) {
      fireRef.current = false;
      shoot("player", s, t);
    }

    // Rival crew takes turns shooting at the player whenever close enough.
    const separation = Math.hypot(s.rivalX - s.x, s.rivalZ - s.z);
    if (separation < 38 && activeCrew(s.rivalCrew, t) > 0 && s.rivalFireCooldown <= 0) {
      shoot("rival", s, t);
      s.rivalFireCooldown = Math.max(0.8, 2.3 - currentZone * 0.16);
      if (t - lastStatus.current > 0.8) {
        lastStatus.current = t;
        onStatus("Incoming! Swipe away or DUCK");
      }
    }

    // Collision hazards become denser as the race progresses.
    const playerDucking = t < s.duckUntil;
    for (const o of obstacles) {
      if (o.kind === "shark") {
        if (Math.abs(o.z - s.z) < 3.2) {
          const d = Math.hypot(o.x - s.x, o.z - s.z);
          if (d < o.r + 1.6 && s.hitCooldown <= 0) {
            if (playerDucking) {
              s.score += 60;
              onStatus("Ducked under the shark!");
            } else {
              s.hitCooldown = 1.05;
              s.health -= 1;
              s.score = Math.max(0, s.score - 90);
              setPlayerPose("stumble");
              window.setTimeout(() => setPlayerPose(null), 520);
              onStatus("Shark strike — DUCK next time!");
              battleshipSfx.hit();
              for (const c of s.playerCrew) {
                if (c.knockedUntil > t) c.knockedUntil += 2.5;
              }
            }
          }
        }
        continue;
      }
      if (Math.abs(o.z - s.z) < 3.8) {
        const d = Math.hypot(o.x - s.x, o.z - s.z);
        if (d < o.r + 1.25 && s.hitCooldown <= 0) {
          s.hitCooldown = 1.05;
          s.health -= 1;
          s.score = Math.max(0, s.score - 80);
          s.x += s.x <= o.x ? -2.0 : 2.0;
          setPlayerPose("stumble");
          window.setTimeout(() => setPlayerPose(null), 520);
          onStatus("Obstacle hit — recover and keep racing");
          battleshipSfx.hit();
        }
      }
      if (Math.abs(o.z - s.rivalZ) < 3.8) {
        const d = Math.hypot(o.x - s.rivalX, o.z - s.rivalZ);
        if (d < o.r + 1.25 && s.rivalHitCooldown <= 0) {
          s.rivalHitCooldown = 1.0;
          s.rivalHealth -= 1;
          s.rivalX += s.rivalX <= o.x ? -2.0 : 2.0;
          setRivalPose("stumble");
          window.setTimeout(() => setRivalPose(null), 500);
          battleshipSfx.hit();
        }
      }
    }

    const remaining: Shot[] = [];
    let crewChanged = false;
    for (const sh of s.shots) {
      sh.x += sh.vx * dt;
      sh.z += sh.vz * dt;
      sh.y = riverY(sh.z) + 1.2 + Math.sin((sh.z + sh.x) * 0.22) * 0.08;

      if (sh.owner === "player") {
        if (Math.hypot(sh.x - s.rivalX, sh.z - s.rivalZ) < 2.85) {
          if (s.rivalHitCooldown <= 0) {
            s.rivalHitCooldown = 0.65;
            const crewIndex = nextCrewHit(s.rivalCrew, t);
            if (crewIndex >= 0) {
              s.rivalCrew[crewIndex].knockedUntil = t + 4.0;
              crewChanged = true;
              s.score += 260;
              onStatus("Crew overboard! Keep pressure on their boat");
            } else {
              s.rivalHealth -= 1;
              s.score += 150;
              onStatus("Hull hit!");
            }
            setRivalPose("stumble");
            window.setTimeout(() => setRivalPose(null), 450);
            battleshipSfx.hit();
          }
          continue;
        }
      } else if (Math.hypot(sh.x - s.x, sh.z - s.z) < 2.85) {
        const ducking = t < s.duckUntil;
        if (ducking) {
          s.score += 70;
          onStatus("Perfect duck — shot sailed over you");
        } else if (s.hitCooldown <= 0) {
          s.hitCooldown = 0.65;
          const crewIndex = nextCrewHit(s.playerCrew, t);
          if (crewIndex >= 0) {
            s.playerCrew[crewIndex].knockedUntil = t + 4.0;
            crewChanged = true;
            s.score = Math.max(0, s.score - 90);
            onStatus("Crew overboard — they're swimming back!");
          } else {
            s.health -= 1;
            onStatus("Hull hit — steer hard!");
          }
          setPlayerPose("stumble");
          window.setTimeout(() => setPlayerPose(null), 450);
          battleshipSfx.hit();
        }
        continue;
      }

      if (sh.z > Math.max(s.z, s.rivalZ) + 65 || sh.z < Math.min(s.z, s.rivalZ) - 40 || Math.abs(sh.x) > 34) continue;
      remaining.push(sh);
    }
    s.shots = remaining;
    setShots(remaining.map((q) => ({ ...q })));

    if (crewChanged || Math.floor(t * 4) !== Math.floor(animT * 4)) {
      setCrewSnapshot({ player: s.playerCrew.map((c) => ({ ...c })), rival: s.rivalCrew.map((c) => ({ ...c })) });
      setAnimT(t);
    }

    if (playerGroup.current) {
      const y = riverY(s.z);
      playerGroup.current.position.set(s.x, y + 0.08 + Math.sin(t * 2.2) * 0.05, s.z);
      playerGroup.current.rotation.z = -inputRef.current.x * 0.06 + Math.sin(t * 1.8) * 0.015;
      playerGroup.current.rotation.y = -inputRef.current.x * 0.09;
      if (s.z > 700 && s.z < 760) playerGroup.current.rotation.x = -0.12;
      else playerGroup.current.rotation.x *= 0.9;
    }
    if (rivalGroup.current) {
      const y = riverY(s.rivalZ);
      rivalGroup.current.position.set(s.rivalX, y + 0.08 + Math.sin(t * 2.05 + 1.3) * 0.05, s.rivalZ);
      rivalGroup.current.rotation.z = Math.sin(t * 1.7 + 1.1) * 0.02;
      if (s.rivalZ > 700 && s.rivalZ < 760) rivalGroup.current.rotation.x = -0.12;
      else rivalGroup.current.rotation.x *= 0.9;
    }

    // Follow both boats: the camera sits behind the player but keeps the rival in view when nearby.
    const focusZ = Math.max(s.z + 8, Math.min(s.z + 18, (s.z + s.rivalZ) / 2 + 7));
    const playerY = riverY(s.z);
    camera.position.x += (s.x * 0.22 - camera.position.x) * Math.min(1, dt * 5.4);
    camera.position.y += (playerY + 11.2 - camera.position.y) * Math.min(1, dt * 4.8);
    camera.position.z += (s.z - 15.5 - camera.position.z) * Math.min(1, dt * 5.5);
    camera.lookAt((s.x + s.rivalX * 0.35) * 0.2, playerY + 0.9, focusZ);

    const zi = Math.max(0, zoneAt(s.z));
    if (zi !== s.zoneIndex) {
      s.zoneIndex = zi;
      onStatus(`${zones[zi].name} — the river gets harder from here`);
    }

    // Storm Reach: rolling rain ambience plus the occasional lightning strike that briefly
    // brightens the whole scene and cracks with thunder.
    const inStorm = s.z >= STORM_START && s.z < STORM_END;
    if (inStorm !== stormActiveRef.current) {
      stormActiveRef.current = inStorm;
      if (inStorm) battleshipSfx.rainStart();
      else battleshipSfx.rainStop();
    }
    if (inStorm) {
      lightningTimer.current -= dt;
      if (lightningTimer.current <= 0) {
        lightningTimer.current = 2.5 + Math.random() * 4;
        lightningBoost.current = 1;
        battleshipSfx.thunder();
      }
    }
    lightningBoost.current = Math.max(0, lightningBoost.current - dt * 2.2);
    if (ambientRef.current) ambientRef.current.intensity = 1.15 + lightningBoost.current * 2.4;
    if (dirRef.current) dirRef.current.intensity = 1.8 + lightningBoost.current * 1.6;

    if (t - lastHud.current > 0.12) {
      lastHud.current = t;
      onHud(
        Math.max(0, s.health), Math.max(0, s.rivalHealth), s.score,
        Math.min(1, s.z / COURSE_LENGTH), Math.min(1, s.rivalZ / COURSE_LENGTH),
        activeCrew(s.playerCrew, t), activeCrew(s.rivalCrew, t), zones[zi]?.name ?? "Final Cove",
      );
    }

    // Running out of hull does not immediately end the race: it slows you and restores one hull point.
    if (s.health <= 0) {
      s.health = 1;
      s.z = Math.max(0, s.z - 16);
      onStatus("Boat recovered — you lost ground but you're still in the race");
    }
    if (s.rivalHealth <= 0) {
      s.rivalHealth = 1;
      s.rivalZ = Math.max(0, s.rivalZ - 16);
      onStatus("Rival boat damaged — they're losing ground");
    }

    // First boat across the final line wins.
    if (s.z >= COURSE_LENGTH || s.rivalZ >= COURSE_LENGTH) {
      s.finished = true;
      const won = s.z >= s.rivalZ;
      if (won) {
        setPlayerPose("celebrate");
        s.score += 1600 + activeCrew(s.playerCrew, t) * 250;
        onStatus("Fleet Victory — first across the finish!");
        battleshipSfx.victory();
      } else {
        setRivalPose("celebrate");
        onStatus("Rival fleet crossed first — run it back");
        battleshipSfx.defeat();
      }
      onFinish(won, s.score);
    }
  });

  const t = animT;
  const inStorm = runtime.current.z >= STORM_START && runtime.current.z < STORM_END;
  return (
    <>
      <ambientLight ref={ambientRef} intensity={1.15} />
      <directionalLight ref={dirRef} position={[8, 20, -6]} intensity={1.8} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <hemisphereLight args={["#dff5ff", "#446b3b", 0.85]} />
      <RiverWorld />
      {inStorm && <Rain originRef={runtime} />}

      <group ref={playerGroup}>
        <TeamBoat color="#7f4be8" pose={duckRef.current ? "stumble" : playerPose} crew={crewSnapshot.player} t={t} />
      </group>
      <group ref={rivalGroup}>
        <TeamBoat color="#ef6a57" enemy pose={rivalPose} crew={crewSnapshot.rival} t={t} />
      </group>

      {crewSnapshot.player.map((c, i) => c.knockedUntil > t && (
        <Swimmer key={`ps-${i}`} color={i % 2 ? "#7e57c2" : "#7f4be8"} x={runtime.current.x + c.side * 3.4} z={runtime.current.z - 4.3 - i * 0.5} y={riverY(runtime.current.z)} />
      ))}
      {crewSnapshot.rival.map((c, i) => c.knockedUntil > t && (
        <Swimmer key={`rs-${i}`} color={i % 2 ? "#ffb14a" : "#f06f57"} x={runtime.current.rivalX + c.side * 3.4} z={runtime.current.rivalZ - 4.3 - i * 0.5} y={riverY(runtime.current.rivalZ)} />
      ))}

      {shots.map((sh) => <ProjectileMesh key={sh.id} shot={sh} />)}
    </>
  );
}

const STEER_STICK_MAX = 58;

/** Same invisible-until-touched, origin-anchored drag pattern as YAJ Obby's Joystick —
 *  no fixed visible controller, a transparent knob only appears at the point you touch,
 *  and steering is a single left/right axis since the river carries the boat forward. */
function ScreenSteering({ inputRef }: { inputRef: MutableRefObject<Input> }) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState<{ ox: number; oy: number; dx: number } | null>(null);

  const update = (clientX: number) => {
    const o = origin.current;
    if (!o) return;
    let dx = clientX - o.x;
    dx = Math.max(-STEER_STICK_MAX, Math.min(STEER_STICK_MAX, dx));
    setKnob({ ox: o.x, oy: o.y, dx });
    const dead = 0.12;
    let nx = -dx / STEER_STICK_MAX;
    if (Math.abs(nx) < dead) nx = 0;
    inputRef.current.x = nx;
  };

  const release = () => {
    origin.current = null;
    setKnob(null);
    inputRef.current = { x: 0, z: 0 };
  };

  return (
    <div
      className="absolute inset-0 z-20 touch-none select-none"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        void battleshipSfx.prime();
        origin.current = { x: e.clientX, y: e.clientY };
        setKnob({ ox: e.clientX, oy: e.clientY, dx: 0 });
        inputRef.current = { x: 0, z: 0 };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!origin.current) return;
        update(e.clientX);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      {knob && (
        <div
          className="pointer-events-none absolute h-24 w-24 rounded-full border border-white/15 bg-white/5"
          style={{ left: knob.ox, top: knob.oy, transform: "translate(-50%, -50%)" }}
        >
          <div
            className="absolute left-1/2 top-1/2 h-10 w-10 rounded-full border border-white/25 bg-white/25"
            style={{ transform: `translate(calc(-50% + ${knob.dx}px), -50%)` }}
          />
        </div>
      )}
    </div>
  );
}

export default function FleetClashStage({ playerColor = "#7f4be8", opponentName = "Computer", muted, onToggleMute, onStatus, onFinish, onBack, liveDock }: Props) {
  const inputRef = useRef<Input>({ x: 0, z: 0 });
  const fireRef = useRef(false);
  const duckRef = useRef(false);
  const [health, setHealth] = useState(3);
  const [rivalHealth, setRivalHealth] = useState(3);
  const [progress, setProgress] = useState(0);
  const [rivalProgress, setRivalProgress] = useState(0);
  const [crew, setCrew] = useState(DEFAULT_CREW);
  const [rivalCrew, setRivalCrew] = useState(DEFAULT_CREW);
  const [zone, setZone] = useState(zones[0].name);

  useEffect(() => {
    battleshipSfx.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") inputRef.current.x = -1;
      if (e.key === "ArrowRight" || e.key === "d") inputRef.current.x = 1;
      if (e.key === " ") fireRef.current = true;
      if (e.key.toLowerCase() === "q") duckRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "a", "d"].includes(e.key)) inputRef.current.x = 0;
      if (e.key.toLowerCase() === "q") duckRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-sky-900">
      <Canvas shadows camera={{ position: [0, 11.2, -15.5], fov: 55 }} dpr={[1, 1.55]}>
        <BattleScene
          inputRef={inputRef}
          fireRef={fireRef}
          duckRef={duckRef}
          onHud={(h, rh, _s, p, rp, c, rc, zn) => {
            setHealth(h); setRivalHealth(rh); setProgress(p); setRivalProgress(rp); setCrew(c); setRivalCrew(rc); setZone(zn);
          }}
          onStatus={onStatus}
          onFinish={onFinish}
        />
      </Canvas>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="absolute left-3 top-3 z-40 rounded-full border border-white/15 bg-slate-950/50 p-2.5 text-white backdrop-blur-md active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}

      <div className="pointer-events-none absolute left-3 right-3 top-3 z-30 pl-12">
        <div className="rounded-2xl border border-white/15 bg-slate-950/62 px-3 py-2 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-200">Your boat</div>
              <div className="mt-1 flex items-center gap-2 text-xs font-black text-white"><span>{crew}/{MAX_CREW} crew</span><span className="text-white/35">•</span><span>{"❤️".repeat(Math.max(0, health))}</span></div>
            </div>
            <div className="px-2 text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">{zone}</div>
              <div className="mt-1 text-xs font-black text-white">{Math.round(progress * 100)}% <span className="text-white/40">vs</span> {Math.round(rivalProgress * 100)}%</div>
            </div>
            <div className="min-w-0 text-right">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-200">{opponentName}</div>
              <div className="mt-1 flex items-center justify-end gap-2 text-xs font-black text-white"><span>{rivalCrew}/{MAX_CREW} crew</span><span className="text-white/35">•</span><span>{"❤️".repeat(Math.max(0, rivalHealth))}</span></div>
            </div>
          </div>
          <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${Math.round(progress * 100)}%` }} />
            <div className="absolute inset-y-0 left-0 w-1 bg-white" style={{ left: `${Math.round(rivalProgress * 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="absolute right-3 top-[90px] z-40 flex items-center gap-2">
        {liveDock}
        <button type="button" onClick={onToggleMute} className="rounded-full border border-white/15 bg-slate-950/50 p-3 text-white backdrop-blur-md" aria-label="Toggle sound">
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      <ScreenSteering inputRef={inputRef} />

      <div className="pointer-events-none absolute bottom-4 right-3 z-40 flex items-end justify-end gap-3">
        <div className="flex gap-2 pointer-events-auto">
          <button
            type="button"
            onPointerDown={() => { void battleshipSfx.prime(); duckRef.current = true; }}
            onPointerUp={() => { duckRef.current = false; }}
            onPointerLeave={() => { duckRef.current = false; }}
            onPointerCancel={() => { duckRef.current = false; }}
            className="h-16 w-16 rounded-full border border-white/25 bg-white/12 text-[11px] font-black uppercase text-white shadow-xl backdrop-blur-md active:scale-95"
          >
            Duck
          </button>
          <button
            type="button"
            onClick={() => { void battleshipSfx.prime(); fireRef.current = true; }}
            className="h-20 w-20 rounded-full border-2 border-yellow-200/60 bg-gradient-to-br from-orange-400/95 to-red-500/95 text-sm font-black uppercase text-white shadow-[0_0_28px_rgba(255,138,0,.35)] active:scale-95"
          >
            Fire
          </button>
        </div>
      </div>
    </div>
  );
}
