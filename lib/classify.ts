import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { classifyHeuristic } from "./heuristic";
import { CARD_JSON_SCHEMA, CARD_SYSTEM_PROMPT } from "./prompts";
import {
  clampStat,
  isCreatureType,
  isRarity,
  type CreatureCard,
} from "./types";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

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

function normalizeCard(raw: RawCard, message: string, source: CreatureCard["source"]): CreatureCard {
  const type = typeof raw.type === "string" && isCreatureType(raw.type) ? raw.type : "chaotic";
  const rarity = typeof raw.rarity === "string" && isRarity(raw.rarity) ? raw.rarity : "common";
  const name =
    typeof raw.name === "string" && raw.name.trim().length > 0
      ? raw.name.trim().replace(/\s+/g, "").slice(0, 24).toLowerCase()
      : "missingno";
  const flavor =
    typeof raw.flavor_text === "string" && raw.flavor_text.trim().length > 0
      ? raw.flavor_text.trim()
      : "This species has not been documented. The entry was left blank on purpose, or by accident. Nobody is sure.";

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
    source,
  };
}

function parseLooseJson(text: string): RawCard {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(stripped) as RawCard;
}

async function classifyWithClaude(message: string): Promise<CreatureCard> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const userContent = `Commit message: "${message.replace(/"/g, '\\"')}"`;

  try {
    const parsed = await client.messages.parse({
      model: MODEL,
      max_tokens: 600,
      system: CARD_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
      output_config: {
        format: jsonSchemaOutputFormat(CARD_JSON_SCHEMA),
      },
    });
    return normalizeCard((parsed.parsed_output ?? {}) as RawCard, message, "claude");
  } catch {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: CARD_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });
    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    return normalizeCard(parseLooseJson(text), message, "claude");
  }
}

export async function classifyCommit(message: string): Promise<CreatureCard> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return classifyHeuristic(message);
  }
  return classifyWithClaude(message);
}
