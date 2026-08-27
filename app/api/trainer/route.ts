import { NextResponse } from "next/server";
import { classifyProfile } from "@/lib/classify-profile";
import { getTrainer, upsertTrainer } from "@/lib/db";
import { fetchGithubUser, fetchPublicCommits, normalizeUsername } from "@/lib/github";
import { leagueFor } from "@/lib/league";
import { MODEL_JSON_ERROR } from "@/lib/openrouter";
import { clientKey, rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const CACHE_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  if (rateLimited(`trainer:${clientKey(request)}`, 6, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many scans from this address. Wait a bit, then try another trainer." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Send { username: string } as JSON." },
      { status: 400 },
    );
  }

  const raw =
    typeof body === "object" && body !== null && "username" in body
      ? String((body as { username: unknown }).username ?? "")
      : "";
  const username = normalizeUsername(raw);
  if (!username) {
    return NextResponse.json(
      { error: "That is not a GitHub username. Letters, numbers, and hyphens only." },
      { status: 400 },
    );
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Trainer scans need a free OpenRouter model. Add OPENROUTER_API_KEY to .env.local, then retry.",
      },
      { status: 503 },
    );
  }

  try {
    const existing = await getTrainer(username);
    const fresh =
      existing && Date.now() - new Date(existing.computed_at).getTime() < CACHE_MS;
    if (existing && fresh) {
      return NextResponse.json({ trainer: existing, cached: true });
    }

    const user = await fetchGithubUser(username);
    const commits = await fetchPublicCommits(user.login, 100);
    const draft = await classifyProfile(commits);
    const now = new Date().toISOString();
    const predictions =
      existing && existing.predictions.length > 0 ? existing.predictions : draft.predictions;

    const trainer = await upsertTrainer({
      github_username: user.login.toLowerCase(),
      github_id: user.id,
      avatar_url: user.avatarUrl,
      persona_title: draft.persona_title,
      dominant_type: draft.dominant_type,
      league: leagueFor(commits.length),
      clarity: draft.stats.clarity,
      effort: draft.stats.effort,
      honesty: draft.stats.honesty,
      chaos: draft.stats.chaos,
      total_commits_analyzed: commits.length,
      predictions,
      sample_messages: commits.slice(0, 8).map((c) => c.message),
      computed_at: now,
    });

    return NextResponse.json({ trainer, cached: false });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    if (/no public user|No public commit/i.test(detail)) {
      return NextResponse.json({ error: detail }, { status: 404 });
    }
    if (/rate-limiting this lookup|GITHUB_TOKEN|rejected the credentials/i.test(detail)) {
      return NextResponse.json({ error: detail }, { status: 429 });
    }
    if (
      /Unexpected token|not valid JSON|did not return a card or trainer|safety filter/i.test(
        detail,
      )
    ) {
      return NextResponse.json({ error: MODEL_JSON_ERROR }, { status: 502 });
    }
    if (/D1 is not configured|Could not query D1|SQLITE|EACCES|EPERM/i.test(detail)) {
      return NextResponse.json(
        {
          error:
            "Trainer storage is unavailable. Set Cloudflare D1 env vars, or check that local SQLite in data/ is writable.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
