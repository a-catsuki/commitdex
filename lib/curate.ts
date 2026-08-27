import type { GitHubCommit } from "./github";
import type { CreatureType, Rarity } from "./types";

const GENERIC_LEAD =
  /^(fix|fixed|fixes|hotfix|bugfix|update|updated|updates|upd|wip|typo|misc|stuff|chore|docs|test|tests|refactor|fmt|format|lint|ci|merge|bump)(\b|[!:.\s-]|$)/i;

function scoreMessage(message: string, repeats: number): number {
  let score = 0;
  const length = message.length;
  if (length >= 12 && length <= 90) score += 3;
  else if (length > 4) score += 1;
  if (!GENERIC_LEAD.test(message)) score += 5;
  if (/[!?]|please|sorry|hack|temp|wtf|oops|do not|don't/i.test(message)) score += 2;
  if (/[A-Z]{4,}/.test(message)) score += 1;
  if (/\p{Extended_Pictographic}/u.test(message)) score += 2;
  if (/\d/.test(message)) score += 1;
  score -= Math.min(4, repeats);
  return score;
}

/** Pick 5–8 distinctive commit lines. Skip blanks and duplicates. Prefer personality over “fix”. */
export function curateCommits(messages: string[], want = 7): string[] {
  const counts = new Map<string, number>();
  const unique: string[] = [];

  for (const raw of messages) {
    const message = raw.replace(/\s+/g, " ").trim();
    if (!message) continue;
    const key = message.toLowerCase();
    const seen = counts.get(key) ?? 0;
    counts.set(key, seen + 1);
    if (seen === 0) unique.push(message);
  }

  if (unique.length === 0) return [];

  const ranked = [...unique].sort((a, b) => {
    const delta =
      scoreMessage(b, counts.get(b.toLowerCase()) ?? 1) -
      scoreMessage(a, counts.get(a.toLowerCase()) ?? 1);
    if (delta !== 0) return delta;
    return b.length - a.length;
  });

  const target = Math.min(8, Math.max(Math.min(5, ranked.length), Math.min(want, ranked.length)));
  return ranked.slice(0, target);
}

/**
 * Prefer commits newer than `afterIso` for the reel; fill with distinctive older
 * history so the visual strip still has personality.
 */
export function curateCommitsForSpin(
  commits: GitHubCommit[],
  afterIso?: string | null,
  want = 7,
): string[] {
  if (!afterIso) {
    return curateCommits(
      commits.map((c) => c.message),
      want,
    );
  }

  const pivot = new Date(afterIso).getTime();
  if (Number.isNaN(pivot)) {
    return curateCommits(
      commits.map((c) => c.message),
      want,
    );
  }

  const newer: string[] = [];
  const older: string[] = [];
  for (const commit of commits) {
    const at = new Date(commit.committedAt).getTime();
    if (!Number.isNaN(at) && at > pivot) newer.push(commit.message);
    else older.push(commit.message);
  }

  const preferred = curateCommits(newer, want);
  if (preferred.length >= Math.min(5, want) || older.length === 0) {
    return preferred.length > 0 ? preferred : curateCommits(older, want);
  }

  const filler = curateCommits(older, want);
  const seen = new Set(preferred.map((m) => m.toLowerCase()));
  const mixed = [...preferred];
  for (const message of filler) {
    if (mixed.length >= want) break;
    const key = message.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    mixed.push(message);
  }
  return mixed;
}

export function reelLabel(message: string, max = 42): string {
  const line = message.replace(/\s+/g, " ").trim();
  if (line.length <= max) return line;
  return `${line.slice(0, max - 1).trimEnd()}…`;
}

/** Visual-only type/rarity hints for reel tickets. Not the allotment classifier. */
export function hintReelTicket(message: string): { type: CreatureType; rarity: Rarity } {
  const line = message.replace(/\s+/g, " ").trim();
  const lower = line.toLowerCase();
  const emojiHeavy = (line.match(/\p{Extended_Pictographic}/gu) ?? []).length >= Math.max(1, line.length / 4);
  const capsHeavy = line.length > 3 && line === line.toUpperCase() && /[A-Z]/.test(line);
  const smash =
    /^(asdf+|qwer+|zxcv+|a{4,}|l{4,}|\.{3,}|!{3,})$/i.test(line) ||
    /^[^a-zA-Z0-9\s]{3,}$/.test(line);

  let type: CreatureType = "vague";
  if (emojiHeavy) type = "emoji";
  else if (smash || /lmao|wtf|idk|asdf/.test(lower)) type = "chaotic";
  else if (/please|asap|urgent|broken|help|!!!|panic/.test(lower) || capsHeavy) type = "panic";
  else if (/they |them |someone|again\.|obviously|supposedly/.test(lower)) type = "passive-aggressive";
  else if (/pertaining|regarding|implement|resolve|facilitate|leverage/.test(lower)) type = "corporate";
  else if (/final|swear|everything|perfect|done\.|ship it/.test(lower)) type = "overconfident";
  else if (GENERIC_LEAD.test(line) || /^(fix|update|wip|misc|stuff)\b/i.test(line)) type = "lazy";
  else if (line.length < 8) type = "vague";
  else type = "chaotic";

  let rarity: Rarity = "common";
  const score = scoreMessage(line, 1);
  if (/do not merge|don'?t merge|revert this|keyboard/.test(lower) || smash) rarity = "shiny";
  else if (capsHeavy || line.length > 120 || line.length < 4) rarity = "legendary";
  else if (score >= 8 || /[!?]{2,}/.test(line)) rarity = "rare";
  else if (score >= 5) rarity = "uncommon";

  return { type, rarity };
}
