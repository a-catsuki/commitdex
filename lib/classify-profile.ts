import { completeJson } from "./openrouter";
import {
  hasObviousPredictionSubjectMismatch,
  isPredictionCategoryInput,
  normalizePredictionCategory,
  normalizePredictionText,
  normalizePredictionTitle,
  predictionIconForCategory,
} from "./prediction-icons";
import { PROFILE_JSON_HINT, PROFILE_SYSTEM_PROMPT } from "./prompts";
import { clampStat, isCreatureType, type CardStats, type CreatureType } from "./types";
import type { Prediction } from "./db";
import type { GitHubCommit } from "./github";

export type ProfileDraft = {
  dominant_type: CreatureType;
  persona_title: string;
  stats: CardStats;
  predictions: Prediction[];
};

type RawProfile = {
  dominant_type?: unknown;
  persona_title?: unknown;
  stats?: {
    clarity?: unknown;
    effort?: unknown;
    honesty?: unknown;
    chaos?: unknown;
  };
  predictions?: unknown;
};

const DRINK_EVIDENCE = /\b(?:caf[eé]|coffee|caffeine|espresso|latte|cappuccino|americano|mocha|tea|brew|oat milk|drink)\b/i;
const DESK_OBJECT_EVIDENCE =
  /\b(?:cable|keyboard|monitor|sticky note|mouse|screen|charger|headphones?|usb|desk|laptop)\b/i;
const CODING_WORKFLOW = /\b(?:fix|deploy|refactor|wip|hotfix|revert|merge|release|patch)\b/i;
const CRIME_EVIDENCE =
  /\b(?:mass deletion|delete all|deleted|force[- ]?push|oops|broken deploy|final[- ]final|do not merge|don't merge)\b/i;
const COMMUNICATION_EVIDENCE =
  /\b(?:all[- ]?caps|uppercase|terse|apolog(?:y|ize|etic)|sorry|please|vague|passive[- ]aggressive|emoji)\b/i;

function hasRepeatedMatch(messages: string[], pattern: RegExp): boolean {
  return messages.filter((message) => pattern.test(message)).length >= 2;
}

function hasSleepEvidence(commits: GitHubCommit[]): boolean {
  const buckets = new Map<string, number>();
  for (const commit of commits) {
    const date = new Date(commit.committedAt);
    if (Number.isNaN(date.getTime())) continue;
    const hour = date.getUTCHours();
    const bucket = hour < 5 ? "late-night" : hour < 9 ? "early-morning" : hour >= 22 ? "late-night" : "day";
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  return (buckets.get("late-night") ?? 0) >= 2 || (buckets.get("early-morning") ?? 0) >= 2;
}

function hasCommunicationEvidence(messages: string[]): boolean {
  const allCaps = messages.filter((message) => {
    const letters = message.replace(/[^A-Za-z]/g, "");
    return letters.length >= 4 && letters === letters.toUpperCase();
  }).length;
  const terse = messages.filter((message) => message.trim().split(/\s+/).length <= 3).length;
  return allCaps >= 2 || terse >= 2 || hasRepeatedMatch(messages, COMMUNICATION_EVIDENCE);
}

function hasSongEvidence(commits: GitHubCommit[]): boolean {
  const words = new Map<string, number>();
  for (const commit of commits) {
    for (const word of commit.message.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []) {
      words.set(word, (words.get(word) ?? 0) + 1);
    }
  }
  return [...words.values()].some((count) => count >= 2) || commits.length >= 3;
}

function hasCategoryEvidence(category: string, commits: GitHubCommit[]): boolean {
  const messages = commits.map((commit) => commit.message);
  switch (category) {
    case "cafe_order":
      return messages.some((message) => DRINK_EVIDENCE.test(message));
    case "sleep_schedule":
      return hasSleepEvidence(commits);
    case "desk_artifact":
      return messages.some((message) => DESK_OBJECT_EVIDENCE.test(message));
    case "coding_ritual":
      return hasRepeatedMatch(messages, CODING_WORKFLOW);
    case "communication_style":
      return hasCommunicationEvidence(messages);
    case "commit_crime":
      return messages.some((message) => CRIME_EVIDENCE.test(message));
    case "weekend_protocol":
      return commits.some((commit) => {
        const date = new Date(commit.committedAt);
        return !Number.isNaN(date.getTime()) && [0, 6].includes(date.getUTCDay());
      });
    case "song_on_repeat":
      return hasSongEvidence(commits);
    default:
      return false;
  }
}

/** Keep generated punchlines short enough for the compact dossier cards. */
function normalizePredictions(raw: unknown, commits: GitHubCommit[]): Prediction[] {
  if (!Array.isArray(raw)) return [];
  const seenCategories = new Set<string>();
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { category?: unknown; title?: unknown; icon?: unknown; text?: unknown };
      if (typeof row.category !== "string") return null;
      const rawCategory = row.category.trim().toLowerCase();
      if (!isPredictionCategoryInput(rawCategory)) return null;
      // normalizePredictionCategory maps the retired future_patch slug for old model output.
      const category = normalizePredictionCategory(rawCategory);
      if (seenCategories.has(category)) {
        return null;
      }
      if (!hasCategoryEvidence(category, commits)) return null;
      const text = normalizePredictionText(row.text);
      if (!text) return null;
      const title = normalizePredictionTitle(row.title, category);
      if (hasObviousPredictionSubjectMismatch(category, title, text)) return null;
      seenCategories.add(category);
      const prediction: Prediction = {
        category,
        title,
        icon: predictionIconForCategory(category),
        text,
      };
      return prediction;
    })
    .filter((row): row is Prediction => row !== null)
    .slice(0, 5);
}

function normalizeProfile(raw: RawProfile, commits: GitHubCommit[]): ProfileDraft {
  const type =
    typeof raw.dominant_type === "string" && isCreatureType(raw.dominant_type)
      ? raw.dominant_type
      : "chaotic";
  const title =
    typeof raw.persona_title === "string" && raw.persona_title.trim().length > 0
      ? raw.persona_title.trim().slice(0, 80)
      : "unclassified trainer";
  const predictions = normalizePredictions(raw.predictions, commits);
  if (predictions.length < 3) {
    throw new Error("The model returned too few predictions. Retry the scan.");
  }
  return {
    dominant_type: type,
    persona_title: title,
    stats: {
      clarity: clampStat(raw.stats?.clarity),
      effort: clampStat(raw.stats?.effort),
      honesty: clampStat(raw.stats?.honesty),
      chaos: clampStat(raw.stats?.chaos),
    },
    predictions,
  };
}

export async function classifyProfile(commits: GitHubCommit[]): Promise<ProfileDraft> {
  const batch = commits
    .slice(0, 100)
    .map((c, i) => `${i + 1}. ${c.committedAt} | ${c.repo} | ${c.message}`)
    .join("\n");

  const { parsed } = await completeJson({
    system: PROFILE_SYSTEM_PROMPT,
    user: [
      `Commit batch (index, timestamp, repo, message):\n${batch}`,
      `Return JSON shaped like: ${PROFILE_JSON_HINT}`,
    ].join("\n\n"),
    maxTokens: 1200,
    temperature: 0.95,
  });

  return normalizeProfile(parsed as RawProfile, commits);
}
