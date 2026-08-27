export const RITUAL_MS = 5000;
export const RITUAL_MS_REDUCED = 700;
export const STAGE_MS = 1000;

export type DexStage = {
  kicker: string;
  title: string;
  detail: string;
};

export const PRINT_STAGES: DexStage[] = [
  {
    kicker: "dex query",
    title: "leafing the pokedex",
    detail: "cross-indexing this vernacular",
  },
  {
    kicker: "rarity ping",
    title: "establishing rarity",
    detail: "weighing how tired this sentence is",
  },
  {
    kicker: "type chart",
    title: "checking type effectiveness",
    detail: "lazy resists effort. panic hits everything",
  },
  {
    kicker: "foil align",
    title: "aligning holographic foil",
    detail: "waiting for the ink to catch the light",
  },
  {
    kicker: "print head",
    title: "printing specimen",
    detail: "thermal head chewing a blank",
  },
];

export const TRAINER_STAGES = [
  "sniffing public logs",
  "clustering night commits",
  "naming the trainer",
] as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
