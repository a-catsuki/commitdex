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

- `OPENROUTER_API_KEY` — required. Cards and trainer profiles are invented by a free open-source model on [OpenRouter](https://openrouter.ai/keys) (default `google/gemma-4-31b-it:free`). There is no canned-name fallback.
- `OPENROUTER_MODEL` — optional override. Use an instruction `:free` model id, not a content-safety / moderation model.
- `GITHUB_TOKEN` — optional PAT. Raises GitHub rate limits above 60 requests/hour. Trainer scans fail with a clear message if GitHub rate-limits the anonymous IP.

Trainer persistence is Cloudflare D1 (SQLite), not Supabase:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` (D1 edit permission; `CLOUDFLARE_D1_TOKEN` is an alias)
- `CLOUDFLARE_D1_DATABASE_ID`

Create the remote database once:

```bash
npx wrangler d1 create commitdex
npx wrangler d1 execute commitdex --remote --file=d1/schema.sql
```

Put the printed account and database ids into `.env.local`. `next dev` talks to D1 over the HTTP query API, so you do not need Workers.

If those three vars are missing, the app uses `data/commitdex.local.sqlite` (same SQL as D1) so classify and trainer scans still work on Windows. Override the path with `COMMITDEX_SQLITE_PATH` if you want.

## Routes

- `/` classify a single commit
- `/wanted` Most Wanted, ranked by chaos
- `/t/[username]` trainer dossier
