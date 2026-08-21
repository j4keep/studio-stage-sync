/**
 * YAJ Neighborhood Adventure — the exploration engine.
 *
 * Movement/collision follows the same shape as Survival Island's engine (axis-separated
 * slide + circular prop collision), minus the elevation/water system — nothing here is
 * "unwalkable terrain", only solid props block you, plus the world edge.
 *
 * Player "animation" only needs to track transient one-off poses (interact / pick up / wave /
 * celebrate / stumble) — idle vs. walk vs. run all fall naturally out of ObbyAvatar's existing
 * `moving` + a `speedMul` derived from current speed, so there's no separate state machine for
 * those three.
 */

import { NeighborhoodMapData, buildNeighborhood, locationAt, LocationId, TILE, GRID_W, WORLD_W, WORLD_H, idx } from "./map";
import { NPCS, NpcSpec, npcById } from "./npcs";
import { MISSIONS, MissionsState, MissionSpec, initialMissionsState, missionById } from "./missions";

export const PLAYER_R = 15;
export const BASE_SPEED = 190;
const ACCEL = 12;
export const INTERACT_R = 62;
export const STAR_R = 26;
export const DISCOVERY_R = 46;
const NPC_AWARE_R = 150;

export type PlayerPose = "interact" | "pickup" | "wave" | "celebrate" | "stumble" | null;

const POSE_DURATION: Record<Exclude<PlayerPose, null>, number> = {
  interact: 0.6,
  pickup: 0.7,
  wave: 0.9,
  celebrate: 1.1,
  stumble: 0.5,
};

export type NInput = { mx: number; my: number };
export const NO_INPUT: NInput = { mx: 0, my: 0 };

export type NpcRuntime = {
  spec: NpcSpec;
  x: number;
  y: number;
  /** Heading in radians (Math.atan2(dx, dy)) — the character rotates to actually face this
   *  direction, not just mirror left/right, so turning reads like a real person walking. */
  facing: number;
  targetIdx: 0 | 1;
  waitT: number;
  moving: boolean;
};

export type Interactable =
  | { kind: "npc"; npc: NpcRuntime }
  | { kind: "pickup"; mission: MissionSpec }
  | { kind: "location"; locationId: LocationId; name: string };

export type NeighborhoodEvent =
  | "mission_accepted"
  | "mission_completed"
  | "star"
  | "item_pickup"
  | "npc_interact"
  | "discovery"
  | "completion"
  | "stumble";

export type DialogueContent =
  | { kind: "greeting"; npc: NpcSpec; line: string }
  | { kind: "offer"; npc: NpcSpec; mission: MissionSpec; line: string }
  | { kind: "reminder"; npc: NpcSpec; mission: MissionSpec; line: string }
  | { kind: "delivered"; npc: NpcSpec; mission: MissionSpec; line: string };

export type NeighborhoodState = {
  map: NeighborhoodMapData;
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Heading in radians (Math.atan2(vx, vy)) — same full-rotation convention as Survival
   *  Island's avatar, so walking any direction actually turns the character to face it. */
  facing: number;
  pose: PlayerPose;
  poseT: number;
  npcs: NpcRuntime[];
  missions: MissionsState;
  carrying: string[];
  starsCollected: boolean[];
  discoveriesFound: Set<string>;
  visited: Set<number>;
  currentLocation: LocationId | null;
  dialogue: DialogueContent | null;
  openLocation: LocationId | null;
  events: NeighborhoodEvent[];
  toast: { text: string; t: number } | null;
};

export function initialNeighborhood(): NeighborhoodState {
  const map = buildNeighborhood();
  const npcs: NpcRuntime[] = NPCS.map((spec) => ({
    spec,
    x: spec.route[0].x,
    y: spec.route[0].y,
    facing: 0,
    targetIdx: 1,
    waitT: 0,
    moving: true,
  }));
  return {
    map,
    t: 0,
    x: map.spawn.x,
    y: map.spawn.y,
    vx: 0,
    vy: 0,
    facing: 0,
    pose: null,
    poseT: 0,
    npcs,
    missions: initialMissionsState(),
    carrying: [],
    starsCollected: new Array(map.starSpots.length).fill(false),
    discoveriesFound: new Set(),
    visited: new Set(),
    currentLocation: null,
    dialogue: null,
    openLocation: null,
    events: [],
    toast: null,
  };
}

function blocked(st: NeighborhoodState, x: number, y: number) {
  for (const p of st.map.props) {
    if (p.solid <= 0) continue;
    if (Math.hypot(x - p.x, y - p.y) < p.solid * 0.8 + PLAYER_R * 0.55) return true;
  }
  return false;
}

function slide(st: NeighborhoodState, dx: number, dy: number) {
  const nx = st.x + dx;
  const ny = st.y + dy;
  if (!blocked(st, nx, ny)) {
    st.x = Math.max(PLAYER_R, Math.min(WORLD_W - PLAYER_R, nx));
    st.y = Math.max(PLAYER_R, Math.min(WORLD_H - PLAYER_R, ny));
    return false;
  }
  if (dx) st.vx *= 0.2;
  if (dy) st.vy *= 0.2;
  return true;
}

function movePlayer(st: NeighborhoodState, input: NInput, dt: number) {
  const mag = Math.hypot(input.mx, input.my);
  let tx = 0;
  let ty = 0;
  if (mag > 0.08) {
    const n = Math.min(1, mag);
    tx = (input.mx / mag) * n * BASE_SPEED;
    ty = (input.my / mag) * n * BASE_SPEED;
  }
  st.vx += (tx - st.vx) * Math.min(1, ACCEL * dt);
  st.vy += (ty - st.vy) * Math.min(1, ACCEL * dt);
  if (Math.hypot(st.vx, st.vy) > 6) st.facing = Math.atan2(st.vx, st.vy);

  const blockedX = slide(st, st.vx * dt, 0);
  const blockedY = slide(st, 0, st.vy * dt);
  if ((blockedX || blockedY) && Math.hypot(st.vx, st.vy) > 90 && st.pose === null) {
    st.pose = "stumble";
    st.poseT = POSE_DURATION.stumble;
    st.events.push("stumble");
  }
}

function tickNpcs(st: NeighborhoodState, dt: number) {
  for (const npc of st.npcs) {
    const [a, b] = npc.spec.route;
    const target = npc.targetIdx === 0 ? a : b;

    if (npc.waitT > 0) {
      npc.waitT = Math.max(0, npc.waitT - dt);
      npc.moving = false;
    } else {
      const dx = target.x - npc.x;
      const dy = target.y - npc.y;
      const d = Math.hypot(dx, dy);
      if (d < 4) {
        npc.waitT = npc.spec.pauseS;
        npc.targetIdx = npc.targetIdx === 0 ? 1 : 0;
        npc.moving = false;
      } else {
        const step = Math.min(d, npc.spec.speed * dt);
        npc.x += (dx / d) * step;
        npc.y += (dy / d) * step;
        npc.moving = true;
      }
    }

    const distToPlayer = Math.hypot(st.x - npc.x, st.y - npc.y);
    if (distToPlayer < NPC_AWARE_R) {
      npc.facing = Math.atan2(st.x - npc.x, st.y - npc.y);
    } else if (npc.moving) {
      npc.facing = Math.atan2(target.x - npc.x, target.y - npc.y);
    }
  }
}

function markVisited(st: NeighborhoodState) {
  const tx = Math.max(0, Math.min(GRID_W - 1, Math.floor(st.x / TILE)));
  const ty = Math.floor(st.y / TILE);
  st.visited.add(idx(tx, ty));
  st.currentLocation = locationAt(st.map, st.x, st.y)?.id ?? null;
}

function tickPickups(st: NeighborhoodState) {
  st.map.starSpots.forEach((s, i) => {
    if (st.starsCollected[i]) return;
    if (Math.hypot(st.x - s.x, st.y - s.y) < STAR_R) {
      st.starsCollected[i] = true;
      st.pose = "pickup";
      st.poseT = POSE_DURATION.pickup;
      st.events.push("star");
      st.toast = { text: "YAJ Star found!", t: 2 };
      if (st.missions.neighborhood_stars.status === "active" && st.starsCollected.every(Boolean)) {
        st.missions.neighborhood_stars = { status: "complete", itemPicked: true };
        st.events.push("mission_completed");
      }
    }
  });

  st.map.discoverySpots.forEach((d) => {
    if (st.discoveriesFound.has(d.id)) return;
    if (Math.hypot(st.x - d.x, st.y - d.y) < DISCOVERY_R) {
      st.discoveriesFound.add(d.id);
      st.pose = "celebrate";
      st.poseT = POSE_DURATION.celebrate;
      st.events.push("discovery");
      st.toast = { text: `Discovered: ${d.label}`, t: 2.4 };
    }
  });
}

export function step(prev: NeighborhoodState, input: NInput, dtMs: number): NeighborhoodState {
  const st: NeighborhoodState = {
    ...prev,
    npcs: prev.npcs.map((n) => ({ ...n })),
    missions: { ...prev.missions },
    starsCollected: [...prev.starsCollected],
    discoveriesFound: new Set(prev.discoveriesFound),
    visited: new Set(prev.visited),
    events: [],
  };
  const dt = Math.min(0.08, dtMs / 1000);
  st.t += dt;

  if (st.poseT > 0) {
    st.poseT = Math.max(0, st.poseT - dt);
    if (st.poseT === 0) st.pose = null;
  }

  if (st.dialogue === null && st.openLocation === null) {
    movePlayer(st, input, dt);
  } else {
    st.vx = 0;
    st.vy = 0;
  }
  tickNpcs(st, dt);
  markVisited(st);
  if (st.dialogue === null && st.openLocation === null) tickPickups(st);

  if (st.toast && st.toast.t > 0) {
    st.toast = { ...st.toast, t: st.toast.t - dt };
    if (st.toast.t <= 0) st.toast = null;
  }

  return st;
}

/** Nearest thing the player can tap INTERACT/TALK on right now, if any. */
export function nearestInteractable(st: NeighborhoodState): Interactable | null {
  let best: Interactable | null = null;
  let bestD = INTERACT_R;

  for (const npc of st.npcs) {
    const d = Math.hypot(st.x - npc.x, st.y - npc.y);
    if (d < bestD) {
      best = { kind: "npc", npc };
      bestD = d;
    }
  }

  for (const m of MISSIONS) {
    if (!m.pickupSpotKey) continue;
    const progress = st.missions[m.id];
    if (progress.status !== "active" || progress.itemPicked) continue;
    const spot = st.map.missionSpots[m.pickupSpotKey];
    const d = Math.hypot(st.x - spot.x, st.y - spot.y);
    if (d < bestD) {
      best = { kind: "pickup", mission: m };
      bestD = d;
    }
  }

  const ENTERABLE: LocationId[] = ["cafe", "corner_store", "community_center"];
  for (const loc of st.map.locations) {
    if (!ENTERABLE.includes(loc.id)) continue;
    const d = Math.hypot(st.x - loc.x, st.y - loc.y);
    if (d < Math.min(bestD, 70)) {
      best = { kind: "location", locationId: loc.id, name: loc.name };
      bestD = d;
    }
  }

  return best;
}

function dialogueFor(st: NeighborhoodState, npc: NpcRuntime): DialogueContent {
  const spec = npc.spec;
  const givesMission = MISSIONS.find((m) => m.giverNpcId === spec.id);
  const deliversMission = MISSIONS.find((m) => m.deliverNpcId === spec.id);

  if (deliversMission) {
    const progress = st.missions[deliversMission.id];
    if (progress.status === "active" && deliversMission.itemLabel && st.carrying.includes(deliversMission.itemLabel)) {
      return { kind: "delivered", npc: spec, mission: deliversMission, line: spec.doneLine };
    }
  }
  if (givesMission) {
    const progress = st.missions[givesMission.id];
    if (progress.status === "not_started") {
      return { kind: "offer", npc: spec, mission: givesMission, line: spec.askLine };
    }
    if (progress.status === "active") {
      return { kind: "reminder", npc: spec, mission: givesMission, line: spec.activeLine };
    }
  }
  return { kind: "greeting", npc: spec, line: spec.greeting };
}

/** Resolves whatever the nearest interactable is into a state change (open dialogue / pick up
 *  the mission item / open a location overlay). Pure — returns a new state. */
export function performInteract(prev: NeighborhoodState): NeighborhoodState {
  const target = nearestInteractable(prev);
  if (!target) return prev;
  const st: NeighborhoodState = { ...prev, events: [] };

  if (target.kind === "npc") {
    st.dialogue = dialogueFor(st, target.npc);
    st.pose = "wave";
    st.poseT = POSE_DURATION.wave;
    st.events.push("npc_interact");
    return st;
  }

  if (target.kind === "pickup") {
    const missions = { ...st.missions };
    missions[target.mission.id] = { ...missions[target.mission.id], itemPicked: true };
    st.missions = missions;
    st.carrying = target.mission.itemLabel ? [...st.carrying, target.mission.itemLabel] : st.carrying;
    st.pose = "pickup";
    st.poseT = POSE_DURATION.pickup;
    st.events.push("item_pickup");
    st.toast = { text: `Picked up: ${target.mission.itemLabel}`, t: 2 };
    return st;
  }

  st.openLocation = target.locationId;
  st.pose = "interact";
  st.poseT = POSE_DURATION.interact;
  st.events.push("npc_interact");
  return st;
}

export function acceptMission(prev: NeighborhoodState, missionId: MissionSpec["id"]): NeighborhoodState {
  const spec = missionById(missionId);
  const st: NeighborhoodState = { ...prev, missions: { ...prev.missions }, events: [] };
  const noPickupNeeded = !spec.pickupSpotKey;
  st.missions[missionId] = { status: "active", itemPicked: noPickupNeeded };
  if (noPickupNeeded && spec.itemLabel) st.carrying = [...st.carrying, spec.itemLabel];
  st.dialogue = null;
  st.events.push("mission_accepted");
  st.toast = { text: `Mission started: ${spec.title}`, t: 2.2 };
  return st;
}

export function deliverMission(prev: NeighborhoodState, missionId: MissionSpec["id"]): NeighborhoodState {
  const spec = missionById(missionId);
  const st: NeighborhoodState = { ...prev, missions: { ...prev.missions }, events: [] };
  st.missions[missionId] = { status: "complete", itemPicked: true };
  st.carrying = st.carrying.filter((c) => c !== spec.itemLabel);
  st.dialogue = null;
  st.pose = "celebrate";
  st.poseT = POSE_DURATION.celebrate;
  st.events.push("mission_completed");
  st.toast = { text: `Mission complete: ${spec.title}!`, t: 2.4 };
  return st;
}

export function closeDialogue(prev: NeighborhoodState): NeighborhoodState {
  return { ...prev, dialogue: null };
}

export function closeLocation(prev: NeighborhoodState): NeighborhoodState {
  return { ...prev, openLocation: null };
}

/** Everything worth persisting between sessions — deliberately NOT the full engine state (map/
 *  NPC positions are deterministic and rebuilt fresh each load; only real progress is saved). */
export type NeighborhoodSave = {
  missions: MissionsState;
  carrying: string[];
  starsCollected: boolean[];
  discoveriesFound: string[];
  visited: number[];
};

export function toSave(st: NeighborhoodState): NeighborhoodSave {
  return {
    missions: st.missions,
    carrying: st.carrying,
    starsCollected: st.starsCollected,
    discoveriesFound: Array.from(st.discoveriesFound),
    visited: Array.from(st.visited),
  };
}

/** Rebuilds a fresh world (map/NPCs) and rehydrates saved progress on top of it. */
export function fromSave(save: NeighborhoodSave | null | undefined): NeighborhoodState {
  const st = initialNeighborhood();
  if (!save) return st;
  return {
    ...st,
    missions: save.missions ?? st.missions,
    carrying: save.carrying ?? [],
    starsCollected:
      save.starsCollected && save.starsCollected.length === st.starsCollected.length ? save.starsCollected : st.starsCollected,
    discoveriesFound: new Set(save.discoveriesFound ?? []),
    visited: new Set(save.visited ?? []),
  };
}

/** Direction + rough distance from the player to the active main mission's current objective,
 *  for the HUD waypoint arrow. Null if no mission is active. */
export function waypointTarget(st: NeighborhoodState): { x: number; y: number; label: string } | null {
  for (const m of MISSIONS) {
    if (!m.giverNpcId) continue;
    const progress = st.missions[m.id];
    if (progress.status !== "active") continue;
    if (m.pickupSpotKey && !progress.itemPicked) {
      const spot = st.map.missionSpots[m.pickupSpotKey];
      return { x: spot.x, y: spot.y, label: m.itemLabel ?? "Objective" };
    }
    if (m.deliverNpcId) {
      const npc = st.npcs.find((n) => n.spec.id === m.deliverNpcId);
      if (npc) return { x: npc.x, y: npc.y, label: npcById(m.deliverNpcId).name };
    }
  }
  return null;
}
