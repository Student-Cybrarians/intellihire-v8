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

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_RETRIES = 1;

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
type MessageContent = string | ContentPart[];
type ChatResponse = {
  choices?: Array<{ message?: { content?: string | ContentPart[] } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
  error?: { message?: string };
};

function retryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function textFrom(content: string | ContentPart[] | undefined): string | null {
  if (typeof content === "string") return content.trim() || null;
  if (!Array.isArray(content)) return null;
  const text = content
    .filter((part): part is Extract<ContentPart, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
  return text || null;
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class NvidiaAIProvider implements AIProvider {
  private apiKey(): string | undefined {
    return process.env.NVIDIA_API_KEY?.trim() || undefined;
  }

  private model(): string {
    return process.env.NVIDIA_MODEL?.trim() || DEFAULT_MODEL;
  }

  private endpoint(): string {
    return process.env.NVIDIA_API_BASE_URL?.trim() || DEFAULT_BASE_URL;
  }

  private async completion(params: {
    messages: Array<{ role: string; content: MessageContent }>;
    maxTokens?: number;
    temperature?: number;
    correlationId: string;
  }): Promise<AIResponse> {
    const apiKey = this.apiKey();
    if (!apiKey) throw new AIServiceError("Missing NVIDIA_API_KEY", "MISSING_CREDENTIALS", false);

    const model = this.model();
    const body = {
      model,
      messages: params.messages,
      max_tokens: params.maxTokens ?? 1024,
      temperature: params.temperature ?? 0.2,
    };

    let lastError: AIServiceError | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
      try {
        const response = await fetch(this.endpoint(), {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
          cache: "no-store",
        });
        clearTimeout(timeout);

        const data = (await response.json().catch(() => null)) as ChatResponse | null;
        if (!response.ok) {
          lastError = new AIServiceError(
            data?.error?.message ? `NVIDIA API error: ${data.error.message}` : `NVIDIA API responded with status ${response.status}`,
            response.status === 429 ? "RATE_LIMITED" : "UPSTREAM_ERROR",
            retryable(response.status),
          );
          if (lastError.retryable && attempt < MAX_RETRIES) {
            await delay(400);
            continue;
          }
          throw lastError;
        }

        const text = textFrom(data?.choices?.[0]?.message?.content);
        if (!text) throw new AIServiceError("NVIDIA response did not contain expected content", "INVALID_RESPONSE", false);

        return {
          text,
          model: data?.model || model,
          usage: {
            promptTokens: data?.usage?.prompt_tokens,
            completionTokens: data?.usage?.completion_tokens,
          },
          correlationId: params.correlationId,
        };
      } catch (error) {
        clearTimeout(timeout);
        if (error instanceof AIServiceError) {
          lastError = error;
        } else if ((error as Error).name === "AbortError") {
          lastError = new AIServiceError("NVIDIA request timed out", "TIMEOUT", true);
        } else {
          lastError = new AIServiceError(`NVIDIA request failed: ${(error as Error).message}`, "UPSTREAM_ERROR", true);
        }
        if (lastError.retryable && attempt < MAX_RETRIES) {
          logger.warn(redactSecrets({ attempt, code: lastError.code, correlationId: params.correlationId }), "nvidia_request_retry");
          await delay(400);
          continue;
        }
        logger.error(redactSecrets({ code: lastError.code, correlationId: params.correlationId }), "nvidia_request_failed");
        throw lastError;
      }
    }
    throw lastError ?? new AIServiceError("Unknown NVIDIA provider failure", "UPSTREAM_ERROR", false);
  }

  async generate(request: GenerateRequest): Promise<AIResponse> {
    const correlationId = request.correlationId ?? randomUUID();
    return this.completion({
      messages: [
        ...(request.systemPrompt ? [{ role: "system", content: request.systemPrompt }] : []),
        { role: "user", content: request.prompt },
      ],
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
    return this.completion({
      messages: [{
        role: "user",
        content: [
          { type: "text", text: request.prompt },
          { type: "image_url", image_url: { url: `data:${request.imageMediaType};base64,${request.imageBase64}` } },
        ],
      }],
      maxTokens: request.maxTokens,
      correlationId,
    });
  }

  async healthCheck() {
    return this.apiKey()
      ? { healthy: true, details: `Configured for ${this.model()}` }
      : { healthy: false, details: "Missing NVIDIA_API_KEY" };
  }
}
