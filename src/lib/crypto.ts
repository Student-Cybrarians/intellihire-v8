import { randomBytes, createHash, timingSafeEqual } from "crypto";

/** High-entropy opaque token (256 bits), URL-safe base64. Used for session/refresh tokens. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/** PKCE code_verifier — 43-128 chars per RFC 7636; we use 64 bytes -> 86 base64url chars. */
export function generateCodeVerifier(): string {
  return randomBytes(64).toString("base64url");
}

export function sha256Base64Url(input: string): string {
  return createHash("sha256").update(input).digest("base64url");
}

/** SHA-256 hex digest — used to store only a hash of session/refresh tokens in the DB. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateState(): string {
  return randomBytes(24).toString("base64url");
}

export function generateNonce(): string {
  return randomBytes(24).toString("base64url");
}

/** Constant-time string comparison to avoid timing side-channels on token/state checks. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
