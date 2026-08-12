import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { buildGoogleAuthorizationUrl, generatePkcePair } from "@/lib/oauth/google";
import { generateState, generateNonce } from "@/lib/crypto";
import { sanitizeReturnTo } from "@/lib/safeRedirect";
import { rateLimit } from "@/lib/rateLimit";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  OAUTH_NONCE_COOKIE,
  OAUTH_RETURN_TO_COOKIE,
  OAUTH_FLOW_TTL_SECONDS,
  oauthCookieOptions,
} from "@/lib/cookies";
import { errorEnvelope } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const limit = await rateLimit("auth:google:initiate", ip, 20, 60);
  if (!limit.allowed) {
    return NextResponse.json(errorEnvelope("RATE_LIMITED", "Too many sign-in attempts"), {
      status: 429,
      headers: limit.retryAfterSeconds
        ? { "Retry-After": String(limit.retryAfterSeconds) }
        : undefined,
    });
  }

  const { searchParams } = new URL(request.url);
  const returnTo = sanitizeReturnTo(searchParams.get("returnTo"));

  const state = generateState();
  const nonce = generateNonce();
  const { verifier, challenge } = generatePkcePair();

  const authorizationUrl = buildGoogleAuthorizationUrl({ state, nonce, codeChallenge: challenge });

  const cookieStore = await cookies();
  const flowCookieOptions = { ...oauthCookieOptions, maxAge: OAUTH_FLOW_TTL_SECONDS };
  cookieStore.set(OAUTH_STATE_COOKIE, state, flowCookieOptions);
  cookieStore.set(OAUTH_NONCE_COOKIE, nonce, flowCookieOptions);
  cookieStore.set(OAUTH_VERIFIER_COOKIE, verifier, flowCookieOptions);
  cookieStore.set(OAUTH_RETURN_TO_COOKIE, returnTo, flowCookieOptions);

  logger.info({ ip }, "auth_google_initiate");

  return NextResponse.redirect(authorizationUrl);
}
