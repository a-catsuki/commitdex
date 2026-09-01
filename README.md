# Commitdex

**A Pokédex for git commit messages.** Paste a commit, get a roasted collectible creature card. Scan a GitHub username to meet the trainer behind the messages, spin the daily reel, and climb the Most Wanted wall.

> **Live demo:** Deploy your own instance — no public production URL is configured in this repository. See [Deployment](#deployment).

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)](https://tailwindcss.com/)

---

## Features

- **Commit → creature** — OpenRouter turns a commit message into a typed, statted, rarity-tagged roast. Names cap at 13 characters; creature art is a procedural seeded SVG (same identity, same weirdo).
- **Trainer scan** — Enter a public GitHub username for a dossier: persona, stats, predictions, sample commits, and a reel of evidence.
- **Most Wanted** — Trainers ranked by chaos on `/wanted`.
- **Dex Reel** — Claimed trainers can spin once per UTC day for a featured foil card pulled from their public commit history.
- **Verified pulls** — Anonymous scans are previews only. GitHub OAuth is required to claim and persist a trainer, spin the reel, and add a mugshot. The signed-in GitHub login **must match** the scanned username.
- **Photobooth** — Optional CRT-style webcam mugshot with client-side NSFW screening before upload.
- **Print shop** — Export a generated card as PNG from the workbench.
- **Persistent profiles** — Cloudflare D1 in production; local SQLite fallback for development without Cloudflare credentials.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| UI | [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/) |
| Auth | [Auth.js](https://authjs.dev/) (`next-auth` v5) — GitHub OAuth |
| LLM | [OpenRouter](https://openrouter.ai/) — default model `deepseek/deepseek-v4-flash` |
| Database | [Cloudflare D1](https://developers.cloudflare.com/d1/) (HTTP API) or local SQLite |
| Storage | Optional [Cloudflare R2](https://developers.cloudflare.com/r2/) for trainer mugshots |
| GitHub | [Octokit](https://github.com/octokit/octokit.js) — public user & commit lookups |
| Analytics | [@vercel/analytics](https://vercel.com/docs/analytics) |
| Client ML | TensorFlow.js + NSFWJS (photobooth screening), MediaPipe FaceLandmarker (optional face tracking) |

---

## Getting started

### Prerequisites

- **Node.js 20+**
- **OpenRouter API key** — required for card and trainer generation
- **GitHub OAuth App** — required only for claiming trainers and using the photobooth
- **Cloudflare account** — optional; without D1 credentials the app uses local SQLite

### Install

```bash
git clone https://github.com/a-catsuki/commitdex.git
cd commitdex
npm install
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
```

Set at minimum `OPENROUTER_API_KEY` in `.env.local`, then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Local development defaults to `data/commitdex.local.sqlite` — Cloudflare setup can wait until you deploy.

---

## Environment variables

Copy `.env.example` to `.env.local`. Never commit secrets.

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for card and profile generation |
| `OPENROUTER_MODEL` | No | Model override (default: `deepseek/deepseek-v4-flash`). Use a requestable instruct/chat model, not a safety-only model |
| `OPENROUTER_CLASSIFY_MODEL` | No | Optional pin for classify-only requests; falls back to `OPENROUTER_MODEL` |
| `OPENROUTER_HTTP_REFERER` | No | Referer header sent to OpenRouter (default: `https://commitdex.local`) |
| `GITHUB_TOKEN` | No | Personal access token — raises GitHub API rate limits for repeated scans |
| `AUTH_SECRET` | For claims | Auth.js session secret (`openssl rand -base64 32`) |
| `AUTH_GITHUB_ID` | For claims | GitHub OAuth App client ID |
| `AUTH_GITHUB_SECRET` | For claims | GitHub OAuth App client secret |
| `AUTH_URL` | No | Auth.js base URL; usually inferred from the host |
| `CLOUDFLARE_ACCOUNT_ID` | For D1 | Cloudflare account ID |
| `CLOUDFLARE_API_TOKEN` | For D1 | Token with D1 edit permission |
| `CLOUDFLARE_D1_TOKEN` | No | Accepted alias for `CLOUDFLARE_API_TOKEN` |
| `CLOUDFLARE_D1_DATABASE_ID` | For D1 | Remote D1 database ID |
| `COMMITDEX_SQLITE_PATH` | No | Override path for local SQLite file |
| `R2_BUCKET` | No | Cloudflare R2 bucket name for mugshot storage |
| `R2_PUBLIC_BASE_URL` | No | Public R2 URL or custom domain |
| `CLOUDFLARE_R2_TOKEN` | No | R2 token; falls back to `CLOUDFLARE_API_TOKEN` |

### GitHub OAuth setup

Create a [GitHub OAuth App](https://github.com/settings/developers):

1. **Homepage URL:** `http://localhost:3000` (or your deploy URL)
2. **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`
3. For production, use `https://YOUR_DOMAIN/api/auth/callback/github`
4. Copy the client ID and secret into `.env.local`

---

## Developer guide

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | Run ESLint |
| `npx tsc --noEmit` | Type-check without emitting |
| `npm run test:photobooth` | Photobooth coordinate unit tests |

### Cloudflare D1 setup

Create and migrate the remote database once:

```bash
npx wrangler d1 create commitdex
npx wrangler d1 execute commitdex --remote --file=d1/schema.sql

# Or apply migrations directory:
npx wrangler d1 migrations apply commitdex --remote
```

For existing databases that predate migrations, run additive files individually:

```bash
npx wrangler d1 execute commitdex --remote --file=d1/migrations/0002_featured_card.sql
npx wrangler d1 execute commitdex --remote --file=d1/migrations/0003_trainer_photo.sql
```

Duplicate-column errors mean those columns already exist — safe to ignore.

Add the printed account and database IDs to `.env.local`. `next dev` talks to D1 over Cloudflare's HTTP query API; Workers are not required.

**Local fallback:** Without complete D1 credentials, data is stored in `data/commitdex.local.sqlite`. Mugshots without R2 land in `data/photos/`. Both paths are gitignored.

### Project structure

```text
app/
  page.tsx                         Home — workbench + trainer scan
  wanted/page.tsx                  Most Wanted leaderboard
  t/[username]/page.tsx            Trainer dossier
  art-lab/page.tsx                 Creature art test gallery
  api/{classify,trainer}/          Server routes
components/
  Workbench.tsx                    Commit input, print ritual, PNG export
  TrainerScan.tsx                  GitHub username scanner
  DexReel.tsx                      Reel UI and daily pull
  CreatureCard.tsx                 Card shell and creature display
  Photobooth.tsx                   Opt-in camera flow
lib/
  classify*.ts, openrouter.ts      Model calls and response normalization
  creature-draw.ts                 Seeded creature genome / art inputs
  github.ts                        Public GitHub user and commit lookups
  db.ts, d1.ts, sql.ts             Trainer persistence and schema bootstrapping
  photo-store.ts, nsfw-client.ts   Photo backends and browser screening
  public-error.ts                  Sanitized API error responses
d1/
  schema.sql                       Baseline D1 schema
  migrations/                      Additive D1 migrations
auth.ts                            GitHub OAuth / Auth.js configuration
```

### How the flows work

1. **Classify** — The workbench sends a trimmed message (up to 500 characters) to `POST /api/classify`. The server makes one OpenRouter request, validates JSON, clamps name/stats/flavor, and returns the card. Art is generated locally from a seed derived from the card identity.

2. **Profile** — `POST /api/trainer` normalizes the handle, fetches the GitHub user and up to 100 public commit messages, then asks OpenRouter for a profile. A matching signed-in GitHub login may save it; anonymous scans are preview-only.

3. **Spin** — Requires a matching OAuth session. The server checks the UTC-day lock and newer public commits, picks a curated reel message, generates one card for the landed message, and stores the featured foil. Re-spins do not clear the mugshot.

4. **Photo** — After a foil exists, the owner can open the optional photobooth. The browser captures a 512px square frame, screens a 224px downscale with NSFWJS, then uploads only an accepted JPEG/WebP under ~300KB. Camera access requires HTTPS or localhost and can always be skipped.

### API routes

| Route | Method | Description |
| --- | --- | --- |
| `/api/classify` | POST | Classify a commit message into a creature card |
| `/api/trainer` | POST | Scan a GitHub trainer profile |
| `/api/trainer/spin` | POST | Claim a daily reel pull (auth required) |
| `/api/trainer/photo` | POST, DELETE | Save or clear a mugshot (auth required) |
| `/api/trainer/photo/[username]` | GET | Serve local/D1 mugshot bytes |
| `/api/auth/[...nextauth]` | * | Auth.js GitHub OAuth handlers |

### Pages

| Path | Description |
| --- | --- |
| `/` | Classify a commit and print its creature card |
| `/wanted` | Most Wanted — ranked by chaos |
| `/t/[username]` | Trainer dossier, daily pick, predictions, evidence, mugshot |
| `/art-lab` | Creature art test gallery |

---

## Deployment

Commitdex is designed to run on **Vercel** with **Cloudflare D1** for persistence.

1. Push the repository to GitHub and import it in Vercel.
2. Add all required environment variables in the Vercel project settings (mirror `.env.example`).
3. Set GitHub OAuth callback URLs to your production domain.
4. Provision Cloudflare D1 and run schema/migrations (see [Cloudflare D1 setup](#cloudflare-d1-setup)).
5. Optionally configure R2 for mugshot storage at scale.

`@vercel/analytics` is wired into the root layout. After deployment, view traffic in your Vercel project's **Analytics** tab; local development may not show data.

**Photo storage priority:** R2 (when fully configured) → local files (no D1) → compressed base64 blob in D1 (remote D1 without R2).

---

## Architecture

```text
Browser (React)
  │
  ├─ Workbench / TrainerScan / DexReel / Photobooth
  │
  ▼
Next.js App Router (API routes, Server Components)
  │
  ├─ Auth.js ────────────── GitHub OAuth (claim verification)
  ├─ OpenRouter ─────────── LLM classification & profiles
  ├─ Octokit ────────────── Public GitHub API (users, commits)
  └─ db layer ───────────── D1 HTTP API  OR  local SQLite
       │
       └─ photo-store ──── R2  OR  D1 blob  OR  local files
```

- **One OpenRouter request per user action** — no automatic retries, fallback model chain, or hidden second pass. If the model is busy or credits run out, retry manually after fixing the issue.
- **API routes** log detailed failures server-side but return short, on-brand public errors. Keep keys and OAuth secrets in environment variables only.

---

## Claim flow & limitations

| Scenario | Behavior |
| --- | --- |
| Anonymous trainer scan | Preview only — profile is **not** saved to the database |
| Signed in, username matches | Profile is persisted; reel spin and photobooth unlock |
| Signed in, username mismatch | Preview only — cannot claim someone else's profile |
| Daily reel spin | One pull per UTC day; requires an existing claimed profile |
| Mugshot | Requires a featured foil card; opt-in camera with browser-side screening |

Trainer scans use **public GitHub commit messages and timestamps**, not diffs. Profile prompts are grounded in that public batch and are jokes, not surveillance — they should not infer sensitive traits.

---

## Privacy & safety

- Mugshots are opt-in; camera access is never forced.
- Rejected photobooth frames do not reach storage — screening runs in the browser first.
- Keep all API keys, OAuth secrets, and Cloudflare tokens out of commits and documentation.
- The optional FaceLandmarker uses MediaPipe's browser WASM runtime. Its XNNPACK and OpenGL `INFO`/`WARN` lines are native delegate diagnostics, not app errors.

---

## Contributing

This repository is marked private in `package.json`. If you fork or receive access:

1. Open an issue before large changes.
2. Run `npm run lint` and `npx tsc --noEmit` before submitting.
3. Do not commit `.env.local`, `data/`, or secrets.

No `LICENSE` file is included — check with the repository owner before redistribution.

---

## Roadmap

Planned ideas live in [`FUTURE_TODO.md`](FUTURE_TODO.md) (Git Wrapped, photobooth filters, etc.). Shipped features are documented above; the TODO file is not a commitment.
