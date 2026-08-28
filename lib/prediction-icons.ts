/** Fixed prediction category allowlist. Categories are evidence lanes, not visual vibes. */

export type PredictionCategory =
  | "cafe_order"
  | "sleep_schedule"
  | "desk_artifact"
  | "coding_ritual"
  | "communication_style"
  | "commit_crime"
  | "weekend_protocol"
  | "song_on_repeat";

/** Accepted input slugs, including the retired category kept for stored rows. */
export type PredictionCategoryInput = PredictionCategory | "future_patch";

export type PredictionIconMeta = {
  category: PredictionCategory;
  /** Tabler-style slug retained as decorative metadata for old and new rows. */
  icon: string;
  /** Compact category label shown in the HUD. */
  label: string;
  /** Single decorative glyph for the compact dossier card. */
  symbol: string;
  /** What evidence belongs in this category. */
  meaning: string;
  /** Safe title when rendering a legacy prediction without a generated title. */
  fallbackTitle: string;
};

export const PREDICTION_CATEGORIES = [
  {
    category: "cafe_order",
    icon: "ti-coffee",
    label: "CAFÉ ORDER",
    symbol: "☕",
    meaning: "coffee, cafe orders, caffeine, espresso, oat milk, or drink rituals",
    fallbackTitle: "The House Blend Order",
  },
  {
    category: "sleep_schedule",
    icon: "ti-moon",
    label: "SLEEP SCHEDULE",
    symbol: "◔",
    meaning: "late-night, midnight, early-morning, or timestamp patterns",
    fallbackTitle: "The Midnight Scheduler",
  },
  {
    category: "desk_artifact",
    icon: "ti-keyboard",
    label: "DESK ARTIFACT",
    symbol: "▣",
    meaning: "keyboard, monitor, sticky note, cable, or other desk-object jokes",
    fallbackTitle: "The Peripheral Witness",
  },
  {
    category: "coding_ritual",
    icon: "ti-bolt",
    label: "CODING RITUAL",
    symbol: "ϟ",
    meaning: "repeated fix, WIP, deploy, refactor, revert, or commit-burst habits",
    fallbackTitle: "The Ritual Maintainer",
  },
  {
    category: "communication_style",
    icon: "ti-briefcase",
    label: "COMMUNICATION STYLE",
    symbol: "✉",
    meaning: "terse, all-caps, passive-aggressive, emoji, or unusually formal wording",
    fallbackTitle: "The Tone Operations Lead",
  },
  {
    category: "commit_crime",
    icon: "ti-flame",
    label: "COMMIT CRIME",
    symbol: "⚠",
    meaning: "the funniest specific offense in the actual repo or commit messages",
    fallbackTitle: "The Evidence Room Regular",
  },
  {
    category: "weekend_protocol",
    icon: "ti-clock",
    label: "WEEKEND PROTOCOL",
    symbol: "⌁",
    meaning: "Saturday or Sunday activity only when the timestamps show it",
    fallbackTitle: "The Weekend Custodian",
  },
  {
    category: "song_on_repeat",
    icon: "ti-music",
    label: "SONG ON REPEAT",
    symbol: "♫",
    meaning:
      "a playful repeat-listen or soundtrack vibe suggested by commit wording, timing, or recurring patterns",
    fallbackTitle: "The Commit Mixtape",
  },
] as const satisfies readonly PredictionIconMeta[];

/** Legacy export kept for callers that still refer to the old icon collection. */
export const PREDICTION_ICONS = PREDICTION_CATEGORIES;

export type PredictionIcon =
  | (typeof PREDICTION_CATEGORIES)[number]["icon"]
  | "ti-ghost"
  | "ti-mood-smile"
  | "ti-rocket";

const CATEGORY_BY_SLUG = new Map<string, (typeof PREDICTION_CATEGORIES)[number]>(
  PREDICTION_CATEGORIES.map((row) => [row.category, row]),
);
const CATEGORY_BY_ICON = new Map<string, PredictionCategory>(
  PREDICTION_CATEGORIES.map((row) => [row.icon, row.category]),
);
const LEGACY_CATEGORY_ALIASES: Record<string, PredictionCategory> = {
  future_patch: "song_on_repeat",
};
const LEGACY_ICON_CATEGORY: Record<string, PredictionCategory> = {
  "ti-ghost": "commit_crime",
  "ti-mood-smile": "communication_style",
  "ti-rocket": "song_on_repeat",
};

export const DEFAULT_PREDICTION_CATEGORY: PredictionCategory = "commit_crime";
export const DEFAULT_PREDICTION_ICON: PredictionIcon = "ti-flame";
export const DEFAULT_PREDICTION_LABEL = "COMMIT CRIME";

export function isPredictionCategory(raw: string): raw is PredictionCategory {
  return CATEGORY_BY_SLUG.has(raw);
}

export function isPredictionCategoryInput(raw: string): raw is PredictionCategoryInput {
  return isPredictionCategory(raw) || raw in LEGACY_CATEGORY_ALIASES;
}

export function normalizePredictionCategory(raw: unknown): PredictionCategory {
  if (typeof raw !== "string") return DEFAULT_PREDICTION_CATEGORY;
  const category = raw.trim().toLowerCase();
  return LEGACY_CATEGORY_ALIASES[category] ?? (isPredictionCategory(category) ? category : DEFAULT_PREDICTION_CATEGORY);
}

export function predictionCategoryMeta(category: string) {
  return CATEGORY_BY_SLUG.get(normalizePredictionCategory(category)) ?? PREDICTION_CATEGORIES[5];
}

export function predictionCategoryLabel(category: string): string {
  return predictionCategoryMeta(category).label;
}

/** Legacy helper retained for callers while the dossier uses category labels directly. */
export function predictionIconLabel(icon: string): string {
  return predictionCategoryLabel(categoryFromLegacyIcon(icon));
}

export function predictionCategorySymbol(category: string): string {
  return predictionCategoryMeta(category).symbol;
}

export function predictionIconForCategory(category: string): PredictionIcon {
  return predictionCategoryMeta(category).icon;
}

export function categoryFromLegacyIcon(raw: unknown): PredictionCategory {
  if (typeof raw !== "string") return DEFAULT_PREDICTION_CATEGORY;
  const slug = raw.trim().toLowerCase();
  return CATEGORY_BY_ICON.get(slug) ?? LEGACY_ICON_CATEGORY[slug] ?? DEFAULT_PREDICTION_CATEGORY;
}

export function normalizePredictionIcon(raw: unknown): PredictionIcon {
  if (typeof raw !== "string") return DEFAULT_PREDICTION_ICON;
  const slug = raw.trim().toLowerCase();
  if (CATEGORY_BY_ICON.has(slug) || slug in LEGACY_ICON_CATEGORY) {
    return slug as PredictionIcon;
  }
  const withPrefix = slug.startsWith("ti-") ? slug : `ti-${slug}`;
  if (CATEGORY_BY_ICON.has(withPrefix) || withPrefix in LEGACY_ICON_CATEGORY) {
    return withPrefix as PredictionIcon;
  }
  return DEFAULT_PREDICTION_ICON;
}

function cleanText(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function clipAtSentenceBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const completeSentences = text.match(/[^.!?]+[.!?]+/g)?.map(cleanText) ?? [];
  const sentence = completeSentences.find((candidate) => candidate.length <= maxLength);
  if (sentence) return sentence;
  const words = text.slice(0, maxLength).trimEnd().split(/\s+/);
  words.pop();
  return `${words.join(" ").replace(/[,:;]+$/, "").trim()}.`;
}

export function normalizePredictionText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return clipAtSentenceBoundary(cleanText(raw), 160);
}

export function normalizePredictionTitle(raw: unknown, category: string): string {
  const fallback = predictionCategoryMeta(category).fallbackTitle;
  if (typeof raw !== "string") return fallback;
  const words = cleanText(raw).split(" ").filter(Boolean);
  if (words.length < 2) return fallback;
  const clipped = words.slice(0, 6);
  while (clipped.length > 2 && clipped.join(" ").length > 72) clipped.pop();
  return clipped.join(" ").length <= 72 ? clipped.join(" ").trim() || fallback : fallback;
}

/** Prompt fragment listing the category allowlist and evidence boundaries. */
export function predictionCategoryPromptList(): string {
  return PREDICTION_CATEGORIES.map((row) => `${row.category} (${row.label}: ${row.meaning})`).join(
    "; ",
  );
}

/** Legacy prompt helper now returns the category contract instead of visual-vibe labels. */
export function predictionIconPromptList(): string {
  return predictionCategoryPromptList();
}
