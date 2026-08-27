import type { CreatureType, Rarity } from "@/lib/types";

/** Stable 32-bit hash from card identity (name + type + rarity + message). */
export function hashCreatureSeed(
  name: string,
  type: CreatureType,
  rarity: Rarity,
  originalMessage: string,
): number {
  const raw = `${name}\0${type}\0${rarity}\0${originalMessage}`;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

export function range(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

/** Discrete silhouette kits — one family per type, variants within. */
export type BodyKit =
  | "blob"
  | "loaf"
  | "puddle"
  | "cloud"
  | "mist"
  | "orb"
  | "spike"
  | "star"
  | "jag"
  | "chest"
  | "hero"
  | "puff"
  | "sting"
  | "wedge"
  | "drop"
  | "tower"
  | "badge"
  | "brick"
  | "glitch"
  | "lopsided"
  | "shard"
  | "face"
  | "bean"
  | "moon";

export type EyeKit =
  | "sleepy"
  | "doze"
  | "uncertain"
  | "dot"
  | "wide"
  | "bug"
  | "smug"
  | "squint"
  | "narrow"
  | "side"
  | "window"
  | "bored"
  | "mismatch"
  | "glitch"
  | "round"
  | "spark";

export type MouthKit =
  | "yawn"
  | "drool"
  | "flat"
  | "wavy"
  | "gasp"
  | "grin"
  | "smug"
  | "smirk"
  | "sharp"
  | "line"
  | "tight"
  | "zigzag"
  | "open"
  | "big";

export type PatternKit = "none" | "dots" | "stripes" | "patches" | "scan";

export type AccessoryKit =
  | "none"
  | "zzz"
  | "pillow"
  | "question"
  | "haze"
  | "sweat"
  | "spikes"
  | "crown"
  | "cape"
  | "stinger"
  | "antenna"
  | "tie"
  | "badge"
  | "briefcase"
  | "glitchbits"
  | "blush"
  | "sparkles";

export type AuraKit = "none" | "soft" | "ring" | "pulse" | "static";

export type LimbKit = "none" | "stubs" | "floppy" | "arms" | "legs" | "tendrils";

/**
 * Seeded specimen identity. Type locks personality; seed picks kit parts
 * and proportions so same message → same art, different messages diverge.
 */
export type CreatureGenome = {
  seed: number;
  type: CreatureType;
  rarity: Rarity;
  body: BodyKit;
  eye: EyeKit;
  mouth: MouthKit;
  pattern: PatternKit;
  accessory: AccessoryKit;
  aura: AuraKit;
  limbs: LimbKit;
  /** 0–3 discrete silhouette variant within body kit. */
  variant: number;
  headScale: number;
  bodyW: number;
  bodyH: number;
  tilt: number;
  lean: number;
  eyeSize: number;
  eyeSpread: number;
  pupilShift: number;
  foil: boolean;
  glow: number;
};

const RARITY_FOIL: Record<Rarity, number> = {
  common: 0,
  uncommon: 0.2,
  rare: 0.5,
  legendary: 0.85,
  shiny: 1,
};

const RARITY_GLOW: Record<Rarity, [number, number]> = {
  common: [0.15, 0.28],
  uncommon: [0.25, 0.4],
  rare: [0.35, 0.55],
  legendary: [0.5, 0.7],
  shiny: [0.6, 0.85],
};

type TypeKits = {
  bodies: readonly BodyKit[];
  eyes: readonly EyeKit[];
  mouths: readonly MouthKit[];
  accessories: readonly AccessoryKit[];
  patterns: readonly PatternKit[];
  auras: readonly AuraKit[];
  limbs: readonly LimbKit[];
  tilt: [number, number];
  lean: [number, number];
};

const TYPE_KITS: Record<CreatureType, TypeKits> = {
  lazy: {
    bodies: ["blob", "loaf", "puddle"],
    eyes: ["sleepy", "doze"],
    mouths: ["yawn", "drool", "flat"],
    accessories: ["zzz", "zzz", "pillow", "none"],
    patterns: ["none", "dots", "patches"],
    auras: ["none", "soft", "soft"],
    limbs: ["floppy", "stubs", "none"],
    tilt: [-4, 8],
    lean: [6, 18],
  },
  vague: {
    bodies: ["cloud", "mist", "orb"],
    eyes: ["uncertain", "dot"],
    mouths: ["flat", "wavy"],
    accessories: ["question", "question", "haze", "none"],
    patterns: ["none", "scan"],
    auras: ["soft", "ring"],
    limbs: ["none", "tendrils", "none"],
    tilt: [-3, 3],
    lean: [-4, 4],
  },
  panic: {
    bodies: ["spike", "star", "jag"],
    eyes: ["wide", "bug"],
    mouths: ["gasp", "open", "wavy"],
    accessories: ["sweat", "sweat", "spikes"],
    patterns: ["none", "dots"],
    auras: ["pulse", "ring"],
    limbs: ["stubs", "arms"],
    tilt: [-10, 10],
    lean: [-6, 6],
  },
  overconfident: {
    bodies: ["chest", "hero", "puff"],
    eyes: ["smug", "squint"],
    mouths: ["grin", "smug"],
    accessories: ["crown", "crown", "cape", "none"],
    patterns: ["none", "stripes", "patches"],
    auras: ["ring", "pulse"],
    limbs: ["arms", "legs"],
    tilt: [-2, 4],
    lean: [-2, 2],
  },
  "passive-aggressive": {
    bodies: ["sting", "wedge", "drop"],
    eyes: ["narrow", "side"],
    mouths: ["smirk", "sharp"],
    accessories: ["stinger", "stinger", "antenna"],
    patterns: ["none", "stripes"],
    auras: ["none", "soft"],
    limbs: ["stubs", "none"],
    tilt: [-5, 5],
    lean: [2, 10],
  },
  corporate: {
    bodies: ["tower", "badge", "brick"],
    eyes: ["window", "bored"],
    mouths: ["line", "tight", "flat"],
    accessories: ["tie", "badge", "briefcase"],
    patterns: ["none", "scan", "stripes"],
    auras: ["none", "ring"],
    limbs: ["legs", "stubs"],
    tilt: [-1, 2],
    lean: [0, 2],
  },
  chaotic: {
    bodies: ["glitch", "lopsided", "shard"],
    eyes: ["mismatch", "glitch", "wide"],
    mouths: ["zigzag", "open", "smirk"],
    accessories: ["glitchbits", "glitchbits", "spikes", "none"],
    patterns: ["patches", "scan", "dots"],
    auras: ["static", "pulse"],
    limbs: ["arms", "tendrils", "stubs"],
    tilt: [-12, 12],
    lean: [-14, 14],
  },
  emoji: {
    bodies: ["face", "bean", "moon"],
    eyes: ["round", "spark", "squint"],
    mouths: ["big", "grin", "open"],
    accessories: ["blush", "sparkles", "sparkles", "none"],
    patterns: ["none", "dots"],
    auras: ["soft", "ring", "pulse"],
    limbs: ["none", "stubs"],
    tilt: [-3, 3],
    lean: [-2, 2],
  },
};

function bucket(rng: Rng, min: number, max: number, steps = 5): number {
  const t = Math.floor(rng() * steps) / (steps - 1);
  return min + t * (max - min);
}

export function buildGenome(
  seed: number,
  type: CreatureType,
  rarity: Rarity,
): CreatureGenome {
  const rng = mulberry32(seed);
  const kits = TYPE_KITS[type];
  const foilChance = RARITY_FOIL[rarity];
  const [gMin, gMax] = RARITY_GLOW[rarity];

  return {
    seed,
    type,
    rarity,
    body: pick(rng, kits.bodies),
    eye: pick(rng, kits.eyes),
    mouth: pick(rng, kits.mouths),
    pattern: pick(rng, kits.patterns),
    accessory: pick(rng, kits.accessories),
    aura: pick(rng, kits.auras),
    limbs: pick(rng, kits.limbs),
    variant: Math.floor(rng() * 4),
    headScale: bucket(rng, 0.88, 1.18),
    bodyW: bucket(rng, 0.86, 1.16),
    bodyH: bucket(rng, 0.86, 1.14),
    tilt: range(rng, kits.tilt[0], kits.tilt[1]),
    lean: range(rng, kits.lean[0], kits.lean[1]),
    eyeSize: bucket(rng, 0.85, 1.25, 4),
    eyeSpread: bucket(rng, 0.9, 1.15, 4),
    pupilShift: range(rng, -2.2, 2.2),
    foil: chance(rng, foilChance) || rarity === "shiny" || rarity === "legendary",
    glow: range(rng, gMin, gMax),
  };
}

export function genomeFromCard(input: {
  name: string;
  type: CreatureType;
  rarity: Rarity;
  original_message: string;
}): CreatureGenome {
  const seed = hashCreatureSeed(
    input.name,
    input.type,
    input.rarity,
    input.original_message,
  );
  return buildGenome(seed, input.type, input.rarity);
}
