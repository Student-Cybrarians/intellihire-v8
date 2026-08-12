import { randomUUID } from "crypto";
import type {
  AIProvider,
  GenerateRequest,
  AnalyzeTextRequest,
  AnalyzeVisionRequest,
  AIResponse,
} from "./types";
import { AIServiceError } from "./types";
import { logger, redactSecrets } from "@/lib/logger";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
// Interactive Module 1 requests must not sit behind a long upstream retry loop.
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_RETRIES = 1;

type ContentPart = { type?: string; text?: string };
type MessageContent = string | ContentPart[];

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: MessageContent } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
  error?: { message?: string };
};

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
}

function getApiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY;
}

function extractText(content: MessageContent | undefined): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const text = content
      .filter((part: ContentPart) => part?.type === "text" && typeof part.text === "string")
      .map((part: ContentPart) => part.text as string)
      .join("\n")
      .trim();
    return text || null;
  }
  return null;
}

export class OpenRouterAIProvider implements AIProvider {
  private async chatCompletion(params: {
    capability: GenerateRequest["capability"];
    messages: Array<{ role: string; content: MessageContent }>;
    maxTokens?: number;
    temperature?: number;
    correlationId: string;
  }): Promise<AIResponse> {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new AIServiceError("Missing OPENROUTER_API_KEY", "MISSING_CREDENTIALS", false);
    }

    const model = getModel();
    const body = {
      model,
      messages: params.messages,
      max_tokens: params.maxTokens ?? 1024,
      temperature: params.temperature ?? 0.4,
    };

    let lastError: AIServiceError | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      try {
        const response = await fetch(OPENROUTER_API_BASE, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.APP_URL || "https://intellihire-v8.vercel.app",
            "X-Title": "IntelliHire",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
          cache: "no-store",
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as ChatCompletionResponse | null;
          const message = data?.error?.message;
          const retryable = isRetryableStatus(response.status);
          lastError = new AIServiceError(
            message ? `OpenRouter API error: ${message}` : `OpenRouter API responded with status ${response.status}`,
            response.status === 429 ? "RATE_LIMITED" : "UPSTREAM_ERROR",
            retryable,
          );
          if (retryable && attempt < MAX_RETRIES) {
            await sleep(300);
            continue;
          }
          throw lastError;
        }

        const data = (await response.json()) as ChatCompletionResponse;
        const text = extractText(data.choices?.[0]?.message?.content);
        if (!text) {
          throw new AIServiceError("OpenRouter response did not contain expected content", "INVALID_RESPONSE", false);
        }

        return {
          text,
          model: data.model || model,
          usage: {
            promptTokens: data.usage?.prompt_tokens,
            completionTokens: data.usage?.completion_tokens,
          },
          correlationId: params.correlationId,
        };
      } catch (err) {
        clearTimeout(timeout);

        if (err instanceof AIServiceError) {
          lastError = err;
        } else if ((err as Error).name === "AbortError") {
          lastError = new AIServiceError("OpenRouter request timed out after 8 seconds", "TIMEOUT", true);
        } else {
          lastError = new AIServiceError(
            `OpenRouter request failed: ${(err as Error).message}`,
            "UPSTREAM_ERROR",
            true,
          );
        }

        if (lastError.retryable && attempt < MAX_RETRIES) {
          logger.warn(
            redactSecrets({ attempt, code: lastError.code, correlationId: params.correlationId }),
            "openrouter_request_retry",
          );
          await sleep(300);
          continue;
        }

        logger.error(
          redactSecrets({ code: lastError.code, correlationId: params.correlationId }),
          "openrouter_request_failed",
        );
        throw lastError;
      }
    }

    throw lastError ?? new AIServiceError("Unknown OpenRouter provider failure", "UPSTREAM_ERROR", false);
  }

  async generate(request: GenerateRequest): Promise<AIResponse> {
    const correlationId = request.correlationId ?? randomUUID();
    const messages: Array<{ role: string; content: MessageContent }> = [
      ...(request.systemPrompt ? [{ role: "system", content: request.systemPrompt }] : []),
      { role: "user", content: request.prompt },
    ];
    return this.chatCompletion({
      capability: request.capability,
      messages,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      correlationId,
    });
  }

  async analyzeText(request: AnalyzeTextRequest): Promise<AIResponse> {
    return this.generate(request);
  }

  async analyzeVision(request: AnalyzeVisionRequest): Promise<AIResponse> {
    const correlationId = request.correlationId ?? randomUUID();
    const messages: Array<{ role: string; content: MessageContent }> = [
      {
        role: "user",
        content: [
          { type: "text", text: request.prompt },
          {
            type: "image_url",
            image_url: { url: `data:${request.imageMediaType};base64,${request.imageBase64}` },
          } as ContentPart & { image_url: { url: string } },
        ],
      },
    ];

    return this.chatCompletion({
      capability: "vision",
      messages,
      maxTokens: request.maxTokens,
      correlationId,
    });
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: string }> {
    const apiKey = getApiKey();
    return apiKey ? { healthy: true, details: `Configured for ${getModel()}` } : { healthy: false, details: "Missing OPENROUTER_API_KEY" };
  }
}
