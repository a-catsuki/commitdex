# Commitdex

A pokedex for git commit messages. Paste one line, get a roasted creature card. Scan a GitHub username for a trainer profile and a spot on Most Wanted.

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

- `OPENROUTER_API_KEY` — required. Cards and trainer profiles are invented by a free open-source model on [OpenRouter](https://openrouter.ai/keys) (default `google/gemma-4-26b-a4b-it:free`). There is no canned-name fallback.
- `OPENROUTER_MODEL` — optional override. Use an instruction `:free` model id, not a content-safety / moderation model.
- `GITHUB_TOKEN` — optional PAT. Raises GitHub rate limits above 60 requests/hour. Trainer scans fail with a clear message if GitHub rate-limits the anonymous IP.

#### GitHub verify (mugshots)

Mugshot upload requires Auth.js GitHub OAuth. Session `login` must match the trainer `github_username` (case-insensitive). `POST`/`DELETE` `/api/trainer/photo` enforce this server-side.

1. Create a GitHub OAuth App at [Developer settings](https://github.com/settings/developers) → **New OAuth App**.
2. Homepage URL: `http://localhost:3000` (or your production origin).
3. Authorization callback URL:
   - Local: `http://localhost:3000/api/auth/callback/github`
   - Prod: `https://YOUR_DOMAIN/api/auth/callback/github`
4. Copy Client ID / Client Secret into `.env.local`:

```bash
AUTH_SECRET=          # openssl rand -base64 32
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
# AUTH_URL=http://localhost:3000   # optional
```

Nav shows `--verify-github` / `@login` + `--logout`. Unauthenticated users see “Verify with GitHub to add a mugshot” instead of the booth.

Trainer persistence is Cloudflare D1 (SQLite), not Supabase:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` (D1 edit permission; `CLOUDFLARE_D1_TOKEN` is an alias)
- `CLOUDFLARE_D1_DATABASE_ID`

Create the remote database once:

```bash
npx wrangler d1 create commitdex
npx wrangler d1 execute commitdex --remote --file=d1/schema.sql
# Existing databases also need:
npx wrangler d1 execute commitdex --remote --file=d1/migrations/0002_featured_card.sql
npx wrangler d1 execute commitdex --remote --file=d1/migrations/0003_trainer_photo.sql
# Duplicate-column errors mean those columns are already present.
```

Put the printed account and database ids into `.env.local`. `next dev` talks to D1 over the HTTP query API, so you do not need Workers.

If those three vars are missing, the app uses `data/commitdex.local.sqlite` (same SQL as D1) so classify and trainer scans still work on Windows. Override the path with `COMMITDEX_SQLITE_PATH` if you want.

### Trainer photobooth (optional)

After a foil allotment (or on the dossier when a foil exists), trainers can opt in to a CRT webcam mugshot. Camera is never forced; skip always works. Webcam requires HTTPS or localhost (`getUserMedia`).

Storage backend (automatic):

1. **R2** if `R2_BUCKET` + `R2_PUBLIC_BASE_URL` (+ Cloudflare account/token) are set
2. Else **local files** at `data/photos/{username}.jpg` when D1 credentials are absent
3. Else **D1 blob** in `photo_data` (base64 JPEG/WebP, client-resized to 512px, capped ~300KB)

Metadata columns: `photo_url`, `photo_data`, `photo_updated_at`. Re-spins / daily foil updates do **not** clear the mugshot; only retake or remove does.

NSFW: client-side `nsfwjs` (TensorFlow.js **MobileNetV2**, WebGL backend) screens a **224px** downscale before upload. The model is a singleton, prefetched when the booth opens (and on idle after foil for verified owners). Rejected images never hit storage.

## Routes

- `/` classify a single commit
- `/wanted` Most Wanted, ranked by chaos
- `/t/[username]` trainer dossier (mugshot + optional photobooth when a foil exists)
- `POST/DELETE /api/trainer/photo` save or clear mugshot
- `GET /api/trainer/photo/[username]` serve local/D1 mugshot bytes
