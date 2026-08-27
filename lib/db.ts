import { query } from "./d1";
import type { League } from "./league";
import type { CreatureType } from "./types";

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
  computed_at: unknown;
  created_at: unknown;
};

const TRAINER_COLUMNS =
  "github_username, github_id, avatar_url, persona_title, dominant_type, league, clarity, effort, honesty, chaos, total_commits_analyzed, predictions, sample_messages, computed_at, created_at";

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
      computed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
