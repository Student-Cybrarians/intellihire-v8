# OpenRouter AI Provider Architecture

## Layers

```text
future module (ATS, assessments, interviews, ...)
        │  aiService.generate/analyzeText(userId, { capability, prompt })
        ▼
src/lib/ai/aiService.ts       — budget/rate-limit enforcement, correlation IDs, error logging
        │
        ▼
src/lib/ai/types.ts           — AIProvider interface (generate/analyzeText/analyzeVision/healthCheck)
        │
        ▼
src/lib/ai/OpenRouterAIProvider.ts — OpenRouter HTTP calls, timeout, retry, response validation
```

Modules never read the OpenRouter API key directly. They call `aiService`, which applies the per-user capability budget and passes the request to the provider abstraction.

## Configuration

| Setting | Environment variable | Default |
| --- | --- | --- |
| API key | `OPENROUTER_API_KEY` | none; AI is unavailable without it |
| Model | `OPENROUTER_MODEL` | `openai/gpt-4o-mini` |
| API endpoint | internal provider constant | `https://openrouter.ai/api/v1/chat/completions` |

## Adding a module

```ts
import { aiService } from "@/lib/ai/aiService";

const result = await aiService.analyzeText(user.id, {
  capability: "reasoning",
  systemPrompt: "You are an ATS resume screener...",
  prompt: resumeText,
});
```

A module does not need to know the model name or API-key value. Provider-specific behavior remains inside the provider implementation.

## Resilience

- Provider timeout: 8 seconds per upstream attempt.
- Retry: one retry for `429` and `5xx`/retryable transport failures.
- AI budget: 20 requests/minute per requester and capability through the shared rate limiter.
- Secrets: the API key is only placed in the outbound `Authorization` header and is redacted from logs.
- Module 1 has an additional application-level deterministic ATS fallback so an OpenRouter outage does not make resume screening unusable.

## Health check

`healthCheck()` checks whether `OPENROUTER_API_KEY` is configured. It deliberately does not make a billed model request on every application health probe.
