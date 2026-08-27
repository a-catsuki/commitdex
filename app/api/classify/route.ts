import { NextResponse } from "next/server";
import { classifyCommit } from "@/lib/classify";
import { COPY, jsonError, jsonFromError } from "@/lib/public-error";
import { clientKey, rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGE_LENGTH = 500;

export async function POST(request: Request) {
  if (rateLimited(clientKey(request), 20)) {
    return jsonError(429, COPY.tooManyPrints);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, COPY.badJson);
  }

  const message =
    typeof body === "object" && body !== null && "message" in body
      ? String((body as { message: unknown }).message ?? "").trim()
      : "";

  if (!message) {
    return jsonError(400, COPY.emptyCommit);
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return jsonError(400, COPY.messageTooLong);
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return jsonError(503, COPY.classifyOffline);
  }

  try {
    const card = await classifyCommit(message);
    return NextResponse.json(card);
  } catch (error) {
    return jsonFromError(error, "classify");
  }
}
