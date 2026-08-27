import {
  OPENROUTER_MODEL,
  isRequestableModel,
  isSafetyModel,
  requireOpenRouterKey,
} from "./model";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const MODEL_JSON_ERROR =
  "The model did not return a card or trainer profile as JSON. A safety filter may have answered instead. Retry the scan.";

const BUSY_ERROR =
  "The OpenRouter model is busy. Retry the scan in a minute.";

const KEY_LIMIT_ERROR =
  "OpenRouter key limit exceeded. Add credits or raise the key limit, then retry.";

const TIMEOUT_ERROR = "The classifier timed out. Retry the scan.";

type ChatChoice = {
  message?: { content?: string | Array<{ type?: string; text?: string }> };
};

type ChatResponse = {
  id?: string;
  model?: string;
  error?: { message?: string; code?: number };
  choices?: ChatChoice[];
};

function messageText(choice: ChatChoice | undefined): string {
  const content = choice?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("\n");
  }
  return "";
}

export function stripModelPreamble(text: string): string {
  let stripped = text.trim();
  stripped = stripped.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  stripped = stripped.replace(/^\s*user\s+safety\s*:\s*[^\n{]*\n?/gim, "");
  stripped = stripped.replace(/^\s*(?:content[-\s]?safety|moderation)\s*:\s*[^\n{]*\n?/gim, "");
  const start = stripped.indexOf("{");
  if (start > 0) stripped = stripped.slice(start);
  return stripped.trim();
}

export function looksLikeSafetyOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (trimmed.includes("{") && trimmed.includes("}")) return false;
  return /user\s+safety|content[-\s]?safety|moderation/i.test(trimmed);
}

export function extractJsonObject(text: string): Record<string, unknown> {
  const stripped = stripModelPreamble(text);
  if (!stripped.includes("{")) {
    throw new Error(MODEL_JSON_ERROR);
  }

  const candidates = [stripped];
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start >= 0 && end > start) {
    candidates.push(stripped.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try the next candidate
    }
  }

  throw new Error(MODEL_JSON_ERROR);
}

async function chatOnce(
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<ChatResponse> {
  const key = requireOpenRouterKey();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "https://commitdex.local",
        "X-OpenRouter-Title": "Commitdex",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => ({}))) as ChatResponse;
    const errMsg = data.error?.message ?? "";
    if (!response.ok) {
      console.error("[commitdex:openrouter]", response.status, data.error);
      if (/key limit exceeded/i.test(errMsg)) {
        throw new Error(KEY_LIMIT_ERROR);
      }
      if (response.status === 429 || /provider returned error/i.test(errMsg)) {
        throw new Error(BUSY_ERROR);
      }
      throw new Error(BUSY_ERROR);
    }
    if (errMsg) {
      console.error("[commitdex:openrouter]", data.error);
      if (/key limit exceeded/i.test(errMsg)) {
        throw new Error(KEY_LIMIT_ERROR);
      }
      throw new Error(BUSY_ERROR);
    }
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(TIMEOUT_ERROR);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

type CompleteOptions = {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  /** Single model id. Defaults to OPENROUTER_MODEL. */
  model?: string;
  timeoutMs?: number;
  /** Cap hidden reasoning so JSON still fits in max_tokens. */
  reasoningMaxTokens?: number;
};

function parseReply(data: ChatResponse, requested: string): { parsed: Record<string, unknown>; model: string } {
  const used = data.model ?? requested;
  if (isSafetyModel(used)) {
    throw new Error(MODEL_JSON_ERROR);
  }

  const text = messageText(data.choices?.[0]);
  if (!text.trim() || looksLikeSafetyOnly(text)) {
    throw new Error(MODEL_JSON_ERROR);
  }

  return {
    parsed: extractJsonObject(text),
    model: used,
  };
}

/**
 * One HTTP attempt per call. No retries on 429/5xx, no fallback model chain,
 * no packed `models` array, no second pass with response_format.
 */
export async function completeJson(
  options: CompleteOptions,
): Promise<{ parsed: Record<string, unknown>; model: string }> {
  const model = (options.model?.trim() || OPENROUTER_MODEL).trim();
  if (!isRequestableModel(model)) {
    throw new Error(MODEL_JSON_ERROR);
  }

  const timeoutMs = options.timeoutMs ?? 12_000;
  const body: Record<string, unknown> = {
    model,
    temperature: options.temperature,
    max_tokens: options.maxTokens,
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.user },
    ],
    provider: {
      sort: "latency",
    },
  };

  if (typeof options.reasoningMaxTokens === "number") {
    body.reasoning = { exclude: true, max_tokens: options.reasoningMaxTokens };
  }

  const data = await chatOnce(body, timeoutMs);
  return parseReply(data, model);
}

export const CLASSIFY_TIMEOUT_MS = 8_000;
