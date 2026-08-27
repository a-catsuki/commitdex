import { NextResponse } from "next/server";
import { classifyCommit } from "@/lib/classify";
import { MODEL_JSON_ERROR } from "@/lib/openrouter";
import { clientKey, rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGE_LENGTH = 500;

export async function POST(request: Request) {
  if (rateLimited(clientKey(request), 20)) {
    return NextResponse.json(
      {
        error: "Too many specimens from this address. Wait a minute, then print again.",
      },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "That request was not JSON. Send { message: string }." },
      { status: 400 },
    );
  }

  const message =
    typeof body === "object" && body !== null && "message" in body
      ? String((body as { message: unknown }).message ?? "").trim()
      : "";

  if (!message) {
    return NextResponse.json(
      { error: "Empty commit. Type something after git commit -m, then print." },
      { status: 400 },
    );
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      {
        error: `That message is ${message.length} characters. Cut it to ${MAX_MESSAGE_LENGTH} or fewer.`,
      },
      { status: 400 },
    );
  }

  try {
    const card = await classifyCommit(message);
    return NextResponse.json(card);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    if (
      /Unexpected token|not valid JSON|did not return a card or trainer|safety filter/i.test(
        detail,
      )
    ) {
      return NextResponse.json({ error: MODEL_JSON_ERROR }, { status: 502 });
    }
    return NextResponse.json(
      {
        error: `The classifier failed (${detail}). Check OPENROUTER_API_KEY, or retry.`,
      },
      { status: 502 },
    );
  }
}
