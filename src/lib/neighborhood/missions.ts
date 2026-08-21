/**
 * YAJ Neighborhood Adventure — the 5 Phase-1 missions.
 *
 * Deliberately simple mission-based conversations only (no dialogue trees): each mission is
 * either ambient (Neighborhood Stars, active from the moment you enter) or accepted by talking to
 * its giver NPC, optionally picked up somewhere in the world, and delivered by talking to a
 * (possibly different) NPC.
 */

import type { NpcId } from "./npcs";

export type MissionId = "coffee_run" | "find_the_ball" | "deliver_the_flyer" | "lost_keys" | "neighborhood_stars";
export type MissionStatus = "not_started" | "active" | "complete";

export type MissionSpec = {
  id: MissionId;
  title: string;
  summary: string;
  /** Who assigns it. Undefined = ambient, auto-active on entry (Neighborhood Stars). */
  giverNpcId?: NpcId;
  itemLabel?: string;
  /** Undefined = the item is handed over directly on accept, no world pickup needed. */
  pickupSpotKey?: "boxPickup" | "ballHidden" | "keysHidden";
  /** Who to deliver to — usually the giver, except the flyer goes to a different NPC. */
  deliverNpcId?: NpcId;
  xp: number;
};

export const MISSIONS: MissionSpec[] = [
  {
    id: "coffee_run",
    title: "Coffee Run",
    summary: "Bring the supply box to Maya at the cafe.",
    giverNpcId: "maya",
    itemLabel: "Coffee Supplies",
    pickupSpotKey: "boxPickup",
    deliverNpcId: "maya",
    xp: 60,
  },
  {
    id: "find_the_ball",
    title: "Find the Ball",
    summary: "Bring the basketball back to Andre.",
    giverNpcId: "andre",
    itemLabel: "Basketball",
    pickupSpotKey: "ballHidden",
    deliverNpcId: "andre",
    xp: 50,
  },
  {
    id: "deliver_the_flyer",
    title: "Deliver the Flyer",
    summary: "Take the flyer to Ms. Rosa at the corner store.",
    giverNpcId: "marcus",
    itemLabel: "Community Flyer",
    deliverNpcId: "rosa",
    xp: 55,
  },
  {
    id: "lost_keys",
    title: "Lost Keys",
    summary: "Bring Tia's keys back to her.",
    giverNpcId: "tia",
    itemLabel: "Keys",
    pickupSpotKey: "keysHidden",
    deliverNpcId: "tia",
    xp: 50,
  },
  {
    id: "neighborhood_stars",
    title: "Neighborhood Stars",
    summary: "Collect 10 hidden YAJ Stars around the block.",
    xp: 80,
  },
];

export function missionById(id: MissionId): MissionSpec {
  const m = MISSIONS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown mission ${id}`);
  return m;
}

export type MissionProgress = { status: MissionStatus; itemPicked: boolean };
export type MissionsState = Record<MissionId, MissionProgress>;

export function initialMissionsState(): MissionsState {
  const s = {} as MissionsState;
  for (const m of MISSIONS) {
    s[m.id] = { status: m.giverNpcId ? "not_started" : "active", itemPicked: false };
  }
  return s;
}

/** The main-quest missions in board order (Neighborhood Stars is tracked separately in the HUD). */
export const MAIN_MISSIONS = MISSIONS.filter((m) => m.giverNpcId);

export function missionsCompleteCount(state: MissionsState) {
  return MAIN_MISSIONS.filter((m) => state[m.id].status === "complete").length;
}

/** Compact one-line tracker text for the currently active main mission, if any. */
export function activeMainMission(state: MissionsState): MissionSpec | null {
  for (const m of MAIN_MISSIONS) {
    if (state[m.id].status === "active") return m;
  }
  return null;
}

export function trackerProgressLabel(spec: MissionSpec, progress: MissionProgress) {
  if (!spec.itemLabel) return null;
  return progress.itemPicked ? `1 / 1 ${spec.itemLabel} Found` : `0 / 1 ${spec.itemLabel} Found`;
}
