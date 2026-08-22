import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

/** Brief, timed one-off poses layered on top of the usual moving/airborne cycle — used by games
 *  (e.g. Neighborhood Adventure) that need more than "moving or not" out of this rig. Optional
 *  and additive: every existing caller that never passes `pose` keeps today's exact behavior. */
export type AvatarPose = "interact" | "pickup" | "wave" | "celebrate" | "stumble";

type Props = {
  /** Shirt / primary colour so each racer is instantly recognisable. */
  color: string;
  skin?: string;
  moving?: boolean;
  airborne?: boolean;
  /** Slightly transparent for other racers so they never block your view. */
  ghost?: boolean;
  /** Overrides the moving/airborne cycle for a brief scripted pose. Omit for existing behavior. */
  pose?: AvatarPose | null;
  /** Scales the walk-cycle stride frequency — a quick way to read "running" vs. "walking"
   *  without a separate animation state. Defaults to 1 (today's behavior) when omitted. */
  speedMul?: number;
};

/**
 * Chunky block-figure racer: cube head, boxy torso, swinging arms and legs.
 * Deliberately toy-like — the same visual language as classic obby avatars.
 */
export default function ObbyAvatar({ color, skin = "#FFCC4D", moving, airborne, ghost, pose, speedMul = 1 }: Props) {
  const lLeg = useRef<Group>(null);
  const rLeg = useRef<Group>(null);
  const lArm = useRef<Group>(null);
  const rArm = useRef<Group>(null);
  const body = useRef<Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    if (pose) {
      applyPose(pose, t, { lLeg: lLeg.current, rLeg: rLeg.current, lArm: lArm.current, rArm: rArm.current, body: body.current });
      return;
    }

    const swing = airborne ? 0.9 : moving ? Math.sin(t * 11 * speedMul) * 0.85 : Math.sin(t * 1.6) * 0.06;
    if (lLeg.current) lLeg.current.rotation.x = airborne ? -0.6 : swing;
    if (rLeg.current) rLeg.current.rotation.x = airborne ? 0.35 : -swing;
    if (lArm.current) lArm.current.rotation.x = airborne ? -2.3 : -swing;
    if (rArm.current) rArm.current.rotation.x = airborne ? -2.1 : swing;
    if (body.current) {
      body.current.position.y = airborne ? 0.06 : moving ? Math.abs(Math.sin(t * 11 * speedMul)) * 0.07 : 0;
      body.current.rotation.z = 0;
    }
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

function applyPose(
  pose: AvatarPose,
  t: number,
  limbs: { lLeg: Group | null; rLeg: Group | null; lArm: Group | null; rArm: Group | null; body: Group | null },
) {
  const { lLeg, rLeg, lArm, rArm, body } = limbs;
  let legX = 0;
  let bodyY = 0;
  let bodyZ = 0;
  let lArmX = -0.15;
  let rArmX = 0.15;

  switch (pose) {
    case "interact":
      // Lean in slightly, one arm reaching forward.
      rArmX = -1.5;
      legX = 0.08;
      break;
    case "pickup":
      // Crouch: both legs and arms fold forward and down.
      legX = 0.75;
      lArmX = -1.9;
      rArmX = -1.9;
      bodyY = -0.16;
      break;
    case "wave": {
      // One arm raised, waving side to side.
      const wave = Math.sin(t * 9) * 0.35;
      rArmX = -2.5 + wave;
      break;
    }
    case "celebrate": {
      // Both arms thrown up, a little hop.
      lArmX = -2.7;
      rArmX = -2.7;
      bodyY = Math.abs(Math.sin(t * 10)) * 0.14;
      break;
    }
    case "stumble": {
      // Off-balance: asymmetric legs, arms out, whole body wobbling.
      legX = 0.5;
      lArmX = 0.4;
      rArmX = -0.6;
      bodyZ = Math.sin(t * 16) * 0.18;
      break;
    }
  }

  if (lLeg) lLeg.rotation.x = legX;
  if (rLeg) rLeg.rotation.x = pose === "stumble" ? -legX * 0.6 : -legX;
  if (lArm) lArm.rotation.x = lArmX;
  if (rArm) rArm.rotation.x = rArmX;
  if (body) {
    body.position.y = bodyY;
    body.rotation.z = bodyZ;
  }
}
