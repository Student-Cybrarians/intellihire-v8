import { NvidiaAIProvider } from "./NvidiaAIProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import type { AIProvider } from "./types";

export function getPrimaryAIProvider(): AIProvider {
  return process.env.NVIDIA_API_KEY?.trim() ? new NvidiaAIProvider() : new OpenAIProvider();
}

export function getSecondaryAIProvider(): AIProvider | null {
  return process.env.NVIDIA_API_KEY?.trim() && process.env.OPENAI_API_KEY?.trim() ? new OpenAIProvider() : null;
}
