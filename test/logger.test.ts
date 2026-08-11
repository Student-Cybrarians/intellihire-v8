import { describe, it, expect } from "vitest";
import { redactSecrets } from "@/lib/logger";

describe("redactSecrets", () => {
  it("redacts known sensitive keys at the top level", () => {
    const input = { access_token: "secret-value", email: "user@example.com" };
    const output = redactSecrets(input) as Record<string, unknown>;
    expect(output.access_token).toBe("[REDACTED]");
    expect(output.email).toBe("user@example.com");
  });

  it("redacts sensitive keys nested inside objects", () => {
    const input = {
      request: { headers: { authorization: "Bearer abc", cookie: "ih_session=xyz" } },
    };
    const output = redactSecrets(input) as typeof input;
    expect(output.request.headers.authorization).toBe("[REDACTED]");
    expect(output.request.headers.cookie).toBe("[REDACTED]");
  });

  it("redacts NVIDIA API key fields regardless of casing", () => {
    const input = { NVIDIA_API_KEY_NEMOTRON_9B: "sk-super-secret" };
    const output = redactSecrets(input) as Record<string, unknown>;
    expect(output.NVIDIA_API_KEY_NEMOTRON_9B).toBe("[REDACTED]");
  });

  it("leaves arrays and non-sensitive nested data intact", () => {
    const input = { items: [{ id: 1 }, { id: 2, password: "hunter2" }] };
    const output = redactSecrets(input) as typeof input;
    expect(output.items[0].id).toBe(1);
    expect(output.items[1].password).toBe("[REDACTED]");
  });
});
