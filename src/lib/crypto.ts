import { randomBytes, createCipheriv, createDecipheriv, createHash, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";

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

// OAuth transaction state is authenticated and encrypted so the callback does
// not depend on a browser retaining cross-site cookies during the Google round trip.
// The PKCE verifier and nonce therefore never appear in the authorization URL in
// plaintext. SESSION_SECRET is already required to be high entropy by env.ts.
const OAUTH_STATE_VERSION = "v1";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function oauthStateKey(): Buffer {
  return createHash("sha256").update(env.SESSION_SECRET).digest();
}

export type OAuthTransaction = {
  verifier: string;
  nonce: string;
  returnTo: string;
  issuedAt: number;
};

export function sealOAuthTransaction(transaction: Omit<OAuthTransaction, "issuedAt">): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", oauthStateKey(), iv);
  const payload = Buffer.from(
    JSON.stringify({ ...transaction, issuedAt: Date.now(), v: OAUTH_STATE_VERSION }),
    "utf8",
  );
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function openOAuthTransaction(state: string): OAuthTransaction {
  try {
    const packed = Buffer.from(state, "base64url");
    if (packed.length < 12 + 16 + 1) throw new Error("Invalid OAuth state");

    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const encrypted = packed.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", oauthStateKey(), iv);
    decipher.setAuthTag(tag);
    const payload = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const parsed = JSON.parse(payload.toString("utf8")) as Partial<OAuthTransaction> & { v?: string };

    if (parsed.v !== OAUTH_STATE_VERSION) throw new Error("Unsupported OAuth state");
    if (typeof parsed.issuedAt !== "number" || Date.now() - parsed.issuedAt > OAUTH_STATE_TTL_MS) {
      throw new Error("Expired OAuth state");
    }
    if (
      typeof parsed.verifier !== "string" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.returnTo !== "string"
    ) {
      throw new Error("Incomplete OAuth state");
    }

    return {
      verifier: parsed.verifier,
      nonce: parsed.nonce,
      returnTo: parsed.returnTo,
      issuedAt: parsed.issuedAt,
    };
  } catch {
    throw new Error("Invalid OAuth state");
  }
}
