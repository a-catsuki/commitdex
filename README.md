# Commitdex

A Pokedex for git commit messages. Paste a commit, get a roasted collectible creature card. Scan a GitHub username, meet the trainer behind the messages, and see who made the Most Wanted wall.

## Run it locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

On PowerShell, the copy step is:

```powershell
Copy-Item .env.example .env.local
```

Open [http://localhost:3000](http://localhost:3000). Fill in `OPENROUTER_API_KEY` before trying a card or trainer scan. Local SQLite is the default, so Cloudflare setup can wait.

## Vercel Analytics

Analytics is wired into the root layout with `@vercel/analytics`. After deployment, view traffic in your Vercel project’s **Analytics** tab; local development may not show data.

## What’s in the dex

- **Commit → creature:** OpenRouter turns one commit message into a typed, statted, rarity-tagged roast. Names are capped at 13 characters, flavor punchlines are rendered in full, and the creature art is a procedural seeded SVG: same card identity, same little weirdo.
- **Trainer scan:** Scan a public GitHub username for a profile, predictions, a daily pick, and a reel of commit messages.
- **Most Wanted:** Trainers are ranked by chaos on `/wanted`.
- **Verified pulls:** Anonymous scans are previews. GitHub OAuth is required to claim and persist a trainer, crank the reel, and add a mugshot. The signed-in GitHub login must match the scanned username.
- **Photobooth:** A completely optional CRT-style webcam mugshot, with client-side screening before storage.
- **Tiny print shop:** Download a generated card as a PNG from the workbench.

## Environment variables

`.env.example` is the source of truth. Add values to `.env.local`; never put secret values in this README.

### OpenRouter

- `OPENROUTER_API_KEY` — required for card and profile generation. Credits, key limits, and model availability can affect generation.
- `OPENROUTER_MODEL` — optional model override. The default is `deepseek/deepseek-v4-flash`; use a requestable instruct/chat model, not a safety-only or moderation model.

### GitHub Auth

- `AUTH_SECRET` — Auth.js session secret. For example: `openssl rand -base64 32`.
- `AUTH_GITHUB_ID` — GitHub OAuth App client ID.
- `AUTH_GITHUB_SECRET` — GitHub OAuth App client secret.
- `AUTH_URL` — optional local Auth.js URL; usually inferred.

To enable claims locally, create a [GitHub OAuth App](https://github.com/settings/developers):

1. Set the homepage to `http://localhost:3000`.
2. Set the callback to `http://localhost:3000/api/auth/callback/github`.
3. For production, substitute your real domain, for example `https://YOUR_DOMAIN/api/auth/callback/github`.
4. Put the client ID and secret in `.env.local`.

### Cloudflare D1

- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID.
- `CLOUDFLARE_API_TOKEN` — token with D1 edit permission.
- `CLOUDFLARE_D1_TOKEN` — accepted alias for `CLOUDFLARE_API_TOKEN`.
- `CLOUDFLARE_D1_DATABASE_ID` — the remote D1 database ID.
- `COMMITDEX_SQLITE_PATH` — optional local SQLite path override.

Create the remote database once:

```bash
npx wrangler d1 create commitdex
npx wrangler d1 execute commitdex --remote --file=d1/schema.sql
# Existing databases also need:
npx wrangler d1 execute commitdex --remote --file=d1/migrations/0002_featured_card.sql
npx wrangler d1 execute commitdex --remote --file=d1/migrations/0003_trainer_photo.sql
# Duplicate-column errors mean those columns are already present.
```

Put the printed account and database IDs into `.env.local`. `next dev` talks to D1 over Cloudflare’s HTTP query API; Workers are not required.

### GitHub API

- `GITHUB_TOKEN` — optional personal access token. It raises GitHub’s API rate limit above the anonymous limit, which is useful for repeated trainer scans.

### Optional R2 mugshot storage

- `R2_BUCKET` — Cloudflare R2 bucket name.
- `R2_PUBLIC_BASE_URL` — public bucket URL or custom domain.
- `CLOUDFLARE_R2_TOKEN` — optional R2 token; falls back to `CLOUDFLARE_API_TOKEN`.

R2 is used when the R2 bucket, public URL, account ID, and a Cloudflare token are all present. Otherwise photos use local files when D1 is absent, or a base64 JPEG/WebP blob in D1 when remote D1 is configured.

## Routes

- `/` — classify one commit and print its creature card
- `/wanted` — Most Wanted, ranked by chaos
- `/t/[username]` — trainer dossier, daily pick, predictions, evidence, and optional mugshot
- `/art-lab` — creature art test gallery
- `POST /api/classify` — classify a commit message
- `POST /api/trainer` — scan a GitHub trainer
- `POST /api/trainer/spin` — claim a daily reel pull
- `POST/DELETE /api/trainer/photo` — save or clear a mugshot
- `GET /api/trainer/photo/[username]` — serve local/D1 mugshot bytes

## Developer

### Project map

```text
app/
  page.tsx                         home page
  wanted/page.tsx                  Most Wanted wall
  t/[username]/page.tsx            trainer dossier
  art-lab/page.tsx                 creature art gallery
  api/{classify,trainer}/          server routes
components/
  Workbench.tsx                    commit input, print ritual, PNG export
  TrainerScan.tsx                  GitHub username scanner
  DexReel.tsx                      reel UI and pull interaction
  CreatureCard.tsx                 card shell and creature display
  Photobooth.tsx                   opt-in camera flow
lib/
  classify*.ts, openrouter.ts      model calls and response normalization
  creature-draw.ts                 seeded creature genome/art inputs
  github.ts                        public GitHub user and commit lookups
  db.ts, d1.ts, sql.ts             trainer persistence and schema bootstrapping
  photo-store.ts, nsfw-client.ts   photo backends and browser screening
  public-error.ts                  sanitized API error responses
d1/
  schema.sql                       baseline D1 schema
  migrations/                      additive D1 migrations
auth.ts                             GitHub OAuth/Auth.js configuration
```

### How the flows work

1. **Classify:** the workbench sends a trimmed message (up to 500 characters) to `POST /api/classify`. The server makes one OpenRouter request, validates the JSON, clamps the name/stats/flavor, and returns the card. Art is generated locally from a seed derived from the card identity.
2. **Profile:** `POST /api/trainer` normalizes the handle, fetches the GitHub user and up to 100 public commit messages with timestamps, then asks OpenRouter for a profile. A matching signed-in GitHub login may save it; an anonymous scan can preview it only.
3. **Spin:** a matching OAuth session is required. The server checks the UTC-day lock and newer public commits, picks a curated reel message, makes one card request for the landed message, and stores the featured foil. Re-spins do not clear the mugshot.
4. **Photo:** after a foil exists, the owner can open the optional photobooth. The browser captures a square 512px frame, screens a 224px downscale with `nsfwjs`/TensorFlow.js MobileNetV2, then uploads only an accepted JPEG/WebP under about 300KB. The camera requires HTTPS or localhost and can always be skipped.

### Local data and schema notes

With complete D1 credentials, trainer data uses remote Cloudflare D1. Without them, the app uses `data/commitdex.local.sqlite` through Node SQLite; override it with `COMMITDEX_SQLITE_PATH`. The local database and `data/photos/` are ignored by git.

`d1/schema.sql` is the baseline schema. Existing databases need the additive migrations in `d1/migrations/`. The runtime also ensures the baseline and photo/foil columns on startup and tolerates duplicate-column errors, but run the Wrangler commands above for a remote database.

### Commands

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

### A couple of sharp edges

- OpenRouter gets one HTTP request per user action: no automatic retries, fallback model chain, or hidden second pass. If the model is busy, credits run out, or availability changes, retry manually after fixing the issue.
- API routes log detailed failures server-side but return short, Commitdex-voice public errors. Keep API keys and OAuth secrets in environment variables.

## Privacy and safety

Trainer scans use public GitHub commit messages and timestamps, not diffs. Profile prompts are grounded in that public batch and are jokes, not surveillance; they should not infer sensitive traits. Mugshots are opt-in, camera access is never forced, and rejected frames do not reach storage because screening happens in the browser first. Keep all secrets out of commits and documentation.
