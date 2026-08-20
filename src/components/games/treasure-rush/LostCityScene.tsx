import { useMemo } from "react";
import { FLOOR, GRID, LEVEL, MAP_H, MAP_W, TILE, WALL_RUNS } from "@/lib/treasure-rush/map";
import type { Gate, Item, SwitchPad } from "@/lib/treasure-rush/engine";

/** MapManager renderer — static Lost City Market geometry plus the dynamic props. */

function floorColor(cell: string) {
  if (cell === "=") return "#7a5c3c";
  if (cell === "~") return "#2f6f8f";
  if (cell === "E") return "#3f8f6a";
  return null;
}

function Ground() {
  const tinted = useMemo(() => FLOOR.filter((f) => floorColor(GRID[f.row][f.col])), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[((MAP_W - 1) / 2) * TILE, 0, ((MAP_H - 1) / 2) * TILE]} receiveShadow>
        <planeGeometry args={[MAP_W * TILE, MAP_H * TILE]} />
        <meshStandardMaterial color="#c9a978" roughness={0.95} />
      </mesh>
      {tinted.map((f) => (
        <mesh key={`${f.col}-${f.row}`} rotation={[-Math.PI / 2, 0, 0]} position={[f.x, 0.02, f.z]}>
          <planeGeometry args={[TILE, TILE]} />
          <meshStandardMaterial color={floorColor(GRID[f.row][f.col]) as string} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Walls() {
  return (
    <group>
      {WALL_RUNS.map((r, i) => {
        const hue = 18 + ((i * 37) % 40);
        const h = 3 + ((i * 13) % 3);
        return (
          <mesh key={i} position={[r.x, h / 2, r.z]} castShadow receiveShadow>
            <boxGeometry args={[r.w, h, TILE]} />
            <meshStandardMaterial color={`hsl(${hue} 34% ${38 + ((i * 7) % 12)}%)`} roughness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}

function Stalls() {
  return (
    <group>
      {LEVEL.stalls.map((s, i) => (
        <group key={s.col + "-" + s.row} position={[s.x, 0, s.z]}>
          <mesh position={[0, 0.55, 0]} castShadow>
            <boxGeometry args={[TILE * 0.8, 1.1, TILE * 0.8]} />
            <meshStandardMaterial color="#8a5a3c" roughness={0.7} />
          </mesh>
          <mesh position={[0, 1.5, 0]} castShadow>
            <boxGeometry args={[TILE * 0.95, 0.28, TILE * 0.95]} />
            <meshStandardMaterial color={i % 2 ? "#e0574f" : "#2fb6a8"} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Trees() {
  return (
    <group>
      {LEVEL.trees.map((s) => (
        <group key={s.col + "-" + s.row} position={[s.x, 0, s.z]}>
          <mesh position={[0, 0.7, 0]} castShadow>
            <boxGeometry args={[0.44, 1.4, 0.44]} />
            <meshStandardMaterial color="#6b4526" />
          </mesh>
          <mesh position={[0, 2.1, 0]} castShadow>
            <boxGeometry args={[1.8, 1.6, 1.8]} />
            <meshStandardMaterial color="#3f9b5c" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Crates() {
  return (
    <group>
      {LEVEL.crates.map((s) => (
        <mesh key={s.col + "-" + s.row} position={[s.x, 0.7, s.z]} castShadow>
          <boxGeometry args={[TILE * 0.8, 1.4, TILE * 0.8]} />
          <meshStandardMaterial color="#a9793f" roughness={0.75} />
        </mesh>
      ))}
    </group>
  );
}

function Fountain() {
  const cells = LEVEL.fountains;
  if (!cells.length) return null;
  const cx = cells.reduce((a, c) => a + c.x, 0) / cells.length;
  const cz = cells.reduce((a, c) => a + c.z, 0) / cells.length;
  return (
    <group position={[cx, 0, cz]}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[TILE * 1.4, TILE * 1.5, 0.8, 20]} />
        <meshStandardMaterial color="#b9b3a3" />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[TILE * 1.2, TILE * 1.2, 0.16, 20]} />
        <meshStandardMaterial color="#37a7d8" transparent opacity={0.85} emissive="#1d6f96" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.45, 1.6, 12]} />
        <meshStandardMaterial color="#cfc8b6" />
      </mesh>
    </group>
  );
}

function Exit() {
  const { x, z } = LEVEL.exit;
  return (
    <group position={[x, 0, z]}>
      {[-1.3, 1.3].map((dx) => (
        <mesh key={dx} position={[dx, 1.6, 0]} castShadow>
          <boxGeometry args={[0.4, 3.2, 0.4]} />
          <meshStandardMaterial color="#6ee7c4" emissive="#2fae86" emissiveIntensity={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 3.3, 0]}>
        <boxGeometry args={[3.1, 0.4, 0.4]} />
        <meshStandardMaterial color="#a78bfa" emissive="#7c5cf5" emissiveIntensity={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <planeGeometry args={[TILE * 1.4, TILE * 1.4]} />
        <meshStandardMaterial color="#8ef0cd" emissive="#4fd6a5" emissiveIntensity={0.6} transparent opacity={0.75} />
      </mesh>
    </group>
  );
}

function Gates({ gates }: { gates: Gate[] }) {
  return (
    <group>
      {gates.map((g) =>
        g.open ? null : (
          <mesh key={g.id} position={[g.x, 1.3, g.z]} castShadow>
            <boxGeometry args={[TILE, 2.6, 0.5]} />
            <meshStandardMaterial
              color={g.kind === "blue" ? "#3b82f6" : "#f0b429"}
              emissive={g.kind === "blue" ? "#1d4ed8" : "#b57e08"}
              emissiveIntensity={0.5}
              metalness={0.35}
            />
          </mesh>
        ),
      )}
    </group>
  );
}

function Switches({ pads }: { pads: SwitchPad[] }) {
  return (
    <group>
      {pads.map((p) => (
        <group key={p.id} position={[p.x, 0, p.z]}>
          <mesh position={[0, 0.12, 0]} receiveShadow>
            <cylinderGeometry args={[0.9, 0.95, 0.24, 16]} />
            <meshStandardMaterial color="#4b3f6b" />
          </mesh>
          <mesh position={[0, p.on ? 0.2 : 0.34, 0]}>
            <cylinderGeometry args={[0.6, 0.6, 0.22, 16]} />
            <meshStandardMaterial
              color={p.on ? "#5ce6a8" : "#f0b429"}
              emissive={p.on ? "#2fae86" : "#b57e08"}
              emissiveIntensity={0.6}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Spikes({ spikes }: { spikes: { id: string; x: number; z: number; active: boolean }[] }) {
  return (
    <group>
      {spikes.map((sp) => (
        <group key={sp.id} position={[sp.x, 0, sp.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <planeGeometry args={[TILE, TILE]} />
            <meshStandardMaterial color="#5b4a3a" />
          </mesh>
          {[-0.6, 0, 0.6].map((dx) =>
            [-0.6, 0, 0.6].map((dz) => (
              <mesh key={`${dx}-${dz}`} position={[dx, sp.active ? 0.45 : 0.06, dz]}>
                <coneGeometry args={[0.16, sp.active ? 0.8 : 0.12, 6]} />
                <meshStandardMaterial color="#d8d4cc" metalness={0.6} roughness={0.3} />
              </mesh>
            )),
          )}
        </group>
      ))}
    </group>
  );
}

function Barrels({ barrels }: { barrels: { id: string; x: number; z: number }[] }) {
  return (
    <group>
      {barrels.map((b) => (
        <mesh key={b.id} position={[b.x, 0.6, b.z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.6, 0.6, 1.1, 14]} />
          <meshStandardMaterial color="#8b4a2b" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Treasure({ items }: { items: Item[] }) {
  return (
    <group>
      {items.map((i) => {
        if (i.taken && i.kind !== "chest" && i.kind !== "gold_chest") return null;
        if (i.kind === "coin") {
          return (
            <mesh key={i.id} position={[i.x, 0.85, i.z]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.32, 0.32, 0.1, 16]} />
              <meshStandardMaterial color="#ffd23f" emissive="#ffae00" emissiveIntensity={0.5} metalness={0.6} roughness={0.25} />
            </mesh>
          );
        }
        if (i.kind === "gem") {
          return (
            <mesh key={i.id} position={[i.x, 0.95, i.z]} rotation={[0, 0.6, 0]}>
              <octahedronGeometry args={[0.45]} />
              <meshStandardMaterial color="#5ce1ff" emissive="#2ba7d8" emissiveIntensity={0.7} metalness={0.4} roughness={0.15} />
            </mesh>
          );
        }
        if (i.kind === "chest" || i.kind === "gold_chest") {
          const gold = i.kind === "gold_chest";
          return (
            <group key={i.id} position={[i.x, 0, i.z]}>
              <mesh position={[0, 0.42, 0]} castShadow>
                <boxGeometry args={[1.4, 0.84, 1]} />
                <meshStandardMaterial color={gold ? "#e8b53c" : "#8a5a3c"} metalness={gold ? 0.6 : 0.1} roughness={0.5} />
              </mesh>
              <mesh position={[0, i.open ? 1.05 : 0.92, i.open ? -0.5 : 0]} rotation={[i.open ? -1.15 : 0, 0, 0]} castShadow>
                <boxGeometry args={[1.44, 0.24, 1.04]} />
                <meshStandardMaterial color={gold ? "#f7d372" : "#a9793f"} metalness={gold ? 0.6 : 0.1} />
              </mesh>
              {i.open && (
                <mesh position={[0, 0.95, 0]}>
                  <sphereGeometry args={[0.34, 12, 12]} />
                  <meshStandardMaterial color="#ffe58a" emissive="#ffc93c" emissiveIntensity={0.9} />
                </mesh>
              )}
            </group>
          );
        }
        if (i.kind === "blue_key" || i.kind === "gold_key") {
          const blue = i.kind === "blue_key";
          return (
            <group key={i.id} position={[i.x, 0.95, i.z]}>
              <mesh>
                <torusGeometry args={[0.26, 0.09, 8, 16]} />
                <meshStandardMaterial
                  color={blue ? "#4d9bff" : "#f5c542"}
                  emissive={blue ? "#1d4ed8" : "#b57e08"}
                  emissiveIntensity={0.7}
                  metalness={0.7}
                />
              </mesh>
              <mesh position={[0, -0.45, 0]}>
                <boxGeometry args={[0.12, 0.6, 0.12]} />
                <meshStandardMaterial color={blue ? "#4d9bff" : "#f5c542"} metalness={0.7} />
              </mesh>
            </group>
          );
        }
        const tint = i.kind === "magnet" ? "#ff6ba8" : i.kind === "boost" ? "#ffd84d" : "#37c8ff";
        return (
          <mesh key={i.id} position={[i.x, 1, i.z]} rotation={[0.4, 0.6, 0]}>
            <boxGeometry args={[0.8, 0.8, 0.8]} />
            <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.7} transparent opacity={0.92} />
          </mesh>
        );
      })}
    </group>
  );
}

export default function LostCityScene({
  items,
  gates,
  pads,
  spikes,
  barrels,
}: {
  items: Item[];
  gates: Gate[];
  pads: SwitchPad[];
  spikes: { id: string; x: number; z: number; active: boolean }[];
  barrels: { id: string; x: number; z: number }[];
}) {
  return (
    <group>
      <Ground />
      <Walls />
      <Stalls />
      <Trees />
      <Crates />
      <Fountain />
      <Exit />
      <Gates gates={gates} />
      <Switches pads={pads} />
      <Spikes spikes={spikes} />
      <Barrels barrels={barrels} />
      <Treasure items={items} />
    </group>
  );
}
