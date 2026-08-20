import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

type Props = {
  /** Shirt / primary colour so each racer is instantly recognisable. */
  color: string;
  skin?: string;
  moving?: boolean;
  airborne?: boolean;
  /** Slightly transparent for other racers so they never block your view. */
  ghost?: boolean;
};

/**
 * Chunky block-figure racer: cube head, boxy torso, swinging arms and legs.
 * Deliberately toy-like — the same visual language as classic obby avatars.
 */
export default function ObbyAvatar({ color, skin = "#f2c396", moving, airborne, ghost }: Props) {
  const lLeg = useRef<Group>(null);
  const rLeg = useRef<Group>(null);
  const lArm = useRef<Group>(null);
  const rArm = useRef<Group>(null);
  const body = useRef<Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const swing = airborne ? 0.9 : moving ? Math.sin(t * 11) * 0.85 : Math.sin(t * 1.6) * 0.06;
    if (lLeg.current) lLeg.current.rotation.x = airborne ? -0.6 : swing;
    if (rLeg.current) rLeg.current.rotation.x = airborne ? 0.35 : -swing;
    if (lArm.current) lArm.current.rotation.x = airborne ? -2.3 : -swing;
    if (rArm.current) rArm.current.rotation.x = airborne ? -2.1 : swing;
    if (body.current) body.current.position.y = airborne ? 0.06 : moving ? Math.abs(Math.sin(t * 11)) * 0.07 : 0;
  });

  const mat = (c: string) => ({ color: c, transparent: ghost, opacity: ghost ? 0.55 : 1, roughness: 0.45 });

  return (
    <group ref={body}>
      {/* Head */}
      <mesh position={[0, 1.62, 0]} castShadow>
        <boxGeometry args={[0.72, 0.72, 0.72]} />
        <meshStandardMaterial {...mat(skin)} />
      </mesh>
      {/* Face */}
      <mesh position={[0.17, 1.68, 0.37]}>
        <boxGeometry args={[0.11, 0.13, 0.02]} />
        <meshStandardMaterial color="#241a12" transparent={ghost} opacity={ghost ? 0.6 : 1} />
      </mesh>
      <mesh position={[-0.17, 1.68, 0.37]}>
        <boxGeometry args={[0.11, 0.13, 0.02]} />
        <meshStandardMaterial color="#241a12" transparent={ghost} opacity={ghost ? 0.6 : 1} />
      </mesh>
      <mesh position={[0, 1.48, 0.37]}>
        <boxGeometry args={[0.26, 0.06, 0.02]} />
        <meshStandardMaterial color="#241a12" transparent={ghost} opacity={ghost ? 0.6 : 1} />
      </mesh>

      {/* Torso */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[0.78, 0.9, 0.44]} />
        <meshStandardMaterial {...mat(color)} />
      </mesh>

      {/* Arms */}
      <group ref={lArm} position={[0.55, 1.36, 0]}>
        <mesh position={[0, -0.36, 0]} castShadow>
          <boxGeometry args={[0.26, 0.82, 0.26]} />
          <meshStandardMaterial {...mat(skin)} />
        </mesh>
      </group>
      <group ref={rArm} position={[-0.55, 1.36, 0]}>
        <mesh position={[0, -0.36, 0]} castShadow>
          <boxGeometry args={[0.26, 0.82, 0.26]} />
          <meshStandardMaterial {...mat(skin)} />
        </mesh>
      </group>

      {/* Legs */}
      <group ref={lLeg} position={[0.2, 0.56, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.3, 0.62, 0.3]} />
          <meshStandardMaterial {...mat("#2c3350")} />
        </mesh>
      </group>
      <group ref={rLeg} position={[-0.2, 0.56, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.3, 0.62, 0.3]} />
          <meshStandardMaterial {...mat("#2c3350")} />
        </mesh>
      </group>
    </group>
  );
}
