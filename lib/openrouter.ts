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

const BAD_MODEL_ERROR =
  "OpenRouter model id is invalid. Set OPENROUTER_MODEL to a real catalog id.";

const TIMEOUT_ERROR = "The classifier timed out. Retry the scan.";

type ChatChoice = {
  message?: {
    content?: string | Array<{ type?: string; text?: string }> | null;
    reasoning?: string | null;
    reasoning_content?: string | null;
  };
  finish_reason?: string | null;
};

type ChatResponse = {
  id?: string;
  model?: string;
  error?: { message?: string; code?: number };
  choices?: ChatChoice[];
  usage?: {
    completion_tokens?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
};

function contentToText(
  content: string | Array<{ type?: string; text?: string }> | null | undefined,
): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const textParts = content.filter((part) => !part.type || part.type === "text");
    const parts = textParts.length > 0 ? textParts : content;
    return parts
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("\n");
  }
  return "";
}

function messageText(choice: ChatChoice | undefined): string {
  const message = choice?.message;
  const primary = contentToText(message?.content);
  if (primary.trim()) return primary;

  // DeepSeek occasionally parks JSON in reasoning when content is empty.
  for (const fallback of [message?.reasoning, message?.reasoning_content]) {
    if (typeof fallback === "string" && fallback.includes("{") && fallback.includes("}")) {
      return fallback;
    }
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
      if (/not a valid model/i.test(errMsg) || response.status === 404) {
        throw new Error(BAD_MODEL_ERROR);
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
      if (/not a valid model/i.test(errMsg)) {
        throw new Error(BAD_MODEL_ERROR);
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
  /**
   * Optional OpenRouter reasoning controls. Avoid with DeepSeek V4 Flash:
   * `exclude: true` often returns null content while burning max_tokens on
   * hidden reasoning. Prefer omitting this field.
   */
  reasoningMaxTokens?: number;
};

function parseReply(data: ChatResponse, requested: string): { parsed: Record<string, unknown>; model: string } {
  const used = data.model ?? requested;
  if (isSafetyModel(used)) {
    throw new Error(MODEL_JSON_ERROR);
  }

  const choice = data.choices?.[0];
  const text = messageText(choice);
  if (!text.trim() || looksLikeSafetyOnly(text)) {
    const reasoningTokens = data.usage?.completion_tokens_details?.reasoning_tokens;
    const finish = choice?.finish_reason ?? null;
    console.error("[commitdex:openrouter] empty JSON reply", {
      model: used,
      finish,
      completion_tokens: data.usage?.completion_tokens ?? null,
      reasoning_tokens: reasoningTokens ?? null,
    });
    if (
      finish === "length" &&
      (reasoningTokens ?? 0) > 0 &&
      !text.trim()
    ) {
      throw new Error(
        "The model spent its token budget on hidden reasoning instead of JSON. Retry the scan.",
      );
    }
    throw new Error(MODEL_JSON_ERROR);
  }

  return {
    parsed: extractJsonObject(text),
    model: used,
  };
}

/**
 * One HTTP attempt per call. No retries on 429/5xx, no fallback model chain,
 * no packed `models` array, no second pass.
 */
export async function completeJson(
  options: CompleteOptions,
): Promise<{ parsed: Record<string, unknown>; model: string }> {
  const model = (options.model?.trim() || OPENROUTER_MODEL).trim();
  if (!isRequestableModel(model)) {
    throw new Error(BAD_MODEL_ERROR);
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
    // DeepSeek V4 Flash + json_object without reasoning disabled burns the whole
    // completion budget on hidden chain-of-thought and returns null content.
    response_format: { type: "json_object" },
    reasoning: { effort: "none" },
  };

  if (typeof options.reasoningMaxTokens === "number") {
    // Legacy override — do not pair with json_object / effort:none.
    delete body.response_format;
    body.reasoning = { max_tokens: options.reasoningMaxTokens };
  }

  const data = await chatOnce(body, timeoutMs);
  return parseReply(data, model);
}

/** Allow slow providers; ritual UI keeps a 5s floor separately. */
export const CLASSIFY_TIMEOUT_MS = 15_000;
