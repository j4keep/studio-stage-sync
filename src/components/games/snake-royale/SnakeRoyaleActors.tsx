import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useState } from "react";
import type { Group } from "three";
import ObbyAvatar from "@/components/games/obby/ObbyAvatar";
import { useCharacterAppearance } from "@/contexts/CharacterAppearanceContext";
import type { SnakeRoyaleState } from "@/lib/snake-royale/engine";
import type { SnakeHazard } from "@/lib/snake-royale/hazards";
import type { Camera } from "./render";
import SnakeAvatar from "./SnakeAvatar";

type Props = {
  stateRef: React.MutableRefObject<SnakeRoyaleState>;
  cameraRef: React.MutableRefObject<Camera | undefined>;
  /** Current snake ids to mount — kept in sync by the stage each frame via setState so
   *  React (not the render loop) handles mount/unmount as dens spawn and retire snakes. */
  snakeIds: number[];
};

const SQUASH = 0.78;

function Player({ stateRef, cameraRef }: Pick<Props, "stateRef" | "cameraRef">) {
  const group = useRef<Group>(null);
  const { size } = useThree();
  const { skinTone } = useCharacterAppearance();
  const [moving, setMoving] = useState(false);
  const movingRef = useRef(false);

  useFrame(() => {
    const groupNode = group.current;
    const camera = cameraRef.current;
    if (!groupNode || !camera) return;

    const state = stateRef.current;
    const screenX = (state.x - camera.x) * camera.scale;
    const screenY = (state.y - camera.y) * camera.scale * SQUASH;

    groupNode.position.set(screenX - size.width / 2, size.height / 2 - screenY, 0);
    groupNode.rotation.y = Math.atan2(state.vx, state.vy);
    groupNode.visible = !(state.invuln > 0 && Math.floor(state.t * 14) % 2 === 0);

    const isMoving = Math.hypot(state.vx, state.vy) > 10;
    if (isMoving !== movingRef.current) {
      movingRef.current = isMoving;
      setMoving(isMoving);
    }
  });

  return (
    <group ref={group} scale={36}>
      <ObbyAvatar color="#5b8cff" skin={skinTone} moving={moving} airborne={false} />
    </group>
  );
}

function SnakeSlot({
  sn,
  snakesRef,
  cameraRef,
}: {
  sn: SnakeHazard;
  snakesRef: React.MutableRefObject<SnakeHazard[]>;
  cameraRef: React.MutableRefObject<Camera | undefined>;
}) {
  const group = useRef<Group>(null);
  const { size } = useThree();

  useFrame(() => {
    const groupNode = group.current;
    const camera = cameraRef.current;
    const current = snakesRef.current.find((s) => s.id === sn.id);
    if (!groupNode || !camera || !current) {
      if (groupNode) groupNode.visible = false;
      return;
    }
    groupNode.visible = true;
    const screenX = (current.x - camera.x) * camera.scale;
    const screenY = (current.y - camera.y) * camera.scale * SQUASH;
    groupNode.position.set(screenX - size.width / 2, size.height / 2 - screenY, 0);
  });

  return (
    <group ref={group}>
      <SnakeAvatar id={sn.id} snakesRef={snakesRef} />
    </group>
  );
}

export default function SnakeRoyaleActors({ stateRef, cameraRef, snakeIds }: Props) {
  const snakesRef = useRef<SnakeHazard[]>(stateRef.current.snakes);
  snakesRef.current = stateRef.current.snakes;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <Canvas
        orthographic
        dpr={[1, 1.6]}
        camera={{ position: [0, 0, 100], zoom: 1 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={1.8} />
        <directionalLight position={[-5, 8, 10]} intensity={1.5} />
        <Player stateRef={stateRef} cameraRef={cameraRef} />
        {snakeIds.map((id) => {
          const sn = stateRef.current.snakes.find((s) => s.id === id);
          if (!sn) return null;
          return <SnakeSlot key={id} sn={sn} snakesRef={snakesRef} cameraRef={cameraRef} />;
        })}
      </Canvas>
    </div>
  );
}
