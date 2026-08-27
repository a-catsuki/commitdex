import type { GitHubCommit } from "./github";
import { COPY } from "./public-error";

export type SpinEligibility = {
  canSpin: boolean;
  /** Quirky lock copy when canSpin is false and a foil already exists. */
  spinLockedReason: string | null;
};

/** UTC calendar day as YYYY-MM-DD. Day boundaries are UTC. */
export function utcDayKey(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** True when `featuredAt` is on an earlier UTC calendar day than `now`. */
export function isNewUtcDaySince(featuredAt: string, now: Date = new Date()): boolean {
  const prior = utcDayKey(featuredAt);
  const today = utcDayKey(now);
  if (!prior || !today) return false;
  return prior < today;
}

export function hasCommitAfter(commits: GitHubCommit[], featuredAt: string): boolean {
  const pivot = new Date(featuredAt).getTime();
  if (Number.isNaN(pivot)) return false;
  return commits.some((commit) => {
    const at = new Date(commit.committedAt).getTime();
    return !Number.isNaN(at) && at > pivot;
  });
}

/**
 * Featured-card re-spin rules (UTC):
 * - No foil yet → can spin (first allotment).
 * - Same UTC day as featured_at → locked ("Already pulled today.").
 * - New UTC day, but no public commit with committed_at > featured_at → locked
 *   ("No new specimens since last pull.").
 * - New UTC day and at least one newer public commit → can spin (replace foil).
 */
export function evaluateSpinEligibility(
  featuredAt: string | null,
  hasFeaturedCard: boolean,
  commits: GitHubCommit[] | null,
  now: Date = new Date(),
): SpinEligibility {
  if (!hasFeaturedCard) {
    return { canSpin: true, spinLockedReason: null };
  }

  const pivot = featuredAt && !Number.isNaN(new Date(featuredAt).getTime()) ? featuredAt : null;
  if (!pivot) {
    return { canSpin: false, spinLockedReason: COPY.alreadyPulledToday };
  }

  if (!isNewUtcDaySince(pivot, now)) {
    return { canSpin: false, spinLockedReason: COPY.alreadyPulledToday };
  }

  if (!commits || !hasCommitAfter(commits, pivot)) {
    return { canSpin: false, spinLockedReason: COPY.noNewSpecimens };
  }

  return { canSpin: true, spinLockedReason: null };
}
