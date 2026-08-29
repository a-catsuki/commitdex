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
  /** The narrow evidence boundary for this category. */
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
    meaning: "one specific drink, cafe order, or customization, only when drink/caffeine evidence appears",
    fallbackTitle: "The Espresso Order",
  },
  {
    category: "sleep_schedule",
    icon: "ti-moon",
    label: "SLEEP SCHEDULE",
    symbol: "◔",
    meaning: "a time-of-day or day pattern proven by commit timestamps",
    fallbackTitle: "The 2AM Schedule",
  },
  {
    category: "desk_artifact",
    icon: "ti-keyboard",
    label: "DESK ARTIFACT",
    symbol: "▣",
    meaning: "one concrete object or tool explicitly suggested by a commit message",
    fallbackTitle: "The Charging Cable",
  },
  {
    category: "coding_ritual",
    icon: "ti-bolt",
    label: "CODING RITUAL",
    symbol: "ϟ",
    meaning: "a repeated commit verb or workflow such as fix, deploy, refactor, WIP, or hotfix",
    fallbackTitle: "The Fix Deploy Ritual",
  },
  {
    category: "communication_style",
    icon: "ti-briefcase",
    label: "COMMUNICATION STYLE",
    symbol: "✉",
    meaning: "an actual wording pattern such as all-caps, terse, apologetic, vague, or barbed",
    fallbackTitle: "The Terse Commit Style",
  },
  {
    category: "commit_crime",
    icon: "ti-flame",
    label: "COMMIT CRIME",
    symbol: "⚠",
    meaning: "one specific funny offense visible in a commit, such as mass deletion or final-final",
    fallbackTitle: "The Final-Final Offense",
  },
  {
    category: "weekend_protocol",
    icon: "ti-clock",
    label: "WEEKEND PROTOCOL",
    symbol: "⌁",
    meaning: "Saturday or Sunday commit behavior, only when timestamps prove weekend activity",
    fallbackTitle: "The Saturday Shift",
  },
  {
    category: "song_on_repeat",
    icon: "ti-music",
    label: "SONG ON REPEAT",
    symbol: "♫",
    meaning:
      "a fictional song, album, playlist, or genre concept based on repeated words, timing, or commit energy",
    fallbackTitle: "The Commit Soundtrack",
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

const SUBJECT_CUE_PATTERNS: Record<PredictionCategory, RegExp> = {
  cafe_order: /\b(?:caf[eé]|coffee|caffeine|espresso|latte|cappuccino|americano|mocha|tea|brew|oat milk|drink)\b/i,
  sleep_schedule: /\b(?:midnight|late[- ]night|after dark|dawn|early morning|2\s*a\.?m\.?|3\s*a\.?m\.?|sleep|nocturnal)\b/i,
  desk_artifact: /\b(?:cable|keyboard|monitor|sticky note|mouse|screen|charger|headphones?|usb|desk|laptop)\b/i,
  coding_ritual: /\b(?:fix|deploy|refactor|hotfix|wip|merge|release|commit|patch|revert)\b/i,
  communication_style: /\b(?:all[- ]?caps|uppercase|terse|apolog(?:y|ize|etic)|sorry|please|vague|passive[- ]aggressive|emoji)\b/i,
  commit_crime: /\b(?:mass deletion|delete all|deleted|force[- ]?push|oops|broken deploy|final[- ]final|do not merge|don't merge)\b/i,
  weekend_protocol: /\b(?:weekend|saturday|sunday)\b/i,
  song_on_repeat: /\b(?:song|album|playlist|mixtape|soundtrack|track|chorus|verse|remix|anthem|encore|radio)\b/i,
};

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

function subjectCueCategories(value: string): PredictionCategory[] {
  return PREDICTION_CATEGORIES.filter((row) => SUBJECT_CUE_PATTERNS[row.category].test(value))
    .map((row) => row.category)
    .filter((category) => category !== "song_on_repeat");
}

/**
 * Reject only an unambiguous title/punchline subject swap. Most creative or
 * metaphorical wording deliberately passes through unchanged.
 */
export function hasObviousPredictionSubjectMismatch(
  category: string,
  title: string,
  text: string,
): boolean {
  const normalizedCategory = normalizePredictionCategory(category);
  const titleCategories = subjectCueCategories(title);
  const textCategories = subjectCueCategories(text);
  if (normalizedCategory === "song_on_repeat" || titleCategories.length === 0 || textCategories.length === 0) {
    return false;
  }

  const titleNamesCategory = titleCategories.includes(normalizedCategory);
  const textNamesCategory = textCategories.includes(normalizedCategory);
  if (titleNamesCategory && !textNamesCategory) return true;
  if (textNamesCategory && !titleNamesCategory && titleCategories.length === 1) return true;
  return titleCategories.length === 1 && textCategories.length === 1 && titleCategories[0] !== textCategories[0];
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
