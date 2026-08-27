-- Commitdex trainer profiles for the Most Wanted wall.
-- Apply remotely:
--   npx wrangler d1 create commitdex
--   npx wrangler d1 execute commitdex --remote --file=d1/schema.sql
-- Local Next.js (no Cloudflare credentials) uses the same SQL via node:sqlite.

CREATE TABLE IF NOT EXISTS commitdex_trainers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_username TEXT NOT NULL UNIQUE,
  github_id INTEGER,
  avatar_url TEXT,
  persona_title TEXT NOT NULL,
  dominant_type TEXT NOT NULL,
  league TEXT NOT NULL,
  clarity INTEGER NOT NULL,
  effort INTEGER NOT NULL,
  honesty INTEGER NOT NULL,
  chaos INTEGER NOT NULL,
  total_commits_analyzed INTEGER NOT NULL,
  predictions TEXT NOT NULL DEFAULT '[]',
  sample_messages TEXT NOT NULL DEFAULT '[]',
  computed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS commitdex_trainers_chaos_idx
  ON commitdex_trainers (chaos DESC, computed_at DESC);
