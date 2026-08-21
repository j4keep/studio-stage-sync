import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useState } from "react";
import type { Group } from "three";
import ObbyAvatar, { AvatarPose } from "@/components/games/obby/ObbyAvatar";
import { BASE_SPEED, NeighborhoodState } from "@/lib/neighborhood/engine";
import type { Camera } from "./render";

type Props = {
  stateRef: React.MutableRefObject<NeighborhoodState>;
  cameraRef: React.MutableRefObject<Camera | undefined>;
};

const SQUASH = 0.78;

/** The player, driven straight off `stateRef` — position/facing are set imperatively every
 *  frame (cheap), while `moving`/`pose`/`speedMul` are pushed into real React state only when
 *  they actually change, so ObbyAvatar's own animation re-renders with fresh props. Same split
 *  Survival Island's single-actor overlay uses (src/components/games/survival-island/SurvivalIslandAvatar.tsx). */
function PlayerActor({ stateRef, cameraRef }: Props) {
  const group = useRef<Group>(null);
  const { size } = useThree();
  const [moving, setMoving] = useState(false);
  const [pose, setPose] = useState<AvatarPose | null>(null);
  const [speedMul, setSpeedMul] = useState(1);
  const movingRef = useRef(false);
  const poseRef = useRef<AvatarPose | null>(null);

  useFrame(() => {
    const g = group.current;
    const camera = cameraRef.current;
    const st = stateRef.current;
    if (!g || !camera) return;

    const screenX = (st.x - camera.x) * camera.scale;
    const screenY = (st.y - camera.y) * camera.scale * SQUASH;
    g.position.set(screenX - size.width / 2, size.height / 2 - screenY, 0);
    g.rotation.y = st.facing > 0 ? 0 : Math.PI;

    const isMoving = !st.pose && Math.hypot(st.vx, st.vy) > 12;
    if (isMoving !== movingRef.current) {
      movingRef.current = isMoving;
      setMoving(isMoving);
    }
    if (st.pose !== poseRef.current) {
      poseRef.current = st.pose;
      setPose(st.pose);
    }
    setSpeedMul(Math.max(0.75, Math.min(1.6, Math.hypot(st.vx, st.vy) / BASE_SPEED + 0.55)));
  });

  return (
    <group ref={group} scale={34}>
      <ObbyAvatar color="#6B3FA0" moving={moving} pose={pose ?? undefined} speedMul={speedMul} />
    </group>
  );
}

/** One NPC — same imperative-position / state-for-animation split as the player, minus poses
 *  (NPCs only ever stand or walk their patrol route). */
function NpcActor({ stateRef, cameraRef, index, color }: Props & { index: number; color: string }) {
  const group = useRef<Group>(null);
  const { size } = useThree();
  const [moving, setMoving] = useState(false);
  const movingRef = useRef(false);

  useFrame(() => {
    const g = group.current;
    const camera = cameraRef.current;
    const st = stateRef.current;
    const npc = st.npcs[index];
    if (!g || !camera || !npc) return;

    const screenX = (npc.x - camera.x) * camera.scale;
    const screenY = (npc.y - camera.y) * camera.scale * SQUASH;
    g.position.set(screenX - size.width / 2, size.height / 2 - screenY, 0);
    g.rotation.y = npc.facing > 0 ? 0 : Math.PI;

    if (npc.moving !== movingRef.current) {
      movingRef.current = npc.moving;
      setMoving(npc.moving);
    }
  });

  return (
    <group ref={group} scale={34}>
      <ObbyAvatar color={color} moving={moving} />
    </group>
  );
}

export default function NeighborhoodAvatars({ stateRef, cameraRef }: Props) {
  const npcs = stateRef.current.npcs;
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <Canvas
        orthographic
        dpr={[1, 1.6]}
        camera={{ position: [0, 0, 100], zoom: 1 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={1.9} />
        <directionalLight position={[-5, 8, 10]} intensity={1.4} />

        <PlayerActor stateRef={stateRef} cameraRef={cameraRef} />
        {npcs.map((npc, i) => (
          <NpcActor key={npc.spec.id} stateRef={stateRef} cameraRef={cameraRef} index={i} color={npc.spec.color} />
        ))}
      </Canvas>
    </div>
  );
}
