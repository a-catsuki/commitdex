import { NextResponse } from "next/server";
import { classifyProfile } from "@/lib/classify-profile";
import { curateCommits } from "@/lib/curate";
import { getTrainer, upsertTrainer } from "@/lib/db";
import { fetchGithubUser, fetchPublicCommits, normalizeUsername } from "@/lib/github";
import { leagueFor } from "@/lib/league";
import { COPY, jsonError, jsonFromError } from "@/lib/public-error";
import { clientKey, rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const CACHE_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  if (rateLimited(`trainer:${clientKey(request)}`, 6, 10 * 60 * 1000)) {
    return jsonError(429, COPY.tooManyScans);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, COPY.badJson);
  }

  const raw =
    typeof body === "object" && body !== null && "username" in body
      ? String((body as { username: unknown }).username ?? "")
      : "";
  const username = normalizeUsername(raw);
  if (!username) {
    return jsonError(400, COPY.badUsername);
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return jsonError(503, COPY.classifyOffline);
  }

  try {
    const existing = await getTrainer(username);
    const fresh =
      existing && Date.now() - new Date(existing.computed_at).getTime() < CACHE_MS;
    if (existing && fresh) {
      return NextResponse.json({
        trainer: existing,
        cached: true,
        reel: existing.reel_commits.length > 0 ? existing.reel_commits : existing.sample_messages,
        locked: Boolean(existing.featured_card),
      });
    }

    const user = await fetchGithubUser(username);
    const commits = await fetchPublicCommits(user.login, 100);
    const draft = await classifyProfile(commits);
    const now = new Date().toISOString();
    const predictions =
      existing && existing.predictions.length > 0 ? existing.predictions : draft.predictions;
    const messages = commits.map((c) => c.message);
    const reel = curateCommits(messages);

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
      sample_messages: messages.slice(0, 8),
      reel_commits: reel,
      featured_card: existing?.featured_card ?? null,
      featured_at: existing?.featured_at ?? null,
      computed_at: now,
    });

    return NextResponse.json({
      trainer,
      cached: false,
      reel: trainer.reel_commits,
      locked: Boolean(trainer.featured_card),
    });
  } catch (error) {
    return jsonFromError(error, "trainer");
  }
}
