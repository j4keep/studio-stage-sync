import bgNeonCity from "@/assets/battle-bg-neon-city.jpg";
import bgFireSmoke from "@/assets/battle-bg-fire-smoke.jpg";
import bgGalaxy from "@/assets/battle-bg-galaxy.jpg";
import bgStageLights from "@/assets/battle-bg-stage-lights.jpg";
import bgGraffiti from "@/assets/battle-bg-graffiti.jpg";
import bgElectric from "@/assets/battle-bg-electric.jpg";
import bgSpotlight from "@/assets/battle-bg-spotlight.jpg";
import bgFlames from "@/assets/battle-bg-flames.jpg";

export interface BattleBackgroundPreset {
  id: string;
  label: string;
  emoji: string;
  src: string;
}

export const BATTLE_BACKGROUNDS: BattleBackgroundPreset[] = [
  { id: "none", label: "None", emoji: "⬜", src: "" },
  { id: "neon-city", label: "Neon Stage", emoji: "🌃", src: bgNeonCity },
  { id: "fire-smoke", label: "Purple Haze", emoji: "💜", src: bgFireSmoke },
  { id: "galaxy", label: "Futuristic", emoji: "🔮", src: bgGalaxy },
  { id: "stage-lights", label: "Stage Lights", emoji: "🎤", src: bgStageLights },
  { id: "graffiti", label: "Neon Tunnel", emoji: "🚇", src: bgGraffiti },
  { id: "electric", label: "Lightning", emoji: "⚡", src: bgElectric },
  { id: "spotlight", label: "Spotlight", emoji: "💡", src: bgSpotlight },
  { id: "flames", label: "Flames", emoji: "🔥", src: bgFlames },
];

export const getBattleBackground = (id: string | null | undefined): BattleBackgroundPreset | undefined => {
  if (!id || id === "none") return undefined;
  return BATTLE_BACKGROUNDS.find((bg) => bg.id === id);
};
