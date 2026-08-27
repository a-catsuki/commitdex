/** Fixed prediction icon allowlist — model must pick from these only. */

export type PredictionIconMeta = {
  /** Tabler-style slug stored on the prediction. */
  icon: string;
  /** Short HUD chip label (uppercase in UI). */
  label: string;
  /** What this category means for the model / docs. */
  meaning: string;
};

export const PREDICTION_ICONS = [
  {
    icon: "ti-coffee",
    label: "CAFFEINE",
    meaning: "fuel, late sessions, stimulant vibes",
  },
  {
    icon: "ti-moon",
    label: "LATE NIGHTS",
    meaning: "nocturnal timestamps, after-hours commits",
  },
  {
    icon: "ti-keyboard",
    label: "KEYSMASH",
    meaning: "spam bursts, WIP floods, keyboard mash",
  },
  {
    icon: "ti-bolt",
    label: "BURST",
    meaning: "rapid-fire commits in a short window",
  },
  {
    icon: "ti-clock",
    label: "CLOCKWATCH",
    meaning: "odd timing, weekends, deadline crunches",
  },
  {
    icon: "ti-flame",
    label: "ON FIRE",
    meaning: "panic, caps, please-fix energy",
  },
  {
    icon: "ti-briefcase",
    label: "CORP SPEAK",
    meaning: "jargon, stakeholder tone, corporate verbs",
  },
  {
    icon: "ti-ghost",
    label: "GHOSTED",
    meaning: "vague, lazy, or absent detail",
  },
  {
    icon: "ti-rocket",
    label: "OVERCOMMIT",
    meaning: "overconfident promises, big claims",
  },
  {
    icon: "ti-mood-smile",
    label: "PICTOGRAPH",
    meaning: "emoji-heavy or symbol-led messages",
  },
] as const satisfies readonly PredictionIconMeta[];

export const DEFAULT_PREDICTION_ICON = "ti-bolt";
export const DEFAULT_PREDICTION_LABEL = "FIELD NOTE";

const ICON_BY_SLUG = new Map(
  PREDICTION_ICONS.map((row) => [row.icon, row] as const),
);

/** Prompt fragment listing allowlisted icons + meanings. */
export function predictionIconPromptList(): string {
  return PREDICTION_ICONS.map((row) => `${row.icon} (${row.label}: ${row.meaning})`).join(
    "; ",
  );
}

export function normalizePredictionIcon(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_PREDICTION_ICON;
  const slug = raw.trim().toLowerCase();
  if (ICON_BY_SLUG.has(slug)) return slug;
  // Accept bare names the model sometimes returns ("coffee", "moon").
  const withPrefix = slug.startsWith("ti-") ? slug : `ti-${slug}`;
  if (ICON_BY_SLUG.has(withPrefix)) return withPrefix;
  return DEFAULT_PREDICTION_ICON;
}

export function predictionIconLabel(icon: string): string {
  return ICON_BY_SLUG.get(normalizePredictionIcon(icon))?.label ?? DEFAULT_PREDICTION_LABEL;
}
