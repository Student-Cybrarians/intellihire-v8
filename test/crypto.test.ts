import { describe, it, expect } from "vitest";
import { generateOpaqueToken, hashToken, safeEqual, sha256Base64Url } from "@/lib/crypto";

describe("crypto helpers", () => {
  it("generates high-entropy, unique opaque tokens", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
  });

  it("hashToken is deterministic and one-way-looking", () => {
    const token = "example-raw-session-token";
    expect(hashToken(token)).toEqual(hashToken(token));
    expect(hashToken(token)).not.toEqual(token);
  });

  it("safeEqual returns true only for identical strings", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
    expect(safeEqual("abc123", "abc124")).toBe(false);
    expect(safeEqual("short", "muchlongerstring")).toBe(false);
  });

  it("sha256Base64Url produces a stable PKCE code_challenge from a verifier", () => {
    const verifier = "constant-test-verifier-value";
    expect(sha256Base64Url(verifier)).toEqual(sha256Base64Url(verifier));
  });
});
