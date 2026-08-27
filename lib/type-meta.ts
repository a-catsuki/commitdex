import type { CreatureType, Rarity } from "./types";

export type TypeMeta = {
  label: string;
  trait: string;
  example: string;
  cssVar: string;
  paperVar: string;
};

export const TYPE_META: Record<CreatureType, TypeMeta> = {
  lazy: {
    label: "Lazy",
    trait: "minimal effort, generic verbs",
    example: "fix stuff",
    cssVar: "--type-lazy",
    paperVar: "--type-lazy-paper",
  },
  vague: {
    label: "Vague",
    trait: "no context, could mean anything",
    example: "changes",
    cssVar: "--type-vague",
    paperVar: "--type-vague-paper",
  },
  panic: {
    label: "Panic",
    trait: "deadline energy, desperation",
    example: "PLEASE WORK",
    cssVar: "--type-panic",
    paperVar: "--type-panic-paper",
  },
  overconfident: {
    label: "Overconfident",
    trait: "claims more than the diff shows",
    example: "fixed everything",
    cssVar: "--type-overconfident",
    paperVar: "--type-overconfident-paper",
  },
  "passive-aggressive": {
    label: "Passive-aggressive",
    trait: "subtext aimed at a teammate",
    example: "fixed the bug THEY caused",
    cssVar: "--type-passive-aggressive",
    paperVar: "--type-passive-aggressive-paper",
  },
  corporate: {
    label: "Corporate",
    trait: "unnecessarily formal for one line",
    example: "resolved issue pertaining to auth flow",
    cssVar: "--type-corporate",
    paperVar: "--type-corporate-paper",
  },
  chaotic: {
    label: "Chaotic",
    trait: "no pattern, stream of consciousness",
    example: "asdf",
    cssVar: "--type-chaotic",
    paperVar: "--type-chaotic-paper",
  },
  emoji: {
    label: "Emoji",
    trait: "communicates mostly through emoji",
    example: "🔥🔥🔥",
    cssVar: "--type-emoji",
    paperVar: "--type-emoji-paper",
  },
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary",
  shiny: "Shiny",
};

export const SAMPLE_COMMITS = [
  "fix stuff",
  "PLEASE WORK",
  "changes",
  "resolved issue pertaining to auth flow",
  "asdfasdf",
  "🔥🔥🔥",
  "fixed the bug THEY caused",
  "final version I swear",
] as const;
