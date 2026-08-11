import { describe, it, expect, beforeAll, vi } from "vitest";
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet } from "jose";

// Intercept jose's createRemoteJWKSet so verifyGoogleIdToken checks signatures
// against a JWKS we control in-memory, instead of making a real network call
// to Google. jwtVerify itself is untouched — every real validation path
// (signature, issuer, audience, expiry) still runs for real.
let testJwks: ReturnType<typeof createLocalJWKSet>;

vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return {
    ...actual,
    createRemoteJWKSet: () => (...args: Parameters<ReturnType<typeof actual.createLocalJWKSet>>) =>
      testJwks(...args),
  };
});

const { verifyGoogleIdToken, OAuthError } = await import("@/lib/oauth/google");

let privateKey: CryptoKey;
const kid = "test-key-1";

beforeAll(async () => {
  const { privateKey: priv, publicKey } = await generateKeyPair("RS256");
  privateKey = priv;
  const jwk = await exportJWK(publicKey);
  jwk.kid = kid;
  jwk.alg = "RS256";
  jwk.use = "sig";
  testJwks = createLocalJWKSet({ keys: [jwk] });
});

const VALID_AUD = "test-client-id.apps.googleusercontent.com"; // matches test/setup.ts GOOGLE_CLIENT_ID
const VALID_NONCE = "expected-nonce-value";

async function signToken(claims: Record<string, unknown>, opts?: { expiresIn?: string }) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuedAt()
    .setExpirationTime(opts?.expiresIn ?? "10m")
    .sign(privateKey);
}

function baseClaims(overrides: Record<string, unknown> = {}) {
  return {
    iss: "https://accounts.google.com",
    aud: VALID_AUD,
    sub: "google-sub-12345",
    email: "student@example.com",
    email_verified: true,
    name: "Test Student",
    picture: "https://example.com/avatar.png",
    nonce: VALID_NONCE,
    ...overrides,
  };
}

describe("verifyGoogleIdToken", () => {
  it("accepts a validly signed token with correct issuer/audience/nonce", async () => {
    const token = await signToken(baseClaims());
    const claims = await verifyGoogleIdToken(token, VALID_NONCE);
    expect(claims.sub).toBe("google-sub-12345");
    expect(claims.email).toBe("student@example.com");
  });

  it("rejects a token signed by an untrusted key", async () => {
    const { privateKey: otherKey } = await generateKeyPair("RS256");
    const token = await new SignJWT(baseClaims())
      .setProtectedHeader({ alg: "RS256", kid: "unknown-kid" })
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(otherKey);

    await expect(verifyGoogleIdToken(token, VALID_NONCE)).rejects.toThrow(OAuthError);
  });

  it("rejects a token with the wrong issuer", async () => {
    const token = await signToken(baseClaims({ iss: "https://evil-issuer.example.com" }));
    await expect(verifyGoogleIdToken(token, VALID_NONCE)).rejects.toThrow(OAuthError);
  });

  it("rejects a token with the wrong audience", async () => {
    const token = await signToken(baseClaims({ aud: "some-other-clients-id.apps.googleusercontent.com" }));
    await expect(verifyGoogleIdToken(token, VALID_NONCE)).rejects.toThrow(OAuthError);
  });

  it("rejects an expired token", async () => {
    const token = await signToken(baseClaims(), { expiresIn: "-10m" });
    await expect(verifyGoogleIdToken(token, VALID_NONCE)).rejects.toThrow(OAuthError);
  });

  it("rejects a nonce that doesn't match the one issued for this flow", async () => {
    const token = await signToken(baseClaims({ nonce: "some-other-nonce" }));
    await expect(verifyGoogleIdToken(token, VALID_NONCE)).rejects.toThrow(/nonce/i);
  });

  it("rejects an unverified email even with a valid signature", async () => {
    const token = await signToken(baseClaims({ email_verified: false }));
    await expect(verifyGoogleIdToken(token, VALID_NONCE)).rejects.toThrow(/email/i);
  });

  it("rejects a token missing the sub claim", async () => {
    const claims = baseClaims();
    delete (claims as Record<string, unknown>).sub;
    const token = await signToken(claims);
    await expect(verifyGoogleIdToken(token, VALID_NONCE)).rejects.toThrow(OAuthError);
  });
});
