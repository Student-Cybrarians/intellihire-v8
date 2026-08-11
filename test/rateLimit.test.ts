import { describe, it, expect } from "vitest";
import { rateLimit } from "@/lib/rateLimit";

describe("rateLimit (in-memory fallback, no REDIS_URL configured)", () => {
  it("allows requests under the limit and blocks once exceeded", async () => {
    const scope = `test-scope-${Math.random()}`;
    const id = "user-1";

    for (let i = 0; i < 3; i++) {
      const result = await rateLimit(scope, id, 3, 60);
      expect(result.allowed).toBe(true);
    }

    const blocked = await rateLimit(scope, id, 3, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks separate identifiers independently", async () => {
    const scope = `test-scope-${Math.random()}`;
    const first = await rateLimit(scope, "user-a", 1, 60);
    const second = await rateLimit(scope, "user-b", 1, 60);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
  });
});
