/**
 * YAJ Neighborhood Adventure — the 5 NPCs of YAJ Central.
 *
 * Deliberately simple "AI": each NPC walks a short 2-stop patrol route and turns to face the
 * player when they're near, per the brief ("stand, walk short routes, turn toward player" — no
 * pathfinding, no complex behavior tree).
 */

import { tileCenter } from "./map";

export type NpcId = "maya" | "andre" | "rosa" | "marcus" | "tia";

export type NpcSpec = {
  id: NpcId;
  name: string;
  title: string;
  color: string;
  /** Two-stop back-and-forth patrol route in world units. */
  route: [{ x: number; y: number }, { x: number; y: number }];
  /** How long (seconds) they pause at each end before turning back. */
  pauseS: number;
  speed: number;
  missionId: string;
  greeting: string;
  askLine: string;
  activeLine: string;
  doneLine: string;
};

export const NPCS: NpcSpec[] = [
  {
    id: "maya",
    name: "Maya",
    title: "Cafe Worker",
    color: "#e0724a",
    route: [tileCenter(7, 13), tileCenter(6, 12)],
    pauseS: 2.2,
    speed: 42,
    missionId: "coffee_run",
    greeting: "Hey! Good to see a friendly face.",
    askLine: "I'm short on coffee cups. Can you grab the box by the community center?",
    activeLine: "Still looking for that supply box — it's by the community center.",
    doneLine: "You're a lifesaver! Coffee's back on for everyone. Thank you!",
  },
  {
    id: "andre",
    name: "Andre",
    title: "Basketball Player",
    color: "#3f8de0",
    route: [tileCenter(6, 5), tileCenter(8, 6)],
    pauseS: 1.8,
    speed: 46,
    missionId: "find_the_ball",
    greeting: "Hey, you play?",
    askLine: "My ball rolled off somewhere near the park. Any chance you could find it?",
    activeLine: "Still no ball, huh? It's gotta be somewhere around the park.",
    doneLine: "There it is! Nice find, appreciate it.",
  },
  {
    id: "rosa",
    name: "Ms. Rosa",
    title: "Shop Owner",
    color: "#d1a736",
    route: [tileCenter(27, 13), tileCenter(28, 12)],
    pauseS: 2.6,
    speed: 36,
    missionId: "deliver_the_flyer",
    greeting: "Well hello there.",
    askLine: "Marcus at the community center has a flyer for the shop window — mind grabbing it?",
    activeLine: "Still waiting on that flyer from the community center, when you get a chance.",
    doneLine: "Perfect, right in the window. Thanks for running that over.",
  },
  {
    id: "marcus",
    name: "Marcus",
    title: "Community Center Staff",
    color: "#3fae5c",
    route: [tileCenter(17, 19), tileCenter(18, 20)],
    pauseS: 2.0,
    speed: 40,
    missionId: "deliver_the_flyer",
    greeting: "Welcome by the center!",
    askLine: "Could you take this flyer over to Ms. Rosa at the corner store?",
    activeLine: "That flyer's still waiting for Ms. Rosa whenever you're headed that way.",
    doneLine: "Appreciate you getting that over there.",
  },
  {
    id: "tia",
    name: "Tia",
    title: "Student",
    color: "#a86bd9",
    route: [tileCenter(31, 15), tileCenter(30, 14)],
    pauseS: 2.4,
    speed: 44,
    missionId: "lost_keys",
    greeting: "Oh — hi.",
    askLine: "I dropped my keys somewhere around the bus stop. Could you help me look?",
    activeLine: "Still no keys... they've gotta be near the bus stop somewhere.",
    doneLine: "Oh thank goodness, I almost missed my bus. Thank you!",
  },
];

export function npcById(id: NpcId): NpcSpec {
  const n = NPCS.find((x) => x.id === id);
  if (!n) throw new Error(`Unknown NPC ${id}`);
  return n;
}
