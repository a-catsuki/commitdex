export const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL?.trim() || "nvidia/nemotron-3.5-lightning:free";

const SAFETY_MODEL =
  /content[-_]?safety|llama-guard|prompt-guard|moderation|shield[-_]?gemma|nemotron[-_].*safety|safety[-_]?model/i;

function isRouterModel(id: string): boolean {
  return id === "openrouter/free" || id === "openrouter/auto";
}

/** Models we will not accept a reply from, even if a router selected them. */
export function isSafetyModel(modelId: string): boolean {
  const id = modelId.trim().toLowerCase();
  if (!id) return true;
  if (id.includes("content-safety") || id.includes("llama-guard") || id.includes("prompt-guard")) {
    return true;
  }
  if (id.includes("safety") && !id.includes("lightning")) return true;
  return SAFETY_MODEL.test(id);
}

/** Models we are willing to *request*. Routers are allowed; safety-only ids are not. */
export function isRequestableModel(modelId: string): boolean {
  const id = modelId.trim().toLowerCase();
  if (!id) return false;
  if (isRouterModel(id)) return true;
  return !isSafetyModel(id);
}

/** Capable-but-fast :free instruct models. No safety/moderation. No giant slow MoE. */
const FAST_INSTRUCT = [
  "nvidia/nemotron-3.5-lightning:free",
  "minimax/minimax-m3:free",
  "google/gemma-4-26b-a4b-it:free",
  "z-ai/glm-5.2:free",
  "minimax/minimax-m2.7:free",
] as const;

function uniqueModels(ids: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const trimmed = id?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Single-card classify: never lead with a slow router or a 31B.
 * OPENROUTER_CLASSIFY_MODEL may pin a specific instruct id.
 * OPENROUTER_MODEL is used only if it is a requestable non-router id.
 */
export const CLASSIFY_FALLBACKS: string[] = uniqueModels([
  process.env.OPENROUTER_CLASSIFY_MODEL,
  process.env.OPENROUTER_MODEL && !isRouterModel(process.env.OPENROUTER_MODEL)
    ? process.env.OPENROUTER_MODEL
    : undefined,
  ...FAST_INSTRUCT,
]).filter(isRequestableModel);

/** Trainer/profile and general completions. Router allowed, but not retried forever. */
export const OPENROUTER_FALLBACKS: string[] = uniqueModels([
  OPENROUTER_MODEL,
  ...FAST_INSTRUCT,
  "openrouter/free",
]).filter(isRequestableModel);

export function requireOpenRouterKey(): string {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY is missing. Get a free key at https://openrouter.ai/keys and add it to .env.local.",
    );
  }
  return key;
}

export function modelLabel(modelId: string): string {
  const slug = modelId.replace(/:free$/i, "").split("/").pop() ?? modelId;
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => {
      if (/^\d/.test(part)) return part.toUpperCase();
      if (part.length <= 3) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}
