import { completeJson } from "./openrouter";
import { normalizePredictionIcon } from "./prediction-icons";
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

/** Soft-cap punchlines so chips stay short even if the model runs long. */
function clipPredictionText(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 96) return trimmed;
  const cut = trimmed.slice(0, 96);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 48 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function normalizePredictions(raw: unknown): Prediction[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { icon?: unknown; text?: unknown };
      if (typeof row.text !== "string" || row.text.trim().length === 0) return null;
      return {
        icon: normalizePredictionIcon(row.icon),
        text: clipPredictionText(row.text),
      };
    })
    .filter((row): row is Prediction => row !== null)
    .slice(0, 5);
}

function normalizeProfile(raw: RawProfile): ProfileDraft {
  const type =
    typeof raw.dominant_type === "string" && isCreatureType(raw.dominant_type)
      ? raw.dominant_type
      : "chaotic";
  const title =
    typeof raw.persona_title === "string" && raw.persona_title.trim().length > 0
      ? raw.persona_title.trim().slice(0, 80)
      : "unclassified trainer";
  const predictions = normalizePredictions(raw.predictions);
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

  return normalizeProfile(parsed as RawProfile);
}
