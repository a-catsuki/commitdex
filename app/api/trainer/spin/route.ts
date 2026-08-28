import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { classifyCommit } from "@/lib/classify";
import { curateCommits, curateCommitsForSpin } from "@/lib/curate";
import { allotFeaturedCard, getTrainer, toPublicTrainer, type TrainerRow } from "@/lib/db";
import { fetchPublicCommits, normalizeUsername, type GitHubCommit } from "@/lib/github";
import { sessionMatchesTrainer } from "@/lib/github-auth";
import { COPY, jsonError, jsonFromError } from "@/lib/public-error";
import { clientKey, rateLimited } from "@/lib/rate-limit";
import { evaluateSpinEligibility, isNewUtcDaySince } from "@/lib/spin-eligibility";

export const runtime = "nodejs";
export const maxDuration = 60;

function lockedSpinResponse(trainer: TrainerRow, reel: string[], reason: string) {
  return NextResponse.json({
    trainer: toPublicTrainer(trainer),
    card: trainer.featured_card,
    landed: trainer.featured_card?.original_message ?? "",
    reel,
    locked: true,
    canSpin: false,
    spinLockedReason: reason,
  });
}

function newerMessages(commits: GitHubCommit[], featuredAt: string): string[] {
  const pivot = new Date(featuredAt).getTime();
  if (Number.isNaN(pivot)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const commit of commits) {
    const at = new Date(commit.committedAt).getTime();
    if (Number.isNaN(at) || at <= pivot) continue;
    const key = commit.message.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(commit.message);
  }
  return out;
}

export async function POST(request: Request) {
  if (rateLimited(`trainer-spin:${clientKey(request)}`, 8, 10 * 60 * 1000)) {
    return jsonError(429, COPY.tooManyReels);
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
  if (!login) {
    return jsonError(401, COPY.verifyTrainer);
  }
  if (!sessionMatchesTrainer(login, username)) {
    return jsonError(403, COPY.trainerWrongAccount);
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return jsonError(503, COPY.classifyOffline);
  }

  try {
    const trainer = await getTrainer(username);
    if (!trainer) {
      return jsonError(404, COPY.scanFirst);
    }

    let commits: GitHubCommit[] | null = null;
    const replacing = Boolean(trainer.featured_card);

    if (replacing) {
      // Same UTC day: keep foil, skip GitHub + OpenRouter.
      if (!trainer.featured_at || !isNewUtcDaySince(trainer.featured_at)) {
        const reel =
          trainer.reel_commits.length > 0
            ? trainer.reel_commits
            : curateCommits(trainer.sample_messages);
        return lockedSpinResponse(trainer, reel, COPY.alreadyPulledToday);
      }

      try {
        commits = await fetchPublicCommits(trainer.github_username, 100);
      } catch {
        const reel =
          trainer.reel_commits.length > 0
            ? trainer.reel_commits
            : curateCommits(trainer.sample_messages);
        return lockedSpinResponse(trainer, reel, COPY.noNewSpecimens);
      }

      const eligibility = evaluateSpinEligibility(trainer.featured_at, true, commits);
      if (!eligibility.canSpin) {
        const reel = curateCommitsForSpin(commits, trainer.featured_at);
        return lockedSpinResponse(
          trainer,
          reel.length > 0 ? reel : trainer.reel_commits,
          eligibility.spinLockedReason ?? COPY.noNewSpecimens,
        );
      }
    }

    const reel = commits
      ? curateCommitsForSpin(commits, replacing ? trainer.featured_at : null)
      : trainer.reel_commits.length > 0
        ? trainer.reel_commits
        : curateCommits(trainer.sample_messages);

    if (reel.length === 0) {
      return jsonError(422, COPY.emptyReel);
    }

    let pool = reel;
    if (replacing && commits && trainer.featured_at) {
      const fresh = newerMessages(commits, trainer.featured_at);
      const onReel = reel.filter((m) => fresh.some((f) => f.toLowerCase() === m.toLowerCase()));
      if (onReel.length > 0) pool = onReel;
      else if (fresh.length > 0) pool = fresh;
    }

    const landed = pool[Math.floor(Math.random() * pool.length)];
    // One OpenRouter classify per successful crank — no retries.
    const card = await classifyCommit(landed);
    const saved = await allotFeaturedCard(username, card, reel, {
      replace: replacing,
    });

    return NextResponse.json({
      trainer: toPublicTrainer(saved.trainer),
      card: saved.trainer.featured_card ?? card,
      landed: saved.trainer.featured_card?.original_message ?? landed,
      reel,
      locked: false,
      canSpin: false,
      spinLockedReason: COPY.alreadyPulledToday,
    });
  } catch (error) {
    return jsonFromError(error, "spin");
  }
}
