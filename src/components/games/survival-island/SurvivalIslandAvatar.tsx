import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import ObbyAvatar from "@/components/games/obby/ObbyAvatar";
import { ELEVATION, TILE, idx } from "@/lib/survival-island/map";
import type { IslandState } from "@/lib/survival-island/engine";
import type { Camera } from "./render";

type Props = {
  stateRef: React.MutableRefObject<IslandState>;
  cameraRef: React.MutableRefObject<Camera | undefined>;
};

const SQUASH = 0.74;
const LIFT = 7;

function Avatar({ stateRef, cameraRef }: Props) {
  const group = useRef<Group>(null);
  const { size } = useThree();

  useFrame(() => {
    const groupNode = group.current;
    const camera = cameraRef.current;
    if (!groupNode || !camera) return;

    const state = stateRef.current;
    const tx = Math.max(0, Math.min(state.map.width - 1, Math.floor(state.x / TILE)));
    const ty = Math.max(0, Math.min(state.map.height - 1, Math.floor(state.y / TILE)));
    const terrain = state.map.tiles[idx(tx, ty)] ?? "sand";
    const elevation = ELEVATION[terrain];
    const screenX = (state.x - camera.x) * camera.scale;
    const screenY = (state.y - camera.y) * camera.scale * SQUASH - elevation * LIFT * camera.scale;

    groupNode.position.set(screenX - size.width / 2, size.height / 2 - screenY, 0);
    groupNode.rotation.y = Math.atan2(state.vx, state.vy);
    groupNode.visible = !(state.invuln > 0 && Math.floor(state.t * 14) % 2 === 0);
  });

  const state = stateRef.current;
  const moving = Math.hypot(state.vx, state.vy) > 10;

  return (
    <group ref={group} scale={31}>
      <ObbyAvatar color="#5b8cff" moving={moving} airborne={false} />
    </group>
  );
}

export default function SurvivalIslandAvatar(props: Props) {
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
        <Avatar {...props} />
      </Canvas>
    </div>
  );
}