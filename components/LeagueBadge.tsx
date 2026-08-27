import { LEAGUE_LABEL, type League } from "@/lib/league";

export function LeagueBadge({ league }: { league: League }) {
  return (
    <span className="league-badge" data-league={league}>
      {LEAGUE_LABEL[league]}
    </span>
  );
}
