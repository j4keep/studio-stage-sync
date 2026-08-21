import { MISSIONS, MissionsState } from "./missions";

export type NeighborhoodScore = {
  missionsComplete: number;
  missionsTotal: number;
  starsFound: number;
  starsTotal: number;
  secretsFound: number;
  secretsTotal: number;
  xp: number;
  completionPct: number;
  lines: { label: string; value: number }[];
};

/** Missions weigh most, stars next, optional secrets least — matches the "main quest first"
 *  feel while still rewarding full exploration. */
export function scoreNeighborhood(
  missions: MissionsState,
  starsFound: number,
  starsTotal: number,
  secretsFound: number,
  secretsTotal: number,
): NeighborhoodScore {
  const completeMissions = MISSIONS.filter((m) => missions[m.id].status === "complete");
  const missionsComplete = completeMissions.length;
  const missionsTotal = MISSIONS.length;
  const missionXp = completeMissions.reduce((sum, m) => sum + m.xp, 0);
  const starXp = starsFound * 15;
  const secretXp = secretsFound * 25;
  const xp = missionXp + starXp + secretXp;

  const completionPct = Math.round(
    (missionsComplete / missionsTotal) * 60 + (starsFound / starsTotal) * 25 + (secretsFound / secretsTotal) * 15,
  );

  return {
    missionsComplete,
    missionsTotal,
    starsFound,
    starsTotal,
    secretsFound,
    secretsTotal,
    xp,
    completionPct: Math.max(0, Math.min(100, completionPct)),
    lines: [
      { label: "Missions Completed", value: missionsComplete },
      { label: "Stars Found", value: starsFound },
      { label: "Secrets Found", value: secretsFound },
      { label: "XP Earned", value: xp },
      { label: "Neighborhood Completion", value: completionPct },
    ],
  };
}
