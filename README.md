# Commitdex: a pokedex for git commit messages

A pokedex for git commit messages. Paste one line, get a roasted creature card.

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without `ANTHROPIC_API_KEY`, cards are classified by a local heuristic so you can still print and download. With a key, Claude writes the roast.

Optional: set `ANTHROPIC_MODEL` (defaults to `claude-sonnet-4-6`).
