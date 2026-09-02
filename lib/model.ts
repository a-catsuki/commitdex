/** Code default: DeepSeek V4 Flash (instruct). Env may override. */
export const DEFAULT_OPENROUTER_MODEL = "deepseek/deepseek-v4-flash";

/**
 * Resolve a model id from env. Rejects empty values, bare names without a
 * provider slash, and accidental `OPENROUTER_MODEL=OPENROUTER_MODEL` pollution.
 */
const ROUTER_MODEL = /^openrouter\/(free|auto)$/i;

function resolveModelId(raw: string | undefined, fallback: string): string {
  const id = raw?.trim() ?? "";
  if (!id) return fallback;
  if (id === "OPENROUTER_MODEL" || id === "OPENROUTER_CLASSIFY_MODEL") {
    return fallback;
  }
  if (!id.includes("/")) return fallback;
  // Routers can hand off to safety/moderation models that return prose, not JSON.
  if (ROUTER_MODEL.test(id)) return fallback;
  return id;
}

export const OPENROUTER_MODEL = resolveModelId(
  process.env.OPENROUTER_MODEL,
  DEFAULT_OPENROUTER_MODEL,
);

/** Optional pin for classify only; otherwise same as OPENROUTER_MODEL. */
export const CLASSIFY_MODEL = resolveModelId(
  process.env.OPENROUTER_CLASSIFY_MODEL,
  OPENROUTER_MODEL,
);

const SAFETY_MODEL =
  /content[-_]?safety|llama-guard|prompt-guard|moderation|shield[-_]?gemma|nemotron[-_].*safety|safety[-_]?model/i;

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

/** Models we are willing to *request*. Safety-only ids are not. */
export function isRequestableModel(modelId: string): boolean {
  const id = modelId.trim().toLowerCase();
  if (!id) return false;
  return !isSafetyModel(id);
}

export function requireOpenRouterKey(): string {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENROUTER_API_KEY is missing.");
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
