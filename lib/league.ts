export const LEAGUES = ["bronze", "silver", "gold", "platinum", "legendary"] as const;

export type League = (typeof LEAGUES)[number];

export function leagueFor(commitsAnalyzed: number): League {
  if (commitsAnalyzed >= 5000) return "legendary";
  if (commitsAnalyzed >= 1500) return "platinum";
  if (commitsAnalyzed >= 500) return "gold";
  if (commitsAnalyzed >= 100) return "silver";
  return "bronze";
}

export const LEAGUE_LABEL: Record<League, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  legendary: "Legendary",
};
