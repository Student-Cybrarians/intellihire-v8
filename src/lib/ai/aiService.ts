import { randomUUID } from "crypto";
import { OpenRouterAIProvider } from "./OpenRouterAIProvider";
import { AIServiceError } from "./types";
import type { AIProvider, GenerateRequest, AnalyzeTextRequest, AnalyzeVisionRequest, AIResponse } from "./types";
import { rateLimit } from "@/lib/rateLimit";
import { logger, redactSecrets } from "@/lib/logger";

const DEFAULT_BUDGET = { limit: 20, windowSeconds: 60 };

const provider: AIProvider = new OpenRouterAIProvider();

async function enforceBudget(identifier: string, capability: string): Promise<void> {
  const result = await rateLimit(`ai:${capability}`, identifier, DEFAULT_BUDGET.limit, DEFAULT_BUDGET.windowSeconds);
  if (!result.allowed) {
    throw new AIServiceError(
      `AI usage budget exceeded for capability "${capability}"`,
      "BUDGET_EXCEEDED",
      false,
    );
  }
}

export const aiService = {
  async generate(requesterId: string, request: GenerateRequest): Promise<AIResponse> {
    await enforceBudget(requesterId, request.capability);
    const correlationId = request.correlationId ?? randomUUID();
    try {
      return await provider.generate({ ...request, correlationId });
    } catch (err) {
      logger.error(redactSecrets({ correlationId, requesterId, err: (err as Error).message }), "ai_generate_failed");
      throw err;
    }
  },

  async analyzeText(requesterId: string, request: AnalyzeTextRequest): Promise<AIResponse> {
    await enforceBudget(requesterId, request.capability);
    const correlationId = request.correlationId ?? randomUUID();
    try {
      return await provider.analyzeText({ ...request, correlationId });
    } catch (err) {
      logger.error(redactSecrets({ correlationId, requesterId, err: (err as Error).message }), "ai_analyze_text_failed");
      throw err;
    }
  },

  async analyzeVision(requesterId: string, request: AnalyzeVisionRequest): Promise<AIResponse> {
    await enforceBudget(requesterId, "vision");
    const correlationId = request.correlationId ?? randomUUID();
    try {
      return await provider.analyzeVision({ ...request, correlationId });
    } catch (err) {
      logger.error(redactSecrets({ correlationId, requesterId, err: (err as Error).message }), "ai_analyze_vision_failed");
      throw err;
    }
  },

  async healthCheck() {
    return provider.healthCheck();
  },
};
