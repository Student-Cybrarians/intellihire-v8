import { randomUUID } from "crypto";
import type {
  AIProvider,
  GenerateRequest,
  AnalyzeTextRequest,
  AnalyzeVisionRequest,
  AIResponse,
} from "./types";
import { AIServiceError } from "./types";
import { resolveModel, resolveApiKey } from "./modelRegistry";
import { logger, redactSecrets } from "@/lib/logger";

const NVIDIA_API_BASE = "https://integrate.api.nvidia.com/v1";
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 3;

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * This class talks to NVIDIA's server-side API only. It is imported exclusively
 * from server modules (route handlers, server actions) — never from a client
 * component — so the API key never reaches a browser bundle.
 */
export class NvidiaAIProvider implements AIProvider {
  private async chatCompletion(params: {
    capability: GenerateRequest["capability"];
    messages: Array<{ role: string; content: unknown }>;
    maxTokens?: number;
    temperature?: number;
    correlationId: string;
  }): Promise<AIResponse> {
    const model = resolveModel(params.capability);
    const apiKey = resolveApiKey(model);

    if (!apiKey) {
      throw new AIServiceError(
        `Missing API key for capability "${params.capability}" (expected env var ${model.apiKeyEnvVar})`,
        "MISSING_CREDENTIALS",
        false,
      );
    }

    const body = {
      model: model.modelId,
      messages: params.messages,
      max_tokens: params.maxTokens ?? model.defaultMaxTokens,
      temperature: params.temperature ?? 0.4,
    };

    let lastError: AIServiceError | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      try {
        const response = await fetch(`${NVIDIA_API_BASE}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "X-Correlation-Id": params.correlationId,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const retryable = isRetryableStatus(response.status);
          lastError = new AIServiceError(
            `NVIDIA API responded with status ${response.status}`,
            response.status === 429 ? "RATE_LIMITED" : "UPSTREAM_ERROR",
            retryable,
          );
          if (retryable && attempt < MAX_RETRIES) {
            await sleep(2 ** attempt * 250);
            continue;
          }
          throw lastError;
        }

        const data = (await response.json()) as ChatCompletionResponse;
        const text = data.choices?.[0]?.message?.content;

        if (typeof text !== "string" || text.length === 0) {
          throw new AIServiceError(
            "NVIDIA API response did not contain expected content",
            "INVALID_RESPONSE",
            false,
          );
        }

        return {
          text,
          model: model.modelId,
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
          lastError = new AIServiceError("NVIDIA API request timed out", "TIMEOUT", true);
        } else {
          lastError = new AIServiceError(
            `NVIDIA API request failed: ${(err as Error).message}`,
            "UPSTREAM_ERROR",
            true,
          );
        }

        if (lastError.retryable && attempt < MAX_RETRIES) {
          logger.warn(
            redactSecrets({ attempt, code: lastError.code, correlationId: params.correlationId }),
            "nvidia_request_retry",
          );
          await sleep(2 ** attempt * 250);
          continue;
        }

        logger.error(
          redactSecrets({ code: lastError.code, correlationId: params.correlationId }),
          "nvidia_request_failed",
        );
        throw lastError;
      }
    }

    // Unreachable in practice — the loop always returns or throws — but keeps TS satisfied.
    throw lastError ?? new AIServiceError("Unknown NVIDIA provider failure", "UPSTREAM_ERROR", false);
  }

  async generate(request: GenerateRequest): Promise<AIResponse> {
    const correlationId = request.correlationId ?? randomUUID();
    const messages = [
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
    const model = resolveModel("vision");
    if (!model.supportsVision) {
      throw new AIServiceError(
        "Configured vision model does not support image input",
        "UNSUPPORTED_CAPABILITY",
        false,
      );
    }

    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: request.prompt },
          {
            type: "image_url",
            image_url: { url: `data:${request.imageMediaType};base64,${request.imageBase64}` },
          },
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
    const model = resolveModel("fast");
    const apiKey = resolveApiKey(model);
    if (!apiKey) {
      return { healthy: false, details: `Missing ${model.apiKeyEnvVar}` };
    }
    // A cheap, non-billed reachability check would normally hit a /models
    // endpoint; kept conservative here to avoid unexpected usage.
    return { healthy: true };
  }
}
