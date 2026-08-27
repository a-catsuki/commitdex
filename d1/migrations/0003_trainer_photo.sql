-- wrangler d1 execute commitdex --remote --file=d1/migrations/0003_trainer_photo.sql
-- SQLite/D1 cannot ADD COLUMN IF NOT EXISTS; skip if the column already exists.

ALTER TABLE commitdex_trainers ADD COLUMN photo_url TEXT;
ALTER TABLE commitdex_trainers ADD COLUMN photo_data TEXT;
ALTER TABLE commitdex_trainers ADD COLUMN photo_updated_at TEXT;
