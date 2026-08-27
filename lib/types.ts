export const CREATURE_TYPES = [
  "lazy",
  "vague",
  "panic",
  "overconfident",
  "passive-aggressive",
  "corporate",
  "chaotic",
  "emoji",
] as const;

export type CreatureType = (typeof CREATURE_TYPES)[number];

export const RARITIES = [
  "common",
  "uncommon",
  "rare",
  "legendary",
  "shiny",
] as const;

export type Rarity = (typeof RARITIES)[number];

export type CardStats = {
  clarity: number;
  effort: number;
  honesty: number;
  chaos: number;
};

export type CreatureCard = {
  name: string;
  type: CreatureType;
  rarity: Rarity;
  stats: CardStats;
  flavor_text: string;
  original_message: string;
  source: "openrouter";
  model: string;
};

export function isCreatureType(value: string): value is CreatureType {
  return (CREATURE_TYPES as readonly string[]).includes(value);
}

export function isRarity(value: string): value is Rarity {
  return (RARITIES as readonly string[]).includes(value);
}

export function isCreatureCard(value: unknown): value is CreatureCard {
  if (!value || typeof value !== "object") return false;
  const card = value as CreatureCard;
  return (
    typeof card.name === "string" &&
    card.name.length > 0 &&
    isCreatureType(card.type) &&
    isRarity(card.rarity) &&
    typeof card.flavor_text === "string" &&
    typeof card.original_message === "string" &&
    card.stats != null &&
    typeof card.stats.clarity === "number" &&
    typeof card.stats.effort === "number" &&
    typeof card.stats.honesty === "number" &&
    typeof card.stats.chaos === "number"
  );
}

export function clampStat(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
