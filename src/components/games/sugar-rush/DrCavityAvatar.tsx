import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

/** Dr. Cavity's mood, one per AI state — drives the block-figure's pose. Not a copy of any
 *  existing chaser: original silhouette (lab coat, dentist mirror, mustache), original
 *  animation set. */
export type CavityPose = "patrol" | "chase" | "confused" | "stunned" | "recover";

type Props = {
  pose: CavityPose;
  moving?: boolean;
};

/**
 * Dr. Cavity — a funny, original block-style dentist villain. Same voxel-figure
 * construction technique as ObbyAvatar (so the two read as part of the same visual
 * family) but a deliberately different silhouette: a white lab coat, a dentist's mirror
 * on a little arm, bushy eyebrows and a mustache. Not scary, not violent — a competitive
 * rival, not a threat.
 */
export default function DrCavityAvatar({ pose, moving }: Props) {
  const lLeg = useRef<Group>(null);
  const rLeg = useRef<Group>(null);
  const lArm = useRef<Group>(null);
  const rArm = useRef<Group>(null);
  const mirrorArm = useRef<Group>(null);
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const legs = { lLeg: lLeg.current, rLeg: rLeg.current, lArm: lArm.current, rArm: rArm.current, body: body.current, head: head.current };

    if (pose === "stunned") {
      if (legs.lLeg) legs.lLeg.rotation.x = 0;
      if (legs.rLeg) legs.rLeg.rotation.x = 0;
      if (legs.lArm) legs.lArm.rotation.x = -0.2;
      if (legs.rArm) legs.rArm.rotation.x = -0.2;
      if (legs.body) legs.body.rotation.z = Math.sin(t * 14) * 0.12;
      if (legs.head) legs.head.rotation.z = Math.sin(t * 14 + 0.4) * 0.18;
      if (mirrorArm.current) mirrorArm.current.rotation.x = -0.4;
      return;
    }

    if (pose === "confused") {
      const wobble = Math.sin(t * 3.5) * 0.3;
      if (legs.lLeg) legs.lLeg.rotation.x = Math.sin(t * 3) * 0.25;
      if (legs.rLeg) legs.rLeg.rotation.x = -Math.sin(t * 3) * 0.25;
      if (legs.lArm) legs.lArm.rotation.x = 0.3;
      if (legs.rArm) legs.rArm.rotation.x = 0.3;
      if (legs.head) legs.head.rotation.y = wobble;
      if (legs.body) legs.body.rotation.z = 0;
      if (mirrorArm.current) mirrorArm.current.rotation.x = -0.9 + Math.sin(t * 4) * 0.2;
      return;
    }

    if (pose === "recover") {
      if (legs.lLeg) legs.lLeg.rotation.x = 0;
      if (legs.rLeg) legs.rLeg.rotation.x = 0;
      if (legs.lArm) legs.lArm.rotation.x = -0.6 + Math.sin(t * 5) * 0.15;
      if (legs.rArm) legs.rArm.rotation.x = -0.6 - Math.sin(t * 5) * 0.15;
      if (legs.head) legs.head.rotation.z = 0.15;
      if (legs.body) legs.body.position.y = -0.06;
      if (mirrorArm.current) mirrorArm.current.rotation.x = -0.5;
      return;
    }

    const speedMul = pose === "chase" ? 1.5 : 1;
    const swing = moving ? Math.sin(t * 10 * speedMul) * 0.82 : Math.sin(t * 1.4) * 0.05;
    if (legs.lLeg) legs.lLeg.rotation.x = swing;
    if (legs.rLeg) legs.rLeg.rotation.x = -swing;
    if (legs.lArm) legs.lArm.rotation.x = -swing;
    if (legs.rArm) legs.rArm.rotation.x = swing;
    if (legs.body) {
      legs.body.position.y = moving ? Math.abs(Math.sin(t * 10 * speedMul)) * 0.07 : 0;
      legs.body.rotation.z = pose === "chase" ? 0.06 : 0;
    }
    if (legs.head) legs.head.rotation.z = 0;
    if (mirrorArm.current) mirrorArm.current.rotation.x = -0.35 + Math.sin(t * 6) * 0.06;
  });

  const mat = (c: string, emissive?: string) => ({ color: c, roughness: 0.5, emissive, emissiveIntensity: emissive ? 0.5 : 0 });

  return (
    <group ref={body}>
      <group ref={head}>
        {/* Head — pale, distinct from the player family's warm skin tones. */}
        <mesh position={[0, 1.66, 0]} castShadow>
          <boxGeometry args={[0.7, 0.68, 0.68]} />
          <meshStandardMaterial {...mat("#f1e3d3")} />
        </mesh>
        {/* Eyebrows */}
        <mesh position={[0.17, 1.86, 0.36]} rotation={[0, 0, -0.15]}>
          <boxGeometry args={[0.16, 0.045, 0.02]} />
          <meshStandardMaterial color="#3a2a1a" />
        </mesh>
        <mesh position={[-0.17, 1.86, 0.36]} rotation={[0, 0, 0.15]}>
          <boxGeometry args={[0.16, 0.045, 0.02]} />
          <meshStandardMaterial color="#3a2a1a" />
        </mesh>
        {/* Eyes */}
        <mesh position={[0.17, 1.72, 0.36]}>
          <boxGeometry args={[0.1, 0.11, 0.02]} />
          <meshStandardMaterial color="#241a12" />
        </mesh>
        <mesh position={[-0.17, 1.72, 0.36]}>
          <boxGeometry args={[0.1, 0.11, 0.02]} />
          <meshStandardMaterial color="#241a12" />
        </mesh>
        {/* Mustache */}
        <mesh position={[0, 1.58, 0.37]}>
          <boxGeometry args={[0.32, 0.075, 0.02]} />
          <meshStandardMaterial color="#4a3423" />
        </mesh>
        {/* Head mirror band */}
        <mesh position={[0, 1.98, 0.1]}>
          <boxGeometry args={[0.5, 0.05, 0.5]} />
          <meshStandardMaterial color="#dfe6ea" metalness={0.4} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.98, 0.36]}>
          <circleGeometry args={[0.09, 12]} />
          <meshStandardMaterial {...mat("#eaf7ff", "#bdeaff")} metalness={0.6} roughness={0.15} />
        </mesh>
      </group>

      {/* Lab coat torso */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[0.8, 0.92, 0.46]} />
        <meshStandardMaterial {...mat("#f4f6f8")} />
      </mesh>
      <mesh position={[0, 0.72, 0.24]}>
        <boxGeometry args={[0.1, 0.32, 0.02]} />
        <meshStandardMaterial color="#8fa0ac" />
      </mesh>

      {/* Arms (coat sleeves) */}
      <group ref={lArm} position={[0.56, 1.38, 0]}>
        <mesh position={[0, -0.36, 0]} castShadow>
          <boxGeometry args={[0.27, 0.82, 0.27]} />
          <meshStandardMaterial {...mat("#eef1f3")} />
        </mesh>
      </group>
      <group ref={rArm} position={[-0.56, 1.38, 0]}>
        <mesh position={[0, -0.36, 0]} castShadow>
          <boxGeometry args={[0.27, 0.82, 0.27]} />
          <meshStandardMaterial {...mat("#eef1f3")} />
        </mesh>
        {/* Dentist mirror-on-a-stick, held out */}
        <group ref={mirrorArm} position={[0, -0.1, 0.1]} rotation={[-0.4, 0, 0]}>
          <mesh position={[0, -0.3, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.5, 6]} />
            <meshStandardMaterial color="#c9d3d8" metalness={0.5} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.56, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.09, 14]} />
            <meshStandardMaterial color="#eaf7ff" metalness={0.7} roughness={0.15} emissive="#bdeaff" emissiveIntensity={0.3} />
          </mesh>
        </group>
      </group>

      {/* Legs */}
      <group ref={lLeg} position={[0.2, 0.56, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.3, 0.62, 0.3]} />
          <meshStandardMaterial {...mat("#3a3f52")} />
        </mesh>
      </group>
      <group ref={rLeg} position={[-0.2, 0.56, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.3, 0.62, 0.3]} />
          <meshStandardMaterial {...mat("#3a3f52")} />
        </mesh>
      </group>
    </group>
  );
}
