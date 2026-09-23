import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ArrowLeft, Flag, Gauge, LogOut, Volume2, VolumeX } from "lucide-react";
import GameMenu from "@/components/games/GameMenu";
import { confirmQuitGame } from "@/components/games/QuitGameButton";
import { supabase } from "@/integrations/supabase/client";
import { drivingSfx } from "@/lib/driving-sfx";

export type DriveCarId = "gt" | "muscle" | "sport" | "prototype";

export const DRIVE_CARS: { id: DriveCarId; name: string; color: string; accent: string; speed: number; handling: number }[] = [
  { id: "gt", name: "YAJ GT", color: "#2563eb", accent: "#73d8ff", speed: 1, handling: 1 },
  { id: "muscle", name: "Street Muscle", color: "#dc3f36", accent: "#ffb25f", speed: 1.03, handling: 0.92 },
  { id: "sport", name: "Neon Sport", color: "#8b5cf6", accent: "#6ef0d0", speed: 1.06, handling: 1.05 },
  { id: "prototype", name: "Apex Prototype", color: "#111827", accent: "#f7d154", speed: 1.1, handling: 1.08 },
];

export const DRIVE_COURSES = [
  { level: 1, name: "Sunset Speedway", condition: "Fast sweepers", sky: "#ef9a62", ground: "#6b7d45", road: "#30343a", curve: 1, speed: 1, hazard: "barriers" },
  { level: 2, name: "Desert Canyon", condition: "Tight canyon bends", sky: "#d47b48", ground: "#9a5736", road: "#343239", curve: 1.35, speed: 1.03, hazard: "rocks" },
  { level: 3, name: "Coastal Night", condition: "Fast coastal chicanes", sky: "#0b1d35", ground: "#153b45", road: "#20262f", curve: 1.55, speed: 1.07, hazard: "cones" },
  { level: 4, name: "Mountain Storm", condition: "Wet mountain switchbacks", sky: "#394957", ground: "#435341", road: "#252a2e", curve: 1.8, speed: 1.08, hazard: "rain" },
  { level: 5, name: "Metro Grand Prix", condition: "Pro city circuit", sky: "#081425", ground: "#1a2431", road: "#181c23", curve: 2.1, speed: 1.12, hazard: "walls" },
] as const;

type RacerState = {
  userId: string;
  z: number;
  offset: number;
  speed: number;
  carId: DriveCarId;
  finished?: boolean;
};

type RacerInfo = {
  userId: string;
  name: string;
  carId: DriveCarId;
};

type Props = {
  gameId: string;
  userId: string;
  courseLevel: number;
  carId: DriveCarId;
  racers: RacerInfo[];
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  onQuit?: () => void;
  onFinish: (place: number) => void;
};

const TRACK_LENGTH = 920;
const ROAD_HALF = 7.2;
const BASE_SPEED = 31;
const STEER_SPEED = 7.6;

function courseAt(level: number) {
  return DRIVE_COURSES[Math.max(0, Math.min(DRIVE_COURSES.length - 1, level - 1))];
}

function carAt(id: DriveCarId) {
  return DRIVE_CARS.find((car) => car.id === id) || DRIVE_CARS[0];
}

function roadCenter(z: number, level: number) {
  const c = courseAt(level).curve;
  return (
    Math.sin(z * 0.0105) * 7.5 * c +
    Math.sin(z * 0.0042 + 1.6) * 4.0 * c +
    Math.sin(z * 0.022 + 0.4) * 1.8 * Math.max(0, c - 1)
  );
}

function roadHeading(z: number, level: number) {
  const ahead = roadCenter(z + 2, level);
  const behind = roadCenter(z - 2, level);
  return Math.atan2(ahead - behind, 4);
}

function ArcadeCar({ carId, dim = false }: { carId: DriveCarId; dim?: boolean }) {
  const car = carAt(carId);
  return (
    <group scale={[0.9, 0.9, 0.9]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[2.2, 0.55, 4.2]} />
        <meshStandardMaterial color={car.color} metalness={0.35} roughness={0.28} transparent opacity={dim ? 0.5 : 1} />
      </mesh>
      <mesh position={[0, 0.9, -0.2]} castShadow>
        <boxGeometry args={[1.7, 0.62, 1.85]} />
        <meshStandardMaterial color={car.accent} metalness={0.2} roughness={0.2} transparent opacity={dim ? 0.5 : 0.92} />
      </mesh>
      <mesh position={[0, 0.65, 2.0]} castShadow>
        <boxGeometry args={[1.85, 0.18, 0.45]} />
        <meshStandardMaterial color={car.color} metalness={0.4} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.7, -2.15]} castShadow>
        <boxGeometry args={[2.0, 0.12, 0.42]} />
        <meshStandardMaterial color={car.accent} metalness={0.5} roughness={0.22} />
      </mesh>
      {[-0.92, 0.92].flatMap((x) => [-1.35, 1.35].map((z) => (
        <mesh key={`${x}-${z}`} position={[x, 0.25, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 0.34, 12]} />
          <meshStandardMaterial color="#0a0d12" roughness={0.72} />
        </mesh>
      )))}
      <mesh position={[-0.62, 0.55, 2.18]}>
        <boxGeometry args={[0.42, 0.18, 0.08]} />
        <meshBasicMaterial color="#fff0aa" />
      </mesh>
      <mesh position={[0.62, 0.55, 2.18]}>
        <boxGeometry args={[0.42, 0.18, 0.08]} />
        <meshBasicMaterial color="#fff0aa" />
      </mesh>
    </group>
  );
}

function TrackWorld({ level }: { level: number }) {
  const course = courseAt(level);
  const segments = useMemo(() => Array.from({ length: 94 }, (_, i) => i * 10), []);

  return (
    <group>
      <color attach="background" args={[course.sky]} />
      <fog attach="fog" args={[course.sky, 50, 150]} />

      {segments.map((z) => {
        const x = roadCenter(z, level);
        const heading = roadHeading(z, level);
        return (
          <group key={z} position={[x, 0, z]} rotation={[0, -heading, 0]}>
            <mesh receiveShadow position={[0, -0.08, 0]}>
              <boxGeometry args={[ROAD_HALF * 2, 0.22, 10.6]} />
              <meshStandardMaterial color={course.road} roughness={level === 4 ? 0.28 : 0.6} metalness={level === 4 ? 0.16 : 0.03} />
            </mesh>
            <mesh position={[-ROAD_HALF - 0.3, 0.02, 0]}>
              <boxGeometry args={[0.36, 0.14, 10.6]} />
              <meshStandardMaterial color={level === 5 ? "#ff4545" : "#e9e9e9"} />
            </mesh>
            <mesh position={[ROAD_HALF + 0.3, 0.02, 0]}>
              <boxGeometry args={[0.36, 0.14, 10.6]} />
              <meshStandardMaterial color={level === 5 ? "#4dd9ff" : "#e9e9e9"} />
            </mesh>
            {[-2.35, 2.35].map((lane) => (
              <mesh key={lane} position={[lane, 0.04, 0]}>
                <boxGeometry args={[0.08, 0.025, 4.0]} />
                <meshBasicMaterial color="#d7d7d7" transparent opacity={0.65} />
              </mesh>
            ))}
          </group>
        );
      })}

      <CourseScenery level={level} />

      <group position={[roadCenter(TRACK_LENGTH, level), 0, TRACK_LENGTH]}>
        <mesh position={[0, 4.5, 0]}>
          <boxGeometry args={[16, 0.6, 0.7]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        {[-6, -2, 2, 6].map((x, i) => (
          <mesh key={x} position={[x, 4.5, 0.38]}>
            <boxGeometry args={[1.6, 0.35, 0.08]} />
            <meshBasicMaterial color={i % 2 ? "#ffffff" : "#111111"} />
          </mesh>
        ))}
        <mesh position={[-7.4, 2.2, 0]}>
          <boxGeometry args={[0.5, 4.6, 0.5]} />
          <meshStandardMaterial color="#555f6a" />
        </mesh>
        <mesh position={[7.4, 2.2, 0]}>
          <boxGeometry args={[0.5, 4.6, 0.5]} />
          <meshStandardMaterial color="#555f6a" />
        </mesh>
      </group>
    </group>
  );
}

function CourseScenery({ level }: { level: number }) {
  const items = Array.from({ length: 48 }, (_, i) => 20 + i * 19);
  if (level === 1) {
    return (
      <group>
        {items.map((z, i) => {
          const side = i % 2 ? -1 : 1;
          const x = roadCenter(z, level) + side * (10.5 + (i % 3));
          return (
            <group key={i} position={[x, 0, z]}>
              <mesh position={[0, 1.2, 0]} castShadow>
                <cylinderGeometry args={[0.16, 0.22, 2.4, 8]} />
                <meshStandardMaterial color="#5e6c72" />
              </mesh>
              <mesh position={[0, 2.5, 0]}>
                <boxGeometry args={[0.9, 0.45, 0.22]} />
                <meshStandardMaterial color={i % 2 ? "#f3cf58" : "#ef5350"} />
              </mesh>
            </group>
          );
        })}
      </group>
    );
  }

  if (level === 2) {
    return (
      <group>
        {items.map((z, i) => {
          const side = i % 2 ? -1 : 1;
          const x = roadCenter(z, level) + side * (11 + (i % 4));
          const h = 2.8 + (i % 5) * 1.2;
          return (
            <mesh key={i} position={[x, h / 2 - 0.1, z]} castShadow>
              <cylinderGeometry args={[1.5, 2.4, h, 6]} />
              <meshStandardMaterial color={i % 2 ? "#a85e37" : "#c47748"} roughness={0.95} />
            </mesh>
          );
        })}
      </group>
    );
  }

  if (level === 3) {
    return (
      <group>
        {items.map((z, i) => {
          const side = i % 2 ? -1 : 1;
          const x = roadCenter(z, level) + side * 10.5;
          return (
            <group key={i} position={[x, 0, z]}>
              <mesh position={[0, 2.7, 0]} castShadow>
                <cylinderGeometry args={[0.12, 0.16, 5.4, 8]} />
                <meshStandardMaterial color="#334b58" />
              </mesh>
              <pointLight position={[0, 5.0, 0]} color={i % 3 ? "#60e0ff" : "#ff5a98"} intensity={1.6} distance={9} />
            </group>
          );
        })}
      </group>
    );
  }

  if (level === 4) {
    return (
      <group>
        {items.map((z, i) => {
          const side = i % 2 ? -1 : 1;
          const x = roadCenter(z, level) + side * (10.5 + (i % 2));
          return (
            <group key={i} position={[x, 0, z]}>
              <mesh position={[0, 2.5, 0]} rotation={[0, 0, side * 0.12]} castShadow>
                <cylinderGeometry args={[0.22, 0.35, 5, 7]} />
                <meshStandardMaterial color="#4d5559" />
              </mesh>
            </group>
          );
        })}
      </group>
    );
  }

  return (
    <group>
      {items.map((z, i) => {
        const side = i % 2 ? -1 : 1;
        const x = roadCenter(z, level) + side * 11.5;
        const h = 5 + (i % 5) * 2.5;
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, h / 2, 0]} castShadow>
              <boxGeometry args={[4.8, h, 5.0]} />
              <meshStandardMaterial color={i % 2 ? "#1f3145" : "#263b50"} roughness={0.72} />
            </mesh>
            {Array.from({ length: 3 }, (_, w) => (
              <mesh key={w} position={[side * -2.43, 2 + w * 2.1, 0]}>
                <boxGeometry args={[0.06, 0.55, 2.8]} />
                <meshBasicMaterial color={w % 2 ? "#ffd26a" : "#5ae1ff"} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function RaceScene({
  gameId,
  userId,
  courseLevel,
  carId,
  racers,
  onProgress,
  onFinish,
}: {
  gameId: string;
  userId: string;
  courseLevel: number;
  carId: DriveCarId;
  racers: RacerInfo[];
  onProgress: (progress: number, place: number, speed: number) => void;
  onFinish: (place: number) => void;
}) {
  const playerRef = useRef<any>(null);
  const remoteRefs = useRef<Record<string, any>>({});
  const { camera } = useThree();
  const [remoteStates, setRemoteStates] = useState<Record<string, RacerState>>({});
  const input = useRef(0);
  const dragX = useRef<number | null>(null);
  const state = useRef({ z: 0, offset: 0, speed: 0, finished: false, lastSend: 0, hit: 0 });
  const channelRef = useRef<any>(null);
  const ai = useRef(
    Array.from({ length: Math.max(0, 4 - racers.length) }, (_, i) => ({
      userId: `ai-${i}`,
      z: -2 - i * 3,
      offset: [-3.3, 0, 3.3][i % 3],
      speed: BASE_SPEED * (0.9 + i * 0.025),
      carId: (["muscle", "sport", "prototype"] as DriveCarId[])[i % 3],
      finished: false,
    })),
  );
  const aiRefs = useRef<any[]>([]);
  const course = courseAt(courseLevel);
  const car = carAt(carId);

  useEffect(() => {
    const channel = supabase
      .channel(`drive-race-${gameId}`)
      .on("broadcast", { event: "race_state" }, ({ payload }: any) => {
        const next = payload as RacerState;
        if (!next?.userId || next.userId === userId) return;
        setRemoteStates((current) => ({ ...current, [next.userId]: next }));
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [gameId, userId]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      dragX.current = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (dragX.current == null) return;
      const dx = e.clientX - dragX.current;
      dragX.current = e.clientX;
      input.current = Math.max(-1, Math.min(1, dx / 28));
    };
    const up = () => {
      dragX.current = null;
      input.current = 0;
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const s = state.current;
    if (s.finished) return;

    const targetSpeed = BASE_SPEED * course.speed * car.speed;
    s.speed += (targetSpeed - s.speed) * Math.min(1, dt * 2.5);
    s.hit = Math.max(0, s.hit - dt);
    s.offset += input.current * STEER_SPEED * car.handling * dt;
    s.offset = Math.max(-ROAD_HALF + 1.25, Math.min(ROAD_HALF - 1.25, s.offset));
    s.z += s.speed * dt;

    const peers = Object.values(remoteStates);
    for (const peer of peers) {
      if (Math.abs(peer.z - s.z) < 3.8 && Math.abs(peer.offset - s.offset) < 2.0 && s.hit <= 0) {
        const side = peer.offset >= s.offset ? -1 : 1;
        s.offset += side * 1.25;
        s.speed *= 0.82;
        s.hit = 0.45;
        drivingSfx.crash();
      }
    }

    for (const bot of ai.current) {
      const curveBias = Math.sin((bot.z + bot.userId.length * 7) * 0.018) * 2.8;
      bot.offset += (curveBias - bot.offset) * Math.min(1, dt * 0.7);
      bot.z += bot.speed * course.speed * dt;
      if (bot.z >= TRACK_LENGTH) bot.finished = true;
    }

    const x = roadCenter(s.z, courseLevel) + s.offset;
    const heading = roadHeading(s.z, courseLevel);
    if (playerRef.current) {
      playerRef.current.position.set(x, 0.12, s.z);
      playerRef.current.rotation.y = -heading + input.current * -0.08;
      playerRef.current.rotation.z = input.current * -0.05;
    }

    Object.values(remoteStates).forEach((peer) => {
      const ref = remoteRefs.current[peer.userId];
      if (!ref) return;
      ref.position.set(roadCenter(peer.z, courseLevel) + peer.offset, 0.12, peer.z);
      ref.rotation.y = -roadHeading(peer.z, courseLevel);
    });

    ai.current.forEach((bot, i) => {
      const ref = aiRefs.current[i];
      if (!ref) return;
      ref.position.set(roadCenter(bot.z, courseLevel) + bot.offset, 0.12, bot.z);
      ref.rotation.y = -roadHeading(bot.z, courseLevel);
    });

    camera.position.x += (x * 0.35 - camera.position.x) * Math.min(1, dt * 3.8);
    camera.position.y += (5.0 - camera.position.y) * Math.min(1, dt * 4.0);
    camera.position.z += (s.z - 10.5 - camera.position.z) * Math.min(1, dt * 4.2);
    camera.lookAt(x, 0.7, s.z + 10);

    const now = clock.elapsedTime;
    if (now - s.lastSend > 0.09 && channelRef.current) {
      s.lastSend = now;
      void channelRef.current.send({
        type: "broadcast",
        event: "race_state",
        payload: { userId, z: s.z, offset: s.offset, speed: s.speed, carId, finished: false } satisfies RacerState,
      });
    }

    const allStates: RacerState[] = [
      { userId, z: s.z, offset: s.offset, speed: s.speed, carId },
      ...peers,
      ...ai.current,
    ];
    const sorted = [...allStates].sort((a, b) => b.z - a.z);
    const place = Math.max(1, sorted.findIndex((r) => r.userId === userId) + 1);
    onProgress(Math.min(1, s.z / TRACK_LENGTH), place, s.speed);

    if (s.z >= TRACK_LENGTH) {
      s.finished = true;
      void channelRef.current?.send({
        type: "broadcast",
        event: "race_state",
        payload: { userId, z: TRACK_LENGTH, offset: s.offset, speed: 0, carId, finished: true } satisfies RacerState,
      });
      drivingSfx.finish();
      onFinish(place);
    }
  });

  const humanOpponents = racers.filter((r) => r.userId !== userId);

  return (
    <>
      <ambientLight intensity={courseLevel >= 3 ? 0.85 : 1.25} />
      <directionalLight position={[10, 18, -8]} intensity={courseLevel === 4 ? 1.2 : 1.8} castShadow />
      <TrackWorld level={courseLevel} />

      <group ref={playerRef}>
        <ArcadeCar carId={carId} />
      </group>

      {humanOpponents.map((racer) => {
        const peer = remoteStates[racer.userId];
        return (
          <group
            key={racer.userId}
            ref={(node) => {
              remoteRefs.current[racer.userId] = node;
            }}
            position={[roadCenter(peer?.z ?? -6, courseLevel) + (peer?.offset ?? 0), 0.12, peer?.z ?? -6]}
          >
            <ArcadeCar carId={(peer?.carId || racer.carId) as DriveCarId} />
          </group>
        );
      })}

      {ai.current.map((bot, i) => (
        <group
          key={bot.userId}
          ref={(node) => {
            aiRefs.current[i] = node;
          }}
          position={[roadCenter(bot.z, courseLevel) + bot.offset, 0.12, bot.z]}
        >
          <ArcadeCar carId={bot.carId} />
        </group>
      ))}
    </>
  );
}

export default function DrivingRace({
  gameId,
  userId,
  courseLevel,
  carId,
  racers,
  muted,
  onToggleMute,
  onBack,
  onQuit,
  onFinish,
}: Props) {
  const [progress, setProgress] = useState(0);
  const [place, setPlace] = useState(1);
  const [speed, setSpeed] = useState(0);
  const course = courseAt(courseLevel);

  useEffect(() => {
    drivingSfx.startEngine();
    return () => drivingSfx.stopEngine();
  }, []);

  useEffect(() => {
    drivingSfx.updateEngine(Math.min(1, speed / 42));
  }, [speed]);

  return (
    <div className="relative h-full w-full touch-none select-none overflow-hidden bg-black">
      <Canvas shadows camera={{ position: [0, 5, -10], fov: 58 }}>
        <RaceScene
          gameId={gameId}
          userId={userId}
          courseLevel={courseLevel}
          carId={carId}
          racers={racers}
          onProgress={(p, rank, currentSpeed) => {
            setProgress(p);
            setPlace(rank);
            setSpeed(currentSpeed);
          }}
          onFinish={onFinish}
        />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="rounded-xl bg-black/65 px-3 py-2 text-white backdrop-blur">
          <p className="text-[9px] font-black uppercase tracking-wider text-white/55">Position</p>
          <p className="text-2xl font-black leading-none">{place}<span className="text-xs text-white/50">/4</span></p>
        </div>

        <div className="rounded-xl bg-black/65 px-4 py-2 text-center text-white backdrop-blur">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-cyan-200">Level {courseLevel} · {course.name}</p>
          <div className="mt-1 flex items-center justify-center gap-3 text-xs font-black">
            <span className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5" /> {Math.round(speed * 5.2)} MPH</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
        </div>

        <div className="pointer-events-auto">
          <GameMenu
            triggerClassName="flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur"
            actions={[
              { key: "mute", label: muted ? "Unmute" : "Mute", icon: muted ? VolumeX : Volume2, onClick: onToggleMute, active: muted },
              { key: "back", label: "Back to Games", icon: ArrowLeft, onClick: onBack },
              ...(onQuit ? [{ key: "quit", label: "Quit Race", icon: LogOut, onClick: () => confirmQuitGame(onQuit), destructive: true }] : []),
            ]}
          />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex justify-center">
        <div className="rounded-full bg-black/55 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white/75 backdrop-blur">
          Drag left/right to steer · Stay on the racing line
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-1 bg-white/10">
        <div className="absolute bottom-0 left-0 w-full bg-cyan-300" style={{ height: `${Math.round(progress * 100)}%` }} />
      </div>

      {progress >= 1 ? (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/20">
          <div className="rounded-2xl border border-white/20 bg-black/75 px-6 py-4 text-center text-white backdrop-blur">
            <Flag className="mx-auto h-7 w-7 text-cyan-200" />
            <p className="mt-2 text-2xl font-black">FINISH!</p>
            <p className="text-xs font-bold text-white/60">You placed #{place}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
