# NVIDIA AI Provider Architecture

## Layers

```
future module (ATS, assessments, interviews, ...)
        │  aiService.generate(userId, { capability: "reasoning", prompt })
        ▼
src/lib/ai/aiService.ts       — budget/rate-limit enforcement, correlation IDs, error logging
        │
        ▼
src/lib/ai/types.ts           — AIProvider interface (generate/analyzeText/analyzeVision/healthCheck)
        │
        ▼
src/lib/ai/NvidiaAIProvider.ts — HTTP calls to NVIDIA NIM, retries, timeout, response validation
        │
        ▼
src/lib/ai/modelRegistry.ts   — capability -> { modelId, apiKeyEnvVar }
```

**No module — frontend or backend — talks to NVIDIA directly, and no
NVIDIA API key is ever read outside `modelRegistry.ts`/`NvidiaAIProvider.ts`.**
Future modules import only `aiService` from `src/lib/ai/aiService.ts`.

## Adding a new module (e.g. Module 1: resume screening)

```ts
import { aiService } from "@/lib/ai/aiService";

const result = await aiService.analyzeText(user.id, {
  capability: "reasoning",
  systemPrompt: "You are an ATS resume screener...",
  prompt: resumeText,
});
```

The module never sees a model name, an API key, or an env var — it asks for
a `capability`. If NVIDIA's catalog changes, or a different provider is
swapped in later, only `modelRegistry.ts` (and, if the provider itself
changes, a new class implementing `AIProvider`) needs to change.

## Capabilities

| Capability | Env var | Notes |
| --- | --- | --- |
| `reasoning` | `NVIDIA_API_KEY_NEMOTRON_9B` | Text-only reasoning/generation |
| `vision` | `NVIDIA_API_KEY_LLAMA_NEMOTRON_VL_8B` | Text + image input |
| `fast` | `NVIDIA_API_KEY_NEMOTRON_VL_12B` | Lower-latency/cheaper calls |

The specific `modelId` strings in `modelRegistry.ts` are placeholders —
**confirm the exact current model identifiers against NVIDIA's live
catalog** (`https://integrate.api.nvidia.com`) before going to production;
they were not verified against a live NVIDIA account from this environment.

## Resilience

- **Timeout**: every request carries an `AbortController` timeout (20s
  default).
- **Retries**: exponential backoff (250ms × 2^attempt) on `429` and `5xx`
  only — a `4xx` (other than 429) fails immediately, since retrying a bad
  request wastes quota without changing the outcome.
- **Budget**: `aiService` enforces a per-requester, per-capability rate
  limit (20 requests/minute by default) via the same Redis-backed limiter
  used for auth endpoints, so a bug in a future module can't silently run up
  usage.
- **Secret redaction**: the API key is sent only in the `Authorization`
  header of the outbound NVIDIA request; every log call in this layer routes
  through `redactSecrets()`/pino's `redact` config, and tests
  (`test/nvidia-provider.test.ts`) assert the key never appears in the
  provider's own error/response objects.

## What's stubbed, on purpose

`healthCheck()` currently only checks that the configured API key exists —
it deliberately does not make a real, billed request to NVIDIA on every
health check. Wire it to a real lightweight endpoint (e.g. a `/models` list
call) once you've confirmed NVIDIA's current catalog and are comfortable
with that call being part of your uptime monitoring's cost profile.
