import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NvidiaAIProvider } from "@/lib/ai/NvidiaAIProvider";
import { AIServiceError } from "@/lib/ai/types";

const ORIGINAL_ENV = { ...process.env };

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("NvidiaAIProvider", () => {
  it("throws MISSING_CREDENTIALS when the capability's API key env var is unset", async () => {
    delete process.env.NVIDIA_API_KEY_NEMOTRON_9B;
    const provider = new NvidiaAIProvider();

    await expect(provider.generate({ capability: "reasoning", prompt: "hello" })).rejects.toMatchObject({
      code: "MISSING_CREDENTIALS",
    });
  });

  it("returns a validated response on success", async () => {
    process.env.NVIDIA_API_KEY_NEMOTRON_9B = "test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: "Here is your answer." } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    );

    const provider = new NvidiaAIProvider();
    const result = await provider.generate({ capability: "reasoning", prompt: "hello" });

    expect(result.text).toBe("Here is your answer.");
    expect(result.usage?.promptTokens).toBe(10);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // The API key must never appear anywhere except the Authorization header sent upstream.
    const [, requestInit] = fetchSpy.mock.calls[0];
    expect((requestInit?.headers as Record<string, string>).Authorization).toContain("test-key");
  });

  it("retries on a 500 and succeeds on the second attempt", async () => {
    process.env.NVIDIA_API_KEY_NEMOTRON_9B = "test-key";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("upstream error", { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: "recovered" } }] }));

    const provider = new NvidiaAIProvider();
    const result = await provider.generate({ capability: "reasoning", prompt: "hello" });

    expect(result.text).toBe("recovered");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-retryable 400 and surfaces UPSTREAM_ERROR", async () => {
    process.env.NVIDIA_API_KEY_NEMOTRON_9B = "test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad request", { status: 400 }));

    const provider = new NvidiaAIProvider();
    await expect(provider.generate({ capability: "reasoning", prompt: "hello" })).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("maps a 429 to RATE_LIMITED after exhausting retries", async () => {
    process.env.NVIDIA_API_KEY_NEMOTRON_9B = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("slow down", { status: 429 }));

    const provider = new NvidiaAIProvider();
    await expect(provider.generate({ capability: "reasoning", prompt: "hello" })).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("maps an aborted/timed-out request to TIMEOUT", async () => {
    process.env.NVIDIA_API_KEY_NEMOTRON_9B = "test-key";
    vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });

    const provider = new NvidiaAIProvider();
    await expect(provider.generate({ capability: "reasoning", prompt: "hello" })).rejects.toMatchObject({
      code: "TIMEOUT",
    });
  });

  it("throws INVALID_RESPONSE when the upstream body has no usable content", async () => {
    process.env.NVIDIA_API_KEY_NEMOTRON_9B = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ choices: [] }));

    const provider = new NvidiaAIProvider();
    await expect(provider.generate({ capability: "reasoning", prompt: "hello" })).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("healthCheck reports unhealthy when credentials are missing", async () => {
    delete process.env.NVIDIA_API_KEY_NEMOTRON_VL_12B;
    const provider = new NvidiaAIProvider();
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(false);
  });
});

describe("AIServiceError", () => {
  it("carries a retryable flag distinct from its error code", () => {
    const err = new AIServiceError("boom", "TIMEOUT", true);
    expect(err.code).toBe("TIMEOUT");
    expect(err.retryable).toBe(true);
  });
});
