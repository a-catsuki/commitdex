import { CLASSIFY_MODEL, modelLabel } from "./model";
import { CLASSIFY_TIMEOUT_MS, completeJson } from "./openrouter";
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

export const CARD_NAME_MAX = 13;
const FLAVOR_MAX = 140;
const FLAVOR_FALLBACK = "This species has not been documented.";

export function clampCardName(raw: string): string {
  const compact = raw.replace(/\s+/g, "").toLowerCase();
  if (!compact) return "missingno";

  let slice = compact.slice(0, CARD_NAME_MAX);
  while (slice.endsWith("-")) {
    slice = slice.slice(0, -1);
  }
  return slice || compact.slice(0, CARD_NAME_MAX);
}

function clampFlavor(raw: string): string {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return FLAVOR_FALLBACK;

  const parts =
    text.match(/[^.!?]+(?:[.!?]+|$)/g)?.map((part) => part.trim()).filter(Boolean) ?? [text];
  const blurb = parts.slice(0, 2).join(" ");
  if (blurb.length <= FLAVOR_MAX) return blurb;
  if (parts[0].length <= FLAVOR_MAX) return parts[0];

  const cut = blurb.slice(0, FLAVOR_MAX);
  const at = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
  const clipped = (at >= 48 ? cut.slice(0, at) : cut).replace(/[,:;]+$/, "").trim();
  if (!clipped) return FLAVOR_FALLBACK;
  return /[.!?]$/.test(clipped) ? clipped : `${clipped}.`;
}

function normalizeCard(raw: RawCard, message: string, modelId: string): CreatureCard {
  const type = typeof raw.type === "string" && isCreatureType(raw.type) ? raw.type : "chaotic";
  const rarity = typeof raw.rarity === "string" && isRarity(raw.rarity) ? raw.rarity : "common";
  const name =
    typeof raw.name === "string" && raw.name.trim().length > 0
      ? clampCardName(raw.name)
      : "missingno";
  const flavor =
    typeof raw.flavor_text === "string" && raw.flavor_text.trim().length > 0
      ? clampFlavor(raw.flavor_text)
      : FLAVOR_FALLBACK;

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
    maxTokens: 400,
    temperature: 1.05,
    model: CLASSIFY_MODEL,
    timeoutMs: CLASSIFY_TIMEOUT_MS,
    reasoningMaxTokens: 48,
  });

  return normalizeCard(parsed as RawCard, message, model);
}
