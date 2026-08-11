import type { AICapability } from "./types";

export type ModelConfig = {
  /** NVIDIA NIM model identifier, as sent in the request body. */
  modelId: string;
  /** Env var name holding the API key — never the key value itself. */
  apiKeyEnvVar: string;
  supportsVision: boolean;
  defaultMaxTokens: number;
};

/**
 * Single source of truth for "which model backs which capability". Modules
 * never hardcode a model name or reach for `process.env` directly — they
 * call `aiService.generate({ capability: "reasoning", ... })` and this
 * registry decides the rest. Changing providers/models later is a change
 * in exactly one place.
 */
export const MODEL_REGISTRY: Record<AICapability, ModelConfig> = {
  reasoning: {
    modelId: "nvidia/llama-3.1-nemotron-70b-instruct", // placeholder id; confirm against NVIDIA's current catalog
    apiKeyEnvVar: "NVIDIA_API_KEY_NEMOTRON_9B",
    supportsVision: false,
    defaultMaxTokens: 1024,
  },
  vision: {
    modelId: "nvidia/llama-3.2-nemotron-vl-8b", // placeholder id; confirm against NVIDIA's current catalog
    apiKeyEnvVar: "NVIDIA_API_KEY_LLAMA_NEMOTRON_VL_8B",
    supportsVision: true,
    defaultMaxTokens: 1024,
  },
  fast: {
    modelId: "nvidia/nemotron-vl-12b", // placeholder id; confirm against NVIDIA's current catalog
    apiKeyEnvVar: "NVIDIA_API_KEY_NEMOTRON_VL_12B",
    supportsVision: true,
    defaultMaxTokens: 512,
  },
};

export function resolveModel(capability: AICapability): ModelConfig {
  const config = MODEL_REGISTRY[capability];
  if (!config) {
    throw new Error(`No model registered for capability: ${capability}`);
  }
  return config;
}

export function resolveApiKey(config: ModelConfig): string | undefined {
  return process.env[config.apiKeyEnvVar];
}
