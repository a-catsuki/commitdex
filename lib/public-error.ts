import { NextResponse } from "next/server";

export type ErrorKind = "classify" | "trainer" | "spin";

export type PublicError = {
  status: number;
  message: string;
};

/** Short Commitdex-voice copy. Safe for JSON responses and UI. */
export const COPY = {
  badJson: "That request was garbled. Send it as JSON.",
  emptyCommit: "Empty commit. Type something after git commit -m, then print.",
  messageTooLong: "That commit is too long. Cut it to 500 characters.",
  badUsername: "That is not a GitHub username. Letters, numbers, and hyphens only.",
  tooManyPrints: "Too many specimens. Wait a minute, then print again.",
  tooManyScans: "Too many scans. Wait a bit.",
  tooManyReels: "Too many reels. Wait a bit.",
  trainerNotFound: "That trainer could not be found.",
  noCommits: "No public commit messages on file for that trainer.",
  scanFirst: "Scan this trainer before cranking the reel.",
  emptyReel: "The reel is empty. Scan this trainer again.",
  alreadyPulledToday: "Already pulled today.",
  noNewSpecimens: "No new specimens since last pull.",
  githubBusy: "GitHub is catching its breath. Wait a minute, then scan again.",
  classifyOffline: "Classifier is offline. Try again later.",
  openRouterCredits:
    "OpenRouter is out of credits for this key. Add funds or raise the key limit, then retry.",
  badModel:
    "Classifier model is misconfigured. Set OPENROUTER_MODEL to a real OpenRouter id (e.g. deepseek/deepseek-v4-flash), then restart.",
  archiveOffline: "Trainer archive is offline. Try again later.",
  wantedOffline: "Most Wanted is offline. Try again in a minute.",
  jam: "The pokedex jammed. Try again in a minute.",
  gibberish: "The classifier mumbled. Print again.",
  reelJam: "The reel jammed. Try again in a minute.",
  network: "The pokedex jammed. Try again in a minute.",
} as const;

function detailOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

export function toPublicError(error: unknown, kind: ErrorKind): PublicError {
  console.error(`[commitdex:${kind}]`, error);

  const detail = detailOf(error);

  if (/OPENROUTER_API_KEY is missing|classifier is offline/i.test(detail)) {
    return { status: 503, message: COPY.classifyOffline };
  }
  if (/key limit exceeded|out of credits/i.test(detail)) {
    return { status: 402, message: COPY.openRouterCredits };
  }
  if (/model id is invalid|not a valid model|OPENROUTER_MODEL/i.test(detail)) {
    return { status: 503, message: COPY.badModel };
  }
  if (
    /D1 is not configured|Could not query D1|SQLITE|EACCES|EPERM|not writable|archive is offline/i.test(
      detail,
    )
  ) {
    return { status: 503, message: COPY.archiveOffline };
  }
  if (/no public user/i.test(detail)) {
    return { status: 404, message: COPY.trainerNotFound };
  }
  if (/No public commit/i.test(detail)) {
    return { status: 404, message: COPY.noCommits };
  }
  if (/Scan this trainer before/i.test(detail)) {
    return { status: 404, message: COPY.scanFirst };
  }
  if (/rate-limiting this lookup|GITHUB_TOKEN|rejected the credentials|API rate limit/i.test(detail)) {
    return { status: 429, message: COPY.githubBusy };
  }
  if (/busy|timed out|timeout|AbortError/i.test(detail)) {
    return { status: 502, message: kind === "spin" ? COPY.reelJam : COPY.jam };
  }
  if (
    /Unexpected token|not valid JSON|did not return a card or trainer|safety filter|User Safety|too few predictions/i.test(
      detail,
    )
  ) {
    return { status: 502, message: kind === "spin" ? COPY.reelJam : COPY.gibberish };
  }

  return { status: 502, message: kind === "spin" ? COPY.reelJam : COPY.jam };
}

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function jsonFromError(error: unknown, kind: ErrorKind): NextResponse {
  const { status, message } = toPublicError(error, kind);
  return jsonError(status, message);
}
