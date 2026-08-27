import { CLASSIFY_FALLBACKS } from "./model";
import { CLASSIFY_TIMEOUT_MS, completeJson } from "./openrouter";
import { modelLabel } from "./model";
import { CARD_JSON_HINT, CARD_SYSTEM_PROMPT } from "./prompts";
import {
  clampStat,
  isCreatureType,
  isRarity,
  type CreatureCard,
} from "./types";

type RawCard = {
  name?: unknown;
  type?: unknown;
  rarity?: unknown;
  stats?: {
    clarity?: unknown;
    effort?: unknown;
    honesty?: unknown;
    chaos?: unknown;
  };
  flavor_text?: unknown;
};

function normalizeCard(raw: RawCard, message: string, modelId: string): CreatureCard {
  const type = typeof raw.type === "string" && isCreatureType(raw.type) ? raw.type : "chaotic";
  const rarity = typeof raw.rarity === "string" && isRarity(raw.rarity) ? raw.rarity : "common";
  const name =
    typeof raw.name === "string" && raw.name.trim().length > 0
      ? raw.name.trim().replace(/\s+/g, "").slice(0, 28).toLowerCase()
      : "missingno";
  const flavor =
    typeof raw.flavor_text === "string" && raw.flavor_text.trim().length > 0
      ? raw.flavor_text.trim()
      : "This species has not been documented.";

  return {
    name,
    type,
    rarity,
    stats: {
      clarity: clampStat(raw.stats?.clarity),
      effort: clampStat(raw.stats?.effort),
      honesty: clampStat(raw.stats?.honesty),
      chaos: clampStat(raw.stats?.chaos),
    },
    flavor_text: flavor,
    original_message: message,
    source: "openrouter",
    model: modelLabel(modelId),
  };
}

export async function classifyCommit(message: string): Promise<CreatureCard> {
  const { parsed, model } = await completeJson({
    system: CARD_SYSTEM_PROMPT,
    user: [`Commit: ${JSON.stringify(message)}`, `JSON: ${CARD_JSON_HINT}`].join("\n"),
    maxTokens: 420,
    temperature: 1.05,
    models: CLASSIFY_FALLBACKS,
    timeoutMs: CLASSIFY_TIMEOUT_MS,
    packFallbacks: false,
    maxAttempts: 2,
    reasoningMaxTokens: 48,
  });

  return normalizeCard(parsed as RawCard, message, model);
}
