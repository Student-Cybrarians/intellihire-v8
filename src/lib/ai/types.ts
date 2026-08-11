/**
 * Capabilities are what future modules ask for — "reasoning", "vision" —
 * never a specific model name or API key. The model registry maps a
 * capability to the currently configured model; swapping models later is a
 * one-line registry change, not a call-site change anywhere in the app.
 */
export type AICapability = "reasoning" | "vision" | "fast";

export type GenerateRequest = {
  capability: AICapability;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  correlationId?: string;
};

export type AnalyzeTextRequest = GenerateRequest;

export type AnalyzeVisionRequest = {
  capability: "vision";
  prompt: string;
  imageBase64: string;
  imageMediaType: string;
  maxTokens?: number;
  correlationId?: string;
};

export type AIResponse = {
  text: string;
  model: string;
  usage?: { promptTokens?: number; completionTokens?: number };
  correlationId: string;
};

export type AIErrorCode =
  | "MISSING_CREDENTIALS"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "INVALID_RESPONSE"
  | "UPSTREAM_ERROR"
  | "BUDGET_EXCEEDED"
  | "UNSUPPORTED_CAPABILITY";

export class AIServiceError extends Error {
  constructor(
    message: string,
    public code: AIErrorCode,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}

export interface AIProvider {
  generate(request: GenerateRequest): Promise<AIResponse>;
  analyzeText(request: AnalyzeTextRequest): Promise<AIResponse>;
  analyzeVision(request: AnalyzeVisionRequest): Promise<AIResponse>;
  healthCheck(): Promise<{ healthy: boolean; details?: string }>;
}
