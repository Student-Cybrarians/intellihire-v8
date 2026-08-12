# NVIDIA Nemotron Integration

## Configuration

The application already routes AI traffic through `src/lib/ai/aiService.ts`. When `NVIDIA_API_KEY` is present, `aiService` selects `NvidiaAIProvider`; otherwise it falls back to the OpenRouter provider.

Set these server-side variables:

```env
NVIDIA_API_KEY=<your-nvidia-api-key>
NVIDIA_API_BASE_URL=https://integrate.api.nvidia.com/v1/chat/completions
NVIDIA_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
```

Never prefix these names with `NEXT_PUBLIC_`. Never commit real values to Git.

## NVIDIA hosted API

The hosted NVIDIA API uses an OpenAI-compatible chat-completions endpoint. Requests use:

```http
POST https://integrate.api.nvidia.com/v1/chat/completions
Authorization: Bearer <NVIDIA_API_KEY>
Content-Type: application/json
```

For the Nemotron 3 Nano Omni reasoning model, NVIDIA documents text, image, video, and audio inputs. Vision-style messages use OpenAI-compatible content parts such as `image_url`; media may be a public URL or a base64 data URL.

The application's `NvidiaAIProvider` currently sends text and image inputs, retries HTTP 429/5xx once, times out after 12 seconds per attempt, and keeps the API key server-side.

## Local development

Create `.env.local` from `.env.example` and populate the real `NVIDIA_API_KEY`. The repository `.gitignore` excludes `.env*` except `.env.example`.

You can also use Vercel's CLI to pull development variables into a local file:

```bash
vercel env pull .env.local
```

## Vercel

In the Vercel project, add the three NVIDIA variables under Project Settings → Environment Variables. Apply them to Production and Preview as needed. Mark the API key as sensitive where the UI/CLI allows it.

After changing environment variables, create a new deployment; Vercel applies environment-variable changes to new deployments, not previous deployments.

## Testing the upstream API directly

Do not place the API key in browser code. Test from a server terminal instead:

```bash
curl -X POST "$NVIDIA_API_BASE_URL" \
  -H "Authorization: Bearer $NVIDIA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    "messages": [{"role":"user","content":"Say hello from IntelliHire."}],
    "max_tokens": 1024,
    "temperature": 0.6,
    "stream": false
  }'
```

For reasoning workloads, NVIDIA documents a substantially larger output-token budget and an optional reasoning budget. Tune those values based on the specific product flow rather than copying the maximum into every request.

## Application request flow

```text
Browser
  -> Next.js Route Handler / server action
  -> aiService
  -> NvidiaAIProvider
  -> NVIDIA hosted API
  -> response validation
  -> browser
```

No browser component should import `NVIDIA_API_KEY` or call `integrate.api.nvidia.com` directly.

## Important blueprint distinction

`nemotron-voice-agent` and `live-vlm-webui` are reference applications/blueprints, not libraries that need to be bundled into the Next.js frontend. Their NVIDIA integrations are useful as implementation references for voice and multimodal flows. The existing IntelliHire server-side provider is the correct place to add NVIDIA hosted API calls.

For a future voice feature, use the voice-agent blueprint's architecture for streaming ASR/LLM/TTS and keep those credentials in the server/runtime environment. For live webcam/VLM features, use the Live VLM WebUI project's backend/VLM patterns rather than exposing cloud credentials to a browser.

## Security checklist

- Keep `NVIDIA_API_KEY` server-only.
- Do not commit `.env.local`, `.env`, or any file containing a real key.
- Rotate the NVIDIA key immediately if it has ever been committed or exposed in client-side code.
- Keep provider calls behind `aiService` so rate limiting, logging/redaction, retries, and provider switching remain centralized.
- Use the existing application rate limiter and correlation IDs; do not create browser-side retry loops.
- Do not log authorization headers or full request bodies when they may contain user-provided resumes, interview content, or media.

## Why this repository is already close

The repository's `.env.example`, environment schema, provider abstraction, NVIDIA provider, and provider selector already contain the main integration pieces. The operational step needed for production is primarily supplying the real server-side NVIDIA secret in Vercel and then deploying a fresh build.
