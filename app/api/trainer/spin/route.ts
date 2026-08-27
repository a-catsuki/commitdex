import { NextResponse } from "next/server";
import { classifyCommit } from "@/lib/classify";
import { curateCommits } from "@/lib/curate";
import { allotFeaturedCard, getTrainer } from "@/lib/db";
import { normalizeUsername } from "@/lib/github";
import { COPY, jsonError, jsonFromError } from "@/lib/public-error";
import { clientKey, rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  if (!process.env.OPENROUTER_API_KEY) {
    return jsonError(503, COPY.classifyOffline);
  }

  try {
    const trainer = await getTrainer(username);
    if (!trainer) {
      return jsonError(404, COPY.scanFirst);
    }

    const reel =
      trainer.reel_commits.length > 0
        ? trainer.reel_commits
        : curateCommits(trainer.sample_messages);

    if (trainer.featured_card) {
      return NextResponse.json({
        trainer,
        card: trainer.featured_card,
        landed: trainer.featured_card.original_message,
        reel,
        locked: true,
      });
    }

    if (reel.length === 0) {
      return jsonError(422, COPY.emptyReel);
    }

    const landed = reel[Math.floor(Math.random() * reel.length)];
    const card = await classifyCommit(landed);
    const saved = await allotFeaturedCard(username, card, reel);

    return NextResponse.json({
      trainer: saved.trainer,
      card: saved.trainer.featured_card ?? card,
      landed: saved.trainer.featured_card?.original_message ?? landed,
      reel,
      locked: saved.locked,
    });
  } catch (error) {
    return jsonFromError(error, "spin");
  }
}
