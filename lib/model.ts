/** Code default: DeepSeek V4 Flash (instruct). Env may override. */
export const DEFAULT_OPENROUTER_MODEL = "deepseek/deepseek-v4-flash";

export const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;

/** Optional pin for classify only; otherwise same as OPENROUTER_MODEL. */
export const CLASSIFY_MODEL =
  process.env.OPENROUTER_CLASSIFY_MODEL?.trim() || OPENROUTER_MODEL;

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
