import { NextResponse } from "next/server";
import { classifyCommit } from "@/lib/classify";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_MESSAGE_LENGTH = 500;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function clientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

export async function POST(request: Request) {
  if (rateLimited(clientKey(request))) {
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
    return NextResponse.json(
      {
        error: `The classifier failed (${detail}). Check ANTHROPIC_API_KEY, or retry.`,
      },
      { status: 502 },
    );
  }
}
