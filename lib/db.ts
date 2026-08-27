import { query } from "./d1";
import type { League } from "./league";
import {
  clampStat,
  isCreatureType,
  isRarity,
  type CreatureCard,
  type CreatureType,
} from "./types";

export type Prediction = {
  icon: string;
  text: string;
};

export type TrainerRow = {
  github_username: string;
  github_id: number | null;
  avatar_url: string | null;
  persona_title: string;
  dominant_type: CreatureType;
  league: League;
  clarity: number;
  effort: number;
  honesty: number;
  chaos: number;
  total_commits_analyzed: number;
  predictions: Prediction[];
  sample_messages: string[];
  reel_commits: string[];
  featured_card: CreatureCard | null;
  featured_at: string | null;
  computed_at: string;
  created_at: string;
};

type TrainerInsert = Omit<TrainerRow, "created_at">;

type TrainerRecord = {
  github_username: unknown;
  github_id: unknown;
  avatar_url: unknown;
  persona_title: unknown;
  dominant_type: unknown;
  league: unknown;
  clarity: unknown;
  effort: unknown;
  honesty: unknown;
  chaos: unknown;
  total_commits_analyzed: unknown;
  predictions: unknown;
  sample_messages: unknown;
  reel_commits?: unknown;
  featured_card?: unknown;
  featured_at?: unknown;
  computed_at: unknown;
  created_at: unknown;
};

const TRAINER_COLUMNS =
  "github_username, github_id, avatar_url, persona_title, dominant_type, league, clarity, effort, honesty, chaos, total_commits_analyzed, predictions, sample_messages, reel_commits, featured_card, featured_at, computed_at, created_at";

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseFeaturedCard(value: unknown): CreatureCard | null {
  if (value == null || value === "") return null;
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const row = parsed as Record<string, unknown>;
  if (typeof row.name !== "string" || typeof row.type !== "string" || typeof row.rarity !== "string") {
    return null;
  }
  if (!isCreatureType(row.type) || !isRarity(row.rarity)) return null;
  const stats = (row.stats ?? {}) as Record<string, unknown>;
  let name = row.name.replace(/\s+/g, "").toLowerCase().slice(0, 13);
  while (name.endsWith("-")) name = name.slice(0, -1);
  return {
    name: name || "missingno",
    type: row.type,
    rarity: row.rarity,
    stats: {
      clarity: clampStat(stats.clarity),
      effort: clampStat(stats.effort),
      honesty: clampStat(stats.honesty),
      chaos: clampStat(stats.chaos),
    },
    flavor_text: typeof row.flavor_text === "string" ? row.flavor_text : "",
    original_message: typeof row.original_message === "string" ? row.original_message : "",
    source: "openrouter",
    model: typeof row.model === "string" ? row.model : "",
  };
}

function mapTrainer(row: TrainerRecord): TrainerRow {
  return {
    github_username: asString(row.github_username),
    github_id: row.github_id == null ? null : asNumber(row.github_id),
    avatar_url: row.avatar_url == null ? null : asString(row.avatar_url),
    persona_title: asString(row.persona_title),
    dominant_type: asString(row.dominant_type) as CreatureType,
    league: asString(row.league) as League,
    clarity: asNumber(row.clarity),
    effort: asNumber(row.effort),
    honesty: asNumber(row.honesty),
    chaos: asNumber(row.chaos),
    total_commits_analyzed: asNumber(row.total_commits_analyzed),
    predictions: parseJsonArray<Prediction>(row.predictions),
    sample_messages: parseJsonArray<string>(row.sample_messages),
    reel_commits: parseJsonArray<string>(row.reel_commits),
    featured_card: parseFeaturedCard(row.featured_card),
    featured_at: row.featured_at == null || row.featured_at === "" ? null : asString(row.featured_at),
    computed_at: asString(row.computed_at),
    created_at: asString(row.created_at),
  };
}

export async function getTrainer(username: string): Promise<TrainerRow | null> {
  const rows = await query<TrainerRecord>(
    `SELECT ${TRAINER_COLUMNS} FROM commitdex_trainers WHERE github_username = ? LIMIT 1`,
    [username.toLowerCase()],
  );
  return rows[0] ? mapTrainer(rows[0]) : null;
}

export async function listWanted(limit = 50): Promise<TrainerRow[]> {
  const rows = await query<TrainerRecord>(
    `SELECT ${TRAINER_COLUMNS} FROM commitdex_trainers ORDER BY chaos DESC, computed_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(mapTrainer);
}

export async function upsertTrainer(row: TrainerInsert): Promise<TrainerRow> {
  const now = row.computed_at;
  await query(
    `INSERT INTO commitdex_trainers (
      github_username, github_id, avatar_url, persona_title, dominant_type, league,
      clarity, effort, honesty, chaos, total_commits_analyzed, predictions, sample_messages,
      reel_commits, featured_card, featured_at, computed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(github_username) DO UPDATE SET
      github_id = excluded.github_id,
      avatar_url = excluded.avatar_url,
      persona_title = excluded.persona_title,
      dominant_type = excluded.dominant_type,
      league = excluded.league,
      clarity = excluded.clarity,
      effort = excluded.effort,
      honesty = excluded.honesty,
      chaos = excluded.chaos,
      total_commits_analyzed = excluded.total_commits_analyzed,
      predictions = CASE
        WHEN commitdex_trainers.predictions IS NOT NULL
          AND commitdex_trainers.predictions != '[]'
        THEN commitdex_trainers.predictions
        ELSE excluded.predictions
      END,
      sample_messages = excluded.sample_messages,
      reel_commits = excluded.reel_commits,
      featured_card = CASE
        WHEN commitdex_trainers.featured_card IS NOT NULL
          AND commitdex_trainers.featured_card != ''
        THEN commitdex_trainers.featured_card
        ELSE excluded.featured_card
      END,
      featured_at = CASE
        WHEN commitdex_trainers.featured_at IS NOT NULL
          AND commitdex_trainers.featured_at != ''
        THEN commitdex_trainers.featured_at
        ELSE excluded.featured_at
      END,
      computed_at = excluded.computed_at`,
    [
      row.github_username,
      row.github_id,
      row.avatar_url,
      row.persona_title,
      row.dominant_type,
      row.league,
      row.clarity,
      row.effort,
      row.honesty,
      row.chaos,
      row.total_commits_analyzed,
      JSON.stringify(row.predictions),
      JSON.stringify(row.sample_messages),
      JSON.stringify(row.reel_commits),
      row.featured_card ? JSON.stringify(row.featured_card) : null,
      row.featured_at,
      now,
      now,
    ],
  );
  const saved = await getTrainer(row.github_username);
  if (!saved) {
    throw new Error("Could not save trainer: empty response.");
  }
  return saved;
}

/**
 * Allot or replace the featured card.
 * - First pull: race-safe insert when featured_card is empty.
 * - Daily re-spin: pass `{ replace: true }` after eligibility checks; overwrites foil + featured_at.
 */
export async function allotFeaturedCard(
  username: string,
  card: CreatureCard,
  reel: string[],
  options?: { replace?: boolean },
): Promise<{ trainer: TrainerRow; locked: boolean }> {
  const handle = username.toLowerCase();
  const existing = await getTrainer(handle);
  if (!existing) {
    throw new Error("Scan this trainer before allotting a specimen.");
  }
  if (existing.featured_card && !options?.replace) {
    return { trainer: existing, locked: true };
  }

  const now = new Date().toISOString();
  if (options?.replace) {
    await query(
      `UPDATE commitdex_trainers
       SET featured_card = ?, featured_at = ?, reel_commits = ?
       WHERE github_username = ?`,
      [JSON.stringify(card), now, JSON.stringify(reel), handle],
    );
  } else {
    await query(
      `UPDATE commitdex_trainers
       SET featured_card = ?, featured_at = ?, reel_commits = ?
       WHERE github_username = ?
         AND (featured_card IS NULL OR featured_card = '')`,
      [JSON.stringify(card), now, JSON.stringify(reel), handle],
    );
  }

  const saved = await getTrainer(handle);
  if (!saved) {
    throw new Error("Could not save the allotted card.");
  }
  return {
    trainer: saved,
    locked: !options?.replace && saved.featured_card?.original_message !== card.original_message,
  };
}
