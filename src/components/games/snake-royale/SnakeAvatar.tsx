import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import type { SnakeHazard } from "@/lib/snake-royale/hazards";
import { EMERGE_DURATION, RETREAT_DURATION, STRIKE_LUNGE, STRIKE_WINDUP } from "@/lib/snake-royale/hazards";

type Props = {
  /** Looks up its own hazard object by id each frame — snakes are spawned/removed
   *  dynamically, so this can't hold a stable prop reference like the player rig does. */
  id: number;
  snakesRef: React.MutableRefObject<SnakeHazard[]>;
};

const SEGMENTS = 4;
const BODY_COLOR = "#3f8b3a";
const BELLY_COLOR = "#d9c26a";

/**
 * Chunky block-figure snake: a boxy head with glowing eyes and a chain of tapering
 * body segments. Original silhouette, same construction technique as ObbyAvatar (box
 * geometry, no recolor of the player rig) — coils back before it strikes, stretches
 * flat and fast on the lunge, and sinks back into its den on retreat.
 */
export default function SnakeAvatar({ id, snakesRef }: Props) {
  const root = useRef<Group>(null);
  const head = useRef<Group>(null);
  const segRefs = useRef<(Group | null)[]>([]);
  const eyeGlow = useRef<[any, any]>([null, null]);

  useFrame(({ clock }) => {
    const sn = snakesRef.current.find((s) => s.id === id);
    const g = root.current;
    if (!sn || !g) {
      if (g) g.visible = false;
      return;
    }
    g.visible = true;
    const t = clock.elapsedTime;

    let scale = 1;
    let stretch = 1;
    let coil = 0;
    if (sn.state === "emerging") {
      scale = Math.min(1, sn.t / EMERGE_DURATION);
    } else if (sn.state === "striking") {
      if (sn.t < STRIKE_WINDUP) {
        coil = sn.t / STRIKE_WINDUP;
      } else if (sn.t < STRIKE_WINDUP + STRIKE_LUNGE) {
        stretch = 1.6;
      }
    } else if (sn.state === "retreating") {
      scale = Math.max(0.15, 1 - sn.t / (RETREAT_DURATION * 3));
    }

    g.rotation.y = -sn.angle + Math.PI / 2;
    g.scale.setScalar(scale);

    const headNode = head.current;
    if (headNode) {
      headNode.position.z = 0.55 * stretch - coil * 0.35;
      headNode.position.y = 0.32 + Math.sin(t * 10) * 0.02;
    }
    const glow = 0.4 + Math.abs(Math.sin(t * 6)) * 0.6;
    for (const e of eyeGlow.current) {
      if (e) e.intensity = glow;
    }

    segRefs.current.forEach((seg, i) => {
      if (!seg) return;
      const wave = Math.sin(t * 9 - i * 1.1) * (sn.state === "active" ? 0.28 : 0.12);
      seg.rotation.y = wave;
      seg.position.z = (0.2 + i * 0.32) * stretch - coil * 0.18 * (i + 1);
    });
  });

  return (
    <group ref={root} scale={30}>
      <group ref={head} position={[0, 0.32, 0.55]}>
        <mesh castShadow>
          <boxGeometry args={[0.4, 0.34, 0.44]} />
          <meshStandardMaterial color={BODY_COLOR} roughness={0.5} />
        </mesh>
        <mesh position={[0.12, 0.04, 0.24]}>
          <boxGeometry args={[0.09, 0.09, 0.02]} />
          <meshStandardMaterial color="#ffe15a" emissive="#ffb020" emissiveIntensity={0.6} ref={(m) => (eyeGlow.current[0] = m as any)} />
        </mesh>
        <mesh position={[-0.12, 0.04, 0.24]}>
          <boxGeometry args={[0.09, 0.09, 0.02]} />
          <meshStandardMaterial color="#ffe15a" emissive="#ffb020" emissiveIntensity={0.6} ref={(m) => (eyeGlow.current[1] = m as any)} />
        </mesh>
        <mesh position={[0, 0, 0.5]}>
          <boxGeometry args={[0.16, 0.05, 0.14]} />
          <meshStandardMaterial color="#c0392b" roughness={0.6} />
        </mesh>
      </group>

      {Array.from({ length: SEGMENTS }).map((_, i) => {
        const size = 0.34 - i * 0.045;
        return (
          <group key={i} ref={(el) => (segRefs.current[i] = el)} position={[0, 0.28 - i * 0.01, 0.2 + i * 0.32]}>
            <mesh castShadow>
              <boxGeometry args={[size, size * 0.85, size * 1.15]} />
              <meshStandardMaterial color={i % 2 === 0 ? BODY_COLOR : "#357833"} roughness={0.5} />
            </mesh>
            <mesh position={[0, -size * 0.32, 0]}>
              <boxGeometry args={[size * 0.7, size * 0.16, size * 0.9]} />
              <meshStandardMaterial color={BELLY_COLOR} roughness={0.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
