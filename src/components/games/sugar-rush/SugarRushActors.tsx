import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useState } from "react";
import type { Group } from "three";
import ObbyAvatar from "@/components/games/obby/ObbyAvatar";
import DrCavityAvatar, { CavityPose } from "@/components/games/sugar-rush/DrCavityAvatar";
import { useCharacterAppearance } from "@/contexts/CharacterAppearanceContext";
import { SugarRushMazeState, cavityWorldPos, playerWorldPos } from "@/lib/sugar-rush-maze";
import { Camera } from "./maze-render";

type Props = {
  stateRef: React.MutableRefObject<SugarRushMazeState>;
  camRef: React.MutableRefObject<Camera | undefined>;
};

/**
 * Keep actors visually INSIDE one maze lane.
 * Both voxel models are about 2 world-units tall and are authored from their feet upward,
 * so we center the model around the cell and size it from the current on-screen cell size.
 */
const ACTOR_CELL_HEIGHT = 0.50;
const MODEL_CENTER_Y = -1.02;
const MIN_SCALE = 8;
const MAX_SCALE = 22;

function actorScale(st: SugarRushMazeState, cam: Camera) {
  const cellPx = st.map.cellSize * cam.scale;
  // model height is ~2.05 units, so this yields ~50% of one visible maze cell.
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, (cellPx * ACTOR_CELL_HEIGHT) / 2.05));
}

function cavityPoseFor(mode: SugarRushMazeState["cavity"]["mode"]): CavityPose {
  if (mode === "chase") return "chase";
  if (mode === "search") return "confused";
  if (mode === "retreat") return "confused";
  if (mode === "stunned") return "stunned";
  if (mode === "recover") return "recover";
  return "patrol";
}

function PlayerActor({ stateRef, camRef }: Props) {
  const group = useRef<Group>(null);
  const { skinTone } = useCharacterAppearance();
  const [moving, setMoving] = useState(false);
  const movingRef = useRef(false);

  useFrame(() => {
    const g = group.current;
    const cam = camRef.current;
    if (!g || !cam) return;
    const st = stateRef.current;
    const pos = playerWorldPos(st);
    const relX = (pos.x - cam.x) * cam.scale;
    const relY = (pos.y - cam.y) * cam.scale;
    g.position.set(relX, -relY, 0);
    g.scale.setScalar(actorScale(st, cam));

    const heading = st.player.heading;
    if (heading === "e") g.rotation.y = Math.PI / 2;
    else if (heading === "w") g.rotation.y = -Math.PI / 2;
    else if (heading === "s") g.rotation.y = Math.PI;
    else if (heading === "n") g.rotation.y = 0;
    g.visible = st.invuln <= 0 || Math.floor(st.t * 14) % 2 === 0;

    const isMoving = heading !== null;
    if (isMoving !== movingRef.current) {
      movingRef.current = isMoving;
      setMoving(isMoving);
    }
  });

  return (
    <group ref={group}>
      <group position={[0, MODEL_CENTER_Y, 0]}>
        <ObbyAvatar color="#5b8cff" skin={skinTone} moving={moving} />
      </group>
    </group>
  );
}

function CavityActor({ stateRef, camRef }: Props) {
  const group = useRef<Group>(null);
  const [pose, setPose] = useState<CavityPose>("patrol");
  const [moving, setMoving] = useState(false);
  const poseRef = useRef<CavityPose>("patrol");
  const movingRef = useRef(false);

  useFrame(() => {
    const g = group.current;
    const cam = camRef.current;
    if (!g || !cam) return;
    const st = stateRef.current;
    const pos = cavityWorldPos(st);
    const relX = (pos.x - cam.x) * cam.scale;
    const relY = (pos.y - cam.y) * cam.scale;
    g.position.set(relX, -relY, 0);
    g.scale.setScalar(actorScale(st, cam));

    const heading = st.cavity.heading;
    if (heading === "e") g.rotation.y = Math.PI / 2;
    else if (heading === "w") g.rotation.y = -Math.PI / 2;
    else if (heading === "s") g.rotation.y = Math.PI;
    else if (heading === "n") g.rotation.y = 0;

    const nextPose = cavityPoseFor(st.cavity.mode);
    if (nextPose !== poseRef.current) {
      poseRef.current = nextPose;
      setPose(nextPose);
    }
    const isMoving = heading !== null;
    if (isMoving !== movingRef.current) {
      movingRef.current = isMoving;
      setMoving(isMoving);
    }
  });

  return (
    <group ref={group}>
      <group position={[0, MODEL_CENTER_Y, 0]}>
        <DrCavityAvatar pose={pose} moving={moving} />
      </group>
    </group>
  );
}

/** 3D actor overlay above the 2D maze. Actor sizing is tied to maze-cell size so it stays
 * inside corridors in portrait, landscape and browser-preview layouts. */
export default function SugarRushActors(props: Props) {
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
        <PlayerActor {...props} />
        <CavityActor {...props} />
      </Canvas>
    </div>
  );
}
