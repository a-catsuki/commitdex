-- wrangler d1 execute commitdex --remote --file=d1/migrations/0002_featured_card.sql
-- SQLite/D1 cannot ADD COLUMN IF NOT EXISTS; skip if the column already exists.

ALTER TABLE commitdex_trainers ADD COLUMN reel_commits TEXT;
ALTER TABLE commitdex_trainers ADD COLUMN featured_card TEXT;
ALTER TABLE commitdex_trainers ADD COLUMN featured_at TEXT;
