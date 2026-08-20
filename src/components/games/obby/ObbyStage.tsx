import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ArrowLeft, HelpCircle, Volume2, VolumeX } from "lucide-react";
import ObbyAvatar from "@/components/games/obby/ObbyAvatar";
import {
  AIR_CONTROL,
  Course,
  FALL_DEATH_Y,
  GRAVITY,
  JUMP_V,
  OBBY_COURSE,
  PLAT_THICKNESS,
  Plat,
  RUN_SPEED,
  formatMs,
  nearestCheckpoint,
  platColor,
  platPos,
  platformUnder,
  progressPct,
} from "@/lib/obby";
import { obbySfx } from "@/lib/obby-sfx";

export type Ghost = { id: string; name: string; color: string; x: number; y: number; z: number; ry: number };

type Input = { x: number; z: number; jump: boolean };

type StageProps = {
  myColor: string;
  ghosts: Ghost[];
  /** Called ~8x per second with the local racer's position, for multiplayer sync. */
  onSample?: (x: number, y: number, z: number, ry: number) => void;
  onFinish?: (ms: number) => void;
  onBack: () => void;
  raceStartedAt: number | null;
  headline: string;
  subline: string;
  howToPlay: string[];
  muted: boolean;
  onToggleMute: () => void;
  frozen?: boolean;
  /** Which YAJ Adventure course to race — defaults to the YAJ Obby course. */
  course?: Course;
};

/* ------------------------------------------------------------------ scenery */

function PlatformMesh({ p }: { p: Plat }) {
  const ref = useRef<any>(null);
  const color = platColor(p);
  useFrame(({ clock }) => {
    if (!p.mv || !ref.current) return;
    const [x, y, z] = platPos(p, clock.elapsedTime);
    ref.current.position.set(x, y - PLAT_THICKNESS / 2, z);
  });
  return (
    <mesh ref={ref} position={[p.x, p.y - PLAT_THICKNESS / 2, p.z]} receiveShadow castShadow>
      <boxGeometry args={[p.w, PLAT_THICKNESS, p.d]} />
      <meshStandardMaterial
        color={color}
        roughness={p.kind === "lava" ? 0.25 : 0.6}
        emissive={p.kind === "lava" ? "#ff3b00" : p.kind === "finish" ? "#ffb300" : "#000000"}
        emissiveIntensity={p.kind === "lava" ? 0.7 : p.kind === "finish" ? 0.35 : 0}
      />
    </mesh>
  );
}

function FinishFlag({ course }: { course: Course }) {
  const FINISH = course.finish;
  return (
    <group position={[FINISH.x, FINISH.y, FINISH.z]}>
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[0.14, 4.4, 0.14]} />
        <meshStandardMaterial color="#e8e8ef" />
      </mesh>
      <mesh position={[1.1, 3.7, 0]}>
        <boxGeometry args={[2.1, 1.3, 0.06]} />
        <meshStandardMaterial color="#111119" />
      </mesh>
    </group>
  );
}

function Lava({ course }: { course: Course }) {
  return (
    <mesh position={[0, -9, course.length / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[220, course.length + 120]} />
      <meshStandardMaterial color={course.theme.floor} emissive={course.theme.floorEmissive} emissiveIntensity={0.55} />
    </mesh>
  );
}

/* -------------------------------------------------------------------- racer */

function LocalRacer({
  inputRef,
  color,
  onSample,
  onFinish,
  onHud,
  frozen,
  startedAt,
  course,
}: {
  course: Course;
  inputRef: React.MutableRefObject<Input>;
  color: string;
  onSample?: StageProps["onSample"];
  onFinish?: (ms: number) => void;
  onHud: (z: number, deaths: number) => void;
  frozen?: boolean;
  startedAt: number | null;
}) {
  const group = useRef<any>(null);
  const { camera } = useThree();
  const st = useRef({
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    ry: 0,
    grounded: true,
    deaths: 0,
    carry: null as { id: number; x: number; y: number; z: number } | null,
    done: false,
    lastSample: 0,
    lastHud: 0,
  });
  const [moving, setMoving] = useState(false);
  const [airborne, setAirborne] = useState(false);

  const respawn = (z: number) => {
    const cp = nearestCheckpoint(z, course);
    st.current.x = cp.x;
    st.current.y = cp.y + 0.05;
    st.current.z = cp.z;
    st.current.vx = 0;
    st.current.vz = 0;
    st.current.vy = 0;
    st.current.carry = null;
    st.current.deaths += 1;
    obbySfx.fall();
  };

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const t = clock.elapsedTime;
    const s = st.current;
    const input = inputRef.current;

    if (!frozen && !s.done) {
      const wantX = input.x * RUN_SPEED;
      const wantZ = input.z * RUN_SPEED;
      const k = s.grounded ? 1 : AIR_CONTROL * dt * 8;
      s.vx += (wantX - s.vx) * Math.min(1, s.grounded ? 0.55 : k);
      s.vz += (wantZ - s.vz) * Math.min(1, s.grounded ? 0.55 : k);

      if (input.jump && s.grounded) {
        s.vy = JUMP_V;
        s.grounded = false;
        obbySfx.jump();
      }
      input.jump = false;

      s.x += s.vx * dt;
      s.z += s.vz * dt;

      // Ride moving platforms
      if (s.carry) {
        const plat = course.plats.find((p) => p.id === s.carry!.id);
        if (plat) {
          const [nx, ny, nz] = platPos(plat, t);
          s.x += nx - s.carry.x;
          s.z += nz - s.carry.z;
          if (s.grounded) s.y += ny - s.carry.y;
          s.carry = { id: plat.id, x: nx, y: ny, z: nz };
        }
      }

      s.vy -= GRAVITY * dt;
      s.y += s.vy * dt;

      const hit = platformUnder(s.x, s.y, s.z, t, s.vy <= 0 ? 0.75 : 0.1, course);
      if (hit && s.vy <= 0) {
        if (hit.plat.kind === "lava") {
          respawn(s.z);
        } else {
          if (!s.grounded && s.vy < -4) obbySfx.land();
          s.y = hit.top;
          s.vy = 0;
          s.grounded = true;
          const [cx, cy, cz] = platPos(hit.plat, t);
          s.carry = hit.plat.mv ? { id: hit.plat.id, x: cx, y: cy, z: cz } : null;
          if (hit.plat.kind === "finish" && !s.done) {
            s.done = true;
            onFinish?.(startedAt ? Date.now() - startedAt : 0);
          }
        }
      } else {
        s.grounded = false;
        s.carry = null;
      }

      if (s.y < FALL_DEATH_Y) respawn(s.z);

      const speed = Math.hypot(s.vx, s.vz);
      if (speed > 0.6) s.ry = Math.atan2(s.vx, s.vz);
      setMoving(speed > 0.8 && s.grounded);
      setAirborne(!s.grounded);
    }

    if (group.current) {
      group.current.position.set(s.x, s.y, s.z);
      group.current.rotation.y = s.ry;
    }

    // Chase camera
    const camTargetY = s.y + 4.4;
    camera.position.x += (s.x - camera.position.x) * Math.min(1, dt * 6);
    camera.position.y += (camTargetY - camera.position.y) * Math.min(1, dt * 5);
    camera.position.z += (s.z - 8.4 - camera.position.z) * Math.min(1, dt * 6);
    camera.lookAt(s.x, s.y + 1.4, s.z + 3.4);

    if (t - s.lastSample > 0.12) {
      s.lastSample = t;
      onSample?.(s.x, s.y, s.z, s.ry);
    }
    if (t - s.lastHud > 0.2) {
      s.lastHud = t;
      onHud(s.z, s.deaths);
    }
  });

  return (
    <group ref={group}>
      <ObbyAvatar color={color} moving={moving} airborne={airborne} />
    </group>
  );
}

function GhostRacer({ g }: { g: Ghost }) {
  const group = useRef<any>(null);
  const last = useRef({ x: g.x, y: g.y, z: g.z });
  const [moving, setMoving] = useState(false);
  useFrame((_, dt) => {
    if (!group.current) return;
    const p = group.current.position;
    p.x += (g.x - p.x) * Math.min(1, dt * 10);
    p.y += (g.y - p.y) * Math.min(1, dt * 10);
    p.z += (g.z - p.z) * Math.min(1, dt * 10);
    group.current.rotation.y = g.ry;
    const d = Math.hypot(p.x - last.current.x, p.z - last.current.z);
    last.current = { x: p.x, y: p.y, z: p.z };
    setMoving(d > 0.02);
  });
  return (
    <group ref={group} position={[g.x, g.y, g.z]}>
      <ObbyAvatar color={g.color} moving={moving} ghost />
    </group>
  );
}

/* --------------------------------------------------------------- HUD inputs */

function Joystick({ inputRef }: { inputRef: React.MutableRefObject<Input> }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = (clientX: number, clientY: number) => {
    const el = base.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const max = r.width / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, max);
    dx = (dx / len) * clamped;
    dy = (dy / len) * clamped;
    setKnob({ x: dx, y: dy });
    // Normalised axes with a dead-zone plus axis-snapping so a straight push
    // never leaks a little sideways drift (which used to walk you into lava).
    let nx = dx / max;
    let nz = -dy / max;
    const dead = 0.18;
    if (Math.abs(nx) < dead) nx = 0;
    if (Math.abs(nz) < dead) nz = 0;
    if (Math.abs(nx) < Math.abs(nz) * 0.45) nx = 0;
    if (Math.abs(nz) < Math.abs(nx) * 0.45) nz = 0;
    inputRef.current.x = nx;
    inputRef.current.z = nz;
  };


  const release = () => {
    setKnob({ x: 0, y: 0 });
    inputRef.current.x = 0;
    inputRef.current.z = 0;
  };

  return (
    <div
      ref={base}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 0 && e.pointerType === "mouse") return;
        update(e.clientX, e.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      aria-label="Move"
      className="relative h-32 w-32 touch-none rounded-full border border-white/25 bg-white/10 backdrop-blur-md"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-14 w-14 rounded-full border border-white/40 bg-white/70"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------- stage */

export default function ObbyStage({
  myColor,
  ghosts,
  onSample,
  onFinish,
  onBack,
  raceStartedAt,
  headline,
  subline,
  howToPlay,
  muted,
  onToggleMute,
  frozen,
  course = OBBY_COURSE,
}: StageProps) {
  const inputRef = useRef<Input>({ x: 0, z: 0, jump: false });
  const [hud, setHud] = useState({ z: 0, deaths: 0 });
  const [elapsed, setElapsed] = useState(0);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const keys: Record<string, [number, number]> = {
      KeyW: [0, 1],
      ArrowUp: [0, 1],
      KeyS: [0, -1],
      ArrowDown: [0, -1],
      KeyA: [-1, 0],
      ArrowLeft: [-1, 0],
      KeyD: [1, 0],
      ArrowRight: [1, 0],
    };
    const held = new Set<string>();
    const apply = () => {
      let x = 0;
      let z = 0;
      held.forEach((c) => {
        const v = keys[c];
        if (v) {
          x += v[0];
          z += v[1];
        }
      });
      const l = Math.hypot(x, z) || 1;
      inputRef.current.x = x / l;
      inputRef.current.z = z / l;
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        inputRef.current.jump = true;
        e.preventDefault();
        return;
      }
      if (keys[e.code]) {
        held.add(e.code);
        apply();
      }
    };
    const up = (e: KeyboardEvent) => {
      held.delete(e.code);
      apply();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    if (!raceStartedAt) return;
    const id = window.setInterval(() => setElapsed(Date.now() - raceStartedAt), 100);
    return () => window.clearInterval(id);
  }, [raceStartedAt]);

  const platforms = useMemo(() => course.plats.map((p) => <PlatformMesh key={p.id} p={p} />), [course]);
  const pct = progressPct(hud.z, course);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: course.theme.sky }}>
      <Canvas shadows dpr={[1, 1.6]} camera={{ position: [0, 5, -8], fov: 62 }}>
        <color attach="background" args={[course.theme.sky]} />
        <fog attach="fog" args={[course.theme.fog, 40, 130]} />
        <hemisphereLight args={["#dff1ff", "#4c6b8a", 0.9]} />
        <directionalLight position={[12, 26, -8]} intensity={1.35} castShadow shadow-mapSize={[1024, 1024]} />
        <Lava course={course} />
        {platforms}
        <FinishFlag course={course} />
        {ghosts.map((g) => (
          <GhostRacer key={g.id} g={g} />
        ))}
        <LocalRacer
          course={course}
          inputRef={inputRef}
          color={myColor}
          onSample={onSample}
          onFinish={onFinish}
          onHud={(z, deaths) => setHud({ z, deaths })}
          frozen={frozen}
          startedAt={raceStartedAt}
        />
      </Canvas>

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
          <div className="min-w-0 flex-1 rounded-2xl bg-black/40 px-3 py-2 backdrop-blur-md">
            <p className="truncate text-xs font-black text-primary-foreground">{headline}</p>
            <p className="truncate text-[10px] text-primary-foreground/70">{subline}</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[10px] font-bold text-primary-foreground/80">
              <span>{pct}% of the course</span>
              <span>
                {formatMs(elapsed)} · {hud.deaths} fall{hud.deaths === 1 ? "" : "s"}
              </span>
            </div>
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

        {help && (
          <ul className="pointer-events-auto mt-2 animate-fade-in space-y-1 rounded-2xl bg-black/55 p-3 text-[11px] text-primary-foreground/85 backdrop-blur-md">
            {howToPlay.map((l) => (
              <li key={l}>• {l}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 pb-8">
        <Joystick inputRef={inputRef} />
        <button
          type="button"
          onPointerDown={() => {
            inputRef.current.jump = true;
          }}
          className="h-24 w-24 touch-none rounded-full border border-white/30 bg-primary/85 text-sm font-black uppercase tracking-wide text-primary-foreground backdrop-blur-md active:scale-95"
        >
          Jump
        </button>
      </div>
    </div>
  );
}
