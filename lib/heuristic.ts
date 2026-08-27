import {
  clampStat,
  type CreatureCard,
  type CreatureType,
  type Rarity,
} from "./types";

const EMOJI_RE =
  /\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\u{1F300}-\u{1FAFF}]/gu;

function emojiRatio(message: string): number {
  const emojis = message.match(EMOJI_RE) ?? [];
  if (message.trim().length === 0) return 0;
  return emojis.join("").length / message.trim().length;
}

function lettersOnly(message: string): string {
  return message.replace(/[^a-zA-Z]+/g, "");
}

function stem(message: string): string {
  const word =
    message
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .trim()
      .split(/\s+/)
      .find((w) => w.length > 1) ?? "git";
  return word.slice(0, 8);
}

const TYPE_SUFFIX: Record<CreatureType, string> = {
  lazy: "odile",
  vague: "puff",
  panic: "scream",
  overconfident: "zard",
  "passive-aggressive": "sting",
  corporate: "bot",
  chaotic: "geist",
  emoji: "moji",
};

const NAMED: Record<string, string> = {
  fix: "fixodile",
  update: "updatoth",
  wip: "wipuff",
  changes: "changmist",
  asdf: "asdfgeist",
  stuff: "stufflax",
};

function creatureName(message: string, type: CreatureType): string {
  const first = stem(message);
  if (NAMED[first]) return NAMED[first];
  if (first.startsWith("asdf") || first.startsWith("qwer")) return "asdfgeist";
  const base = first || "git";
  const suffix = TYPE_SUFFIX[type];
  if (base.endsWith(suffix.slice(0, 2))) return `${base}${suffix.slice(2)}`;
  return `${base}${suffix}`;
}

function pickType(message: string): CreatureType {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();
  const letters = lettersOnly(trimmed);
  const ratio = emojiRatio(trimmed);

  if (ratio >= 0.45 || (ratio > 0 && letters.length <= 2)) return "emoji";

  if (
    /\b(they|them|their|theirs)\b/i.test(trimmed) ||
    /\bas requested\b/i.test(lower) ||
    /\bper (the )?review\b/i.test(lower) ||
    /you guys|your bug|not my/i.test(lower)
  ) {
    return "passive-aggressive";
  }

  if (
    /\b(pertaining|regarding|herein|pursuant|leverage|synerg|stakeholders|action item)\b/i.test(
      lower,
    ) ||
    /\b(resolved issue|implemented a|refactored the|addressed the)\b/i.test(lower)
  ) {
    return "corporate";
  }

  if (
    (letters.length >= 4 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) ||
    /\b(please work|for real|i promise|asap|help|oh god|why won'?t)\b/i.test(lower) ||
    /!{2,}|\?{2,}/.test(trimmed)
  ) {
    return "panic";
  }

  if (
    /\b(fixed everything|final version|all bugs|done forever|complete rewrite|ship it)\b/i.test(
      lower,
    ) ||
    /\b(finally|perfect|nailed it)\b/i.test(lower)
  ) {
    return "overconfident";
  }

  if (
    /^(?:asdf|qwer|zxcv|sdfg|fjdk|lmao|lol|idk|why|wtf|aaaa|hhhh)+$/i.test(
      lower.replace(/\s/g, ""),
    ) ||
    /\b(i hate this|kill me|what even|no idea)\b/i.test(lower) ||
    (trimmed.length <= 4 && !/[aeiou]/i.test(letters))
  ) {
    return "chaotic";
  }

  if (
    /^(wip|changes|misc|tmp|temp|test|update|stuff|files|code|n\/a|ok)$/i.test(lower) ||
    /^(update|changes|fix)s?$/i.test(lower)
  ) {
    return "vague";
  }

  if (
    /^(fix|fixed|hotfix|patch|typo|oops|minor|small fix|bugfix)(\s+\w+){0,2}$/i.test(
      lower,
    ) ||
    trimmed.length <= 12
  ) {
    return "lazy";
  }

  if (trimmed.split(/\s+/).length <= 2) return "vague";
  return "lazy";
}

function pickRarity(message: string, type: CreatureType, chaos: number): Rarity {
  const trimmed = message.trim();
  const smash = /^(?:asdf|qwer|zxcv|sdfg|fjdk)+$/i.test(
    trimmed.replace(/\s/g, ""),
  );
  const doNotMerge = /do not merge|don'?t merge|wip do not/i.test(trimmed);

  if (smash || doNotMerge || (type === "chaotic" && chaos >= 92)) return "shiny";
  if (
    trimmed.length >= 180 ||
    trimmed.length <= 2 ||
    (trimmed === trimmed.toUpperCase() && trimmed.length >= 20)
  ) {
    return "legendary";
  }
  if (type === "emoji" || type === "passive-aggressive" || chaos >= 75) return "rare";
  if (type === "corporate" || type === "overconfident" || trimmed.length >= 28) {
    return "uncommon";
  }
  return "common";
}

function statsFor(message: string, type: CreatureType): CreatureCard["stats"] {
  const words = message.trim().split(/\s+/).filter(Boolean).length;
  const hasTicket = /#\d+|JIRA|TICKET|FIXES/i.test(message);
  const hasPath = /\.[a-z]{1,4}\b|\//.test(message);

  let clarity = Math.min(100, words * 12 + (hasTicket ? 20 : 0) + (hasPath ? 15 : 0));
  let effort = Math.min(100, message.trim().length / 2 + (hasTicket ? 10 : 0));
  let honesty = 70;
  let chaos = Math.min(100, Math.abs(20 - words) * 4);

  if (type === "vague" || type === "lazy") {
    clarity = Math.min(clarity, 28);
    effort = Math.min(effort, 22);
    honesty = 35;
    chaos = Math.max(chaos, 18);
  }
  if (type === "panic") {
    clarity = 40;
    effort = 55;
    honesty = 62;
    chaos = 84;
  }
  if (type === "overconfident") {
    clarity = 58;
    effort = 44;
    honesty = 18;
    chaos = 48;
  }
  if (type === "passive-aggressive") {
    clarity = 72;
    effort = 61;
    honesty = 80;
    chaos = 66;
  }
  if (type === "corporate") {
    clarity = 64;
    effort = 78;
    honesty = 52;
    chaos = 12;
  }
  if (type === "chaotic") {
    clarity = 8;
    effort = 14;
    honesty = 22;
    chaos = 96;
  }
  if (type === "emoji") {
    clarity = 16;
    effort = 20;
    honesty = 30;
    chaos = 70;
  }

  return {
    clarity: clampStat(clarity),
    effort: clampStat(effort),
    honesty: clampStat(honesty),
    chaos: clampStat(chaos),
  };
}

const FLAVOR: Record<CreatureType, (name: string) => string> = {
  lazy: (name) =>
    `${name} is rarely observed standing. In the wild it drags a single verb across entire codebases, then sleeps on the branch.`,
  vague: (name) =>
    `${name} leaves no tracks. Trainers report a commit, then cannot recall what changed, including ${name} itself.`,
  panic: (name) =>
    `${name} appears in the final hour before a demo. Its cry has been compared to a laptop fan and a Slack mention at once.`,
  overconfident: (name) =>
    `${name} announces that the habitat is fully restored. Independent sightings suggest a single semicolon was involved.`,
  "passive-aggressive": (name) =>
    `${name} hunts in pairs. The second creature is never named, but everyone on the team knows who it is.`,
  corporate: (name) =>
    `${name} files its own performance review. Q3 findings: communicated value, aligned stakeholders, shipped a one-line patch.`,
  chaotic: (name) =>
    `${name} has no documented habitat. Researchers who attempt a field guide produce only keyboard smash and a closed laptop.`,
  emoji: (name) =>
    `${name} refuses spoken language. Entire migrations have been approved on the basis of three fire glyphs and a sparkle.`,
};

export function classifyHeuristic(message: string): CreatureCard {
  const type = pickType(message);
  const stats = statsFor(message, type);
  const rarity = pickRarity(message, type, stats.chaos);
  const name = creatureName(message, type);

  return {
    name,
    type,
    rarity,
    stats,
    flavor_text: FLAVOR[type](name),
    original_message: message,
    source: "heuristic",
  };
}
