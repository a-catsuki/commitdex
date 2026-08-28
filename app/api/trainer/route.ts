import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { classifyProfile } from "@/lib/classify-profile";
import { curateCommits, curateCommitsForSpin } from "@/lib/curate";
import { getTrainer, toPublicTrainer, type TrainerRow, upsertTrainer } from "@/lib/db";
import { fetchGithubUser, fetchPublicCommits, normalizeUsername, type GitHubCommit } from "@/lib/github";
import { sessionMatchesTrainer } from "@/lib/github-auth";
import { leagueFor } from "@/lib/league";
import { COPY, jsonError, jsonFromError } from "@/lib/public-error";
import { clientKey, rateLimited } from "@/lib/rate-limit";
import { evaluateSpinEligibility, isNewUtcDaySince } from "@/lib/spin-eligibility";

export const runtime = "nodejs";
export const maxDuration = 60;

const CACHE_MS = 24 * 60 * 60 * 1000;

function spinFlagsForTrainer(
  featuredCard: boolean,
  featuredAt: string | null,
  commits: GitHubCommit[] | null,
) {
  const eligibility = evaluateSpinEligibility(featuredAt, featuredCard, commits);
  return {
    canSpin: eligibility.canSpin,
    spinLockedReason: eligibility.spinLockedReason,
    locked: featuredCard && !eligibility.canSpin,
  };
}

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

  const session = await auth();
  const login = session?.login ?? session?.user?.login;
  const canClaim = sessionMatchesTrainer(login, username);

  if (!process.env.OPENROUTER_API_KEY) {
    return jsonError(503, COPY.classifyOffline);
  }

  try {
    const existing = await getTrainer(username);
    const fresh =
      existing && Date.now() - new Date(existing.computed_at).getTime() < CACHE_MS;

    if (existing && fresh) {
      let commits: GitHubCommit[] | null = null;
      const hasFoil = Boolean(existing.featured_card);

      // Same UTC day: no GitHub call. New day with foil: fetch to check newer commits.
      if (hasFoil && existing.featured_at && !isNewUtcDaySince(existing.featured_at)) {
        const reel =
          existing.reel_commits.length > 0 ? existing.reel_commits : existing.sample_messages;
        return NextResponse.json({
          trainer: toPublicTrainer(existing),
          cached: true,
          reel,
          saved: true,
          locked: true,
          canSpin: false,
          spinLockedReason: COPY.alreadyPulledToday,
        });
      }

      if (hasFoil) {
        try {
          commits = await fetchPublicCommits(existing.github_username, 100);
        } catch {
          commits = null;
        }
      }

      const flags = spinFlagsForTrainer(hasFoil, existing.featured_at, commits);
      const reel =
        commits && hasFoil
          ? curateCommitsForSpin(commits, existing.featured_at)
          : existing.reel_commits.length > 0
            ? existing.reel_commits
            : existing.sample_messages;

      return NextResponse.json({
        trainer: toPublicTrainer(existing),
        cached: true,
        reel: reel.length > 0 ? reel : existing.sample_messages,
        saved: true,
        ...flags,
      });
    }

    const user = await fetchGithubUser(username);
    const commits = await fetchPublicCommits(user.login, 100);
    const draft = await classifyProfile(commits);
    const now = new Date().toISOString();
    const predictions =
      existing && existing.predictions.length > 0 ? existing.predictions : draft.predictions;
    const messages = commits.map((c) => c.message);
    const hasFoil = Boolean(existing?.featured_card);
    const reel = hasFoil
      ? curateCommitsForSpin(commits, existing?.featured_at)
      : curateCommits(messages);

    const candidate: TrainerRow = {
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
      photo_url: existing?.photo_url ?? null,
      photo_data: existing?.photo_data ?? null,
      photo_updated_at: existing?.photo_updated_at ?? null,
      computed_at: now,
      created_at: existing?.created_at ?? now,
    };
    const trainer = canClaim ? await upsertTrainer(candidate) : candidate;
    const saved = Boolean(existing) || canClaim;

    const flags = spinFlagsForTrainer(
      Boolean(trainer.featured_card),
      trainer.featured_at,
      commits,
    );

    return NextResponse.json({
      trainer: toPublicTrainer(trainer),
      cached: false,
      reel: trainer.reel_commits,
      saved,
      ...flags,
    });
  } catch (error) {
    return jsonFromError(error, "trainer");
  }
}
