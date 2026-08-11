import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  exchangeCodeForTokens,
  verifyGoogleIdToken,
  OAuthError,
} from "@/lib/oauth/google";
import { safeEqual } from "@/lib/crypto";
import {
  createOrGetUserFromGoogle,
  syncProfileFromGoogle,
  markLogin,
} from "@/db/repositories/users";
import {
  createSession,
  upsertDevice,
  recordLoginHistory,
  recordSecurityEvent,
} from "@/db/repositories/sessions";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  OAUTH_NONCE_COOKIE,
  OAUTH_RETURN_TO_COOKIE,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  baseCookieOptions,
} from "@/lib/cookies";
import { sanitizeReturnTo } from "@/lib/safeRedirect";
import { rateLimit } from "@/lib/rateLimit";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

function clearOAuthCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  for (const name of [
    OAUTH_STATE_COOKIE,
    OAUTH_NONCE_COOKIE,
    OAUTH_VERIFIER_COOKIE,
    OAUTH_RETURN_TO_COOKIE,
  ]) {
    cookieStore.delete(name);
  }
}

function failureRedirect(reason: string) {
  const url = new URL("/", env.APP_URL);
  url.searchParams.set("auth_error", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = headerList.get("user-agent");
  const cookieStore = await cookies();

  const limit = await rateLimit("auth:google:callback", ip, 30, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Too many attempts" } }, {
      status: 429,
    });
  }

  const { searchParams } = new URL(request.url);
  const googleError = searchParams.get("error");
  const returnedState = searchParams.get("state");
  const code = searchParams.get("code");

  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  const expectedNonce = cookieStore.get(OAUTH_NONCE_COOKIE)?.value;
  const codeVerifier = cookieStore.get(OAUTH_VERIFIER_COOKIE)?.value;
  const returnTo = sanitizeReturnTo(cookieStore.get(OAUTH_RETURN_TO_COOKIE)?.value);

  try {
    if (googleError) {
      await recordLoginHistory({
        userId: null,
        success: false,
        failureReason: `google_error:${googleError}`,
        ipAddress: ip,
        userAgent,
      });
      return failureRedirect("access_denied");
    }

    if (!code || !returnedState || !expectedState || !expectedNonce || !codeVerifier) {
      return failureRedirect("invalid_request");
    }

    if (!safeEqual(returnedState, expectedState)) {
      await recordSecurityEvent({
        userId: null,
        eventType: "oauth_state_mismatch",
        severity: "HIGH",
        metadata: { ip },
      });
      return failureRedirect("state_mismatch");
    }

    const { idToken } = await exchangeCodeForTokens(code, codeVerifier);
    const claims = await verifyGoogleIdToken(idToken, expectedNonce);

    const { user, isNewUser } = await createOrGetUserFromGoogle(claims);

    if (user.status !== "ACTIVE") {
      await recordLoginHistory({
        userId: user.id,
        success: false,
        failureReason: `account_${user.status.toLowerCase()}`,
        ipAddress: ip,
        userAgent,
      });
      await recordSecurityEvent({
        userId: user.id,
        eventType: "login_blocked_account_status",
        severity: "MEDIUM",
        metadata: { status: user.status },
      });
      return failureRedirect("account_suspended");
    }

    if (!isNewUser) {
      await syncProfileFromGoogle(user.id, claims);
    }

    const deviceId = await upsertDevice({ userId: user.id, userAgent });
    const { rawToken } = await createSession({
      userId: user.id,
      deviceId,
      ipAddress: ip,
      userAgent,
    });

    await markLogin(user.id);
    await recordLoginHistory({
      userId: user.id,
      success: true,
      ipAddress: ip,
      userAgent,
      metadata: { isNewUser },
    });

    clearOAuthCookies(cookieStore);
    cookieStore.set(SESSION_COOKIE, rawToken, {
      ...baseCookieOptions,
      maxAge: SESSION_TTL_SECONDS,
    });

    logger.info({ userId: user.id, isNewUser }, "auth_google_login_success");

    const destination =
      returnTo === "/dashboard" && user.role === "ADMIN" ? "/admin" : returnTo;
    return NextResponse.redirect(new URL(destination, env.APP_URL));
  } catch (err) {
    clearOAuthCookies(cookieStore);

    if (err instanceof OAuthError) {
      logger.warn({ code: err.code }, "auth_google_callback_failed");
      await recordSecurityEvent({
        userId: null,
        eventType: `oauth_failure:${err.code}`,
        severity: "MEDIUM",
        metadata: { ip },
      });
      return failureRedirect(err.code);
    }

    logger.error({ err: (err as Error).message }, "auth_google_callback_unexpected_error");
    return failureRedirect("server_error");
  }
}
