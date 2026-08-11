import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "@/lib/env";
import { generateCodeVerifier, sha256Base64Url } from "@/lib/crypto";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_ISSUER_ALLOWLIST = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";

// Cached across invocations on the same server instance.
const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URI));

export type GoogleIdTokenClaims = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  iss: string;
  aud: string;
  exp: number;
  nonce?: string;
};

export function buildGoogleAuthorizationUrl(params: {
  state: string;
  nonce: string;
  codeChallenge: string;
}): string {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.GOOGLE_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  // Only ever offer the Google account chooser — no silent auto-login.
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = generateCodeVerifier();
  const challenge = sha256Base64Url(verifier);
  return { verifier, challenge };
}

class OAuthError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "OAuthError";
  }
}
export { OAuthError };

/** Exchange an authorization code for tokens using the PKCE verifier. Never logs the code or tokens. */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<{ idToken: string; accessToken?: string }> {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  let response: Response;
  try {
    response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
  } catch {
    throw new OAuthError("Failed to reach Google token endpoint", "token_endpoint_unreachable");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new OAuthError(`Google token exchange failed (${response.status})`, "token_exchange_failed");
  }

  const data = (await response.json()) as { id_token?: string; access_token?: string };
  if (!data.id_token) {
    throw new OAuthError("Google response did not include an id_token", "missing_id_token");
  }

  return { idToken: data.id_token, accessToken: data.access_token };
}

/**
 * Verify a Google ID token: signature against Google's live JWKS, issuer,
 * audience, expiration, and (when provided) nonce. Never trust claims from
 * a token that hasn't passed every one of these checks.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  expectedNonce: string,
): Promise<GoogleIdTokenClaims> {
  let payload;
  try {
    const result = await jwtVerify(idToken, jwks, {
      issuer: GOOGLE_ISSUER_ALLOWLIST,
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = result.payload;
  } catch (err) {
    throw new OAuthError(`ID token verification failed: ${(err as Error).message}`, "invalid_id_token");
  }

  const claims = payload as unknown as GoogleIdTokenClaims;

  if (!claims.nonce || claims.nonce !== expectedNonce) {
    throw new OAuthError("ID token nonce mismatch", "nonce_mismatch");
  }

  if (!claims.email_verified) {
    throw new OAuthError("Google account email is not verified", "email_not_verified");
  }

  if (!claims.sub) {
    throw new OAuthError("ID token missing subject claim", "missing_sub");
  }

  return claims;
}
