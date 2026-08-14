# IntelliHire AI Provider Architecture

Module 1 uses a real hosted AI provider through the shared `aiService` abstraction. The module never reads provider API keys directly.

## Flow

```text
Module 1 ATS route
        │
        │ aiService.analyzeText(userId, { capability: "reasoning", ... })
        ▼
src/lib/ai/aiService.ts
        │
        ├── per-user AI budget / rate limit
        ├── correlation ID
        └── provider selection
        ▼
NVIDIAAIProvider or OpenRouterAIProvider
        │
        ▼
Hosted chat-completions API
        │
        ▼
validated JSON result
        │
        ▼
Module 1 ATS report
```

## Primary provider

When `NVIDIA_API_KEY` is configured, IntelliHire uses NVIDIA's hosted NIM endpoint:

`https://integrate.api.nvidia.com/v1/chat/completions`

The default model is:

`nvidia/nemotron-3.5-nano-30b-a3b`

`NVIDIA_MODEL` can override the default without changing application code.

## OpenRouter fallback provider

If NVIDIA is not configured, `OPENROUTER_API_KEY` enables OpenRouter. The model is controlled by `OPENROUTER_MODEL`.

## Module 1 behavior

1. The authenticated candidate submits a resume and job description.
2. The server validates input size and authentication.
3. The deterministic ATS engine calculates a local baseline.
4. If a real AI provider is configured, the server calls `aiService.analyzeText()`.
5. The model is instructed to treat resume/JD content as untrusted data and return only the Module 1 JSON schema.
6. The server parses and validates the model response with Zod.
7. Only validated AI output is returned as `mode: "ai"`.
8. If no provider is configured or the provider fails, the deterministic ATS result is returned transparently as `mode: "fallback"`.

The fallback does not pretend to be AI. The frontend explicitly reports when AI enrichment was unavailable.

## Resilience

- NVIDIA upstream timeout: 9.5 seconds per attempt.
- NVIDIA retry: one retry for `429` and `5xx`/retryable transport failures.
- Module 1 application timeout: 11 seconds for the AI attempt.
- AI budget: 20 requests/minute per requester and capability through the shared rate limiter.
- API keys are server-side only and redacted from logs.
- AI output is schema-validated before being accepted.

## AI status

Authenticated users can query:

`GET /api/modules/ats/ai-status`

This endpoint does not make a billed inference request. It reports whether a provider is configured and which provider/model configuration is active.

## Configuration

```env
NVIDIA_API_KEY=
NVIDIA_API_BASE_URL=https://integrate.api.nvidia.com/v1/chat/completions
NVIDIA_MODEL=nvidia/nemotron-3.5-nano-30b-a3b

OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4o-mini
```

Never expose these keys through `NEXT_PUBLIC_*` variables or commit them to Git.
