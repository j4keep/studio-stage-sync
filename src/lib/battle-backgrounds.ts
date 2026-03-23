import bgNeonCity from "@/assets/battle-bg-neon-city.jpg";
import bgFireSmoke from "@/assets/battle-bg-fire-smoke.jpg";
import bgGalaxy from "@/assets/battle-bg-galaxy.jpg";
import bgStageLights from "@/assets/battle-bg-stage-lights.jpg";
import bgGraffiti from "@/assets/battle-bg-graffiti.jpg";
import bgElectric from "@/assets/battle-bg-electric.jpg";

export interface BattleBackgroundPreset {
  id: string;
  label: string;
  emoji: string;
  src: string;
}

export const BATTLE_BACKGROUNDS: BattleBackgroundPreset[] = [
  { id: "none", label: "None", emoji: "⬜", src: "" },
  { id: "neon-city", label: "Neon City", emoji: "🌃", src: bgNeonCity },
  { id: "fire-smoke", label: "Fire", emoji: "🔥", src: bgFireSmoke },
  { id: "galaxy", label: "Galaxy", emoji: "🌌", src: bgGalaxy },
  { id: "stage-lights", label: "Stage", emoji: "🎤", src: bgStageLights },
  { id: "graffiti", label: "Graffiti", emoji: "🎨", src: bgGraffiti },
  { id: "electric", label: "Electric", emoji: "⚡", src: bgElectric },
];

export const getBattleBackground = (id: string | null | undefined): BattleBackgroundPreset | undefined => {
  if (!id || id === "none") return undefined;
  return BATTLE_BACKGROUNDS.find((bg) => bg.id === id);
};
