import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { pgPool } from "@/db/client";
import {
  exchangeCodeForTokens,
  verifyGoogleIdToken,
  OAuthError,
} from "@/lib/oauth/google";
import { openOAuthTransaction } from "@/lib/crypto";
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

const REQUIRED_AUTH_TABLES = [
  "users",
  "devices",
  "sessions",
  "login_history",
  "security_events",
  "audit_logs",
] as const;

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

async function bestEffortSecurityEvent(params: Parameters<typeof recordSecurityEvent>[0]): Promise<void> {
  try {
    await recordSecurityEvent(params);
  } catch (err) {
    logger.error({ err: (err as Error).message, eventType: params.eventType }, "auth_security_event_write_failed");
  }
}

async function bestEffortLoginHistory(params: Parameters<typeof recordLoginHistory>[0]): Promise<void> {
  try {
    await recordLoginHistory(params);
  } catch (err) {
    logger.error({ err: (err as Error).message, failureReason: params.failureReason }, "auth_login_history_write_failed");
  }
}

async function assertAuthSchema(): Promise<void> {
  const result = await pgPool.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])`,
    [REQUIRED_AUTH_TABLES],
  );

  const present = new Set(result.rows.map((row) => row.table_name));
  const missing = REQUIRED_AUTH_TABLES.filter((table) => !present.has(table));
  if (missing.length > 0) {
    throw new OAuthError(
      `Authentication schema incomplete: missing ${missing.join(", ")}`,
      "database_schema_missing",
    );
  }
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

  let stage = "callback_started";

  try {
    if (googleError) {
      stage = "google_denied";
      await bestEffortLoginHistory({
        userId: null,
        success: false,
        failureReason: `google_error:${googleError}`,
        ipAddress: ip,
        userAgent,
      });
      return failureRedirect("access_denied");
    }

    if (!code || !returnedState) {
      stage = "oauth_request_validation";
      return failureRedirect("invalid_request");
    }

    // The encrypted state is now the authoritative OAuth transaction. This
    // removes the fragile dependency on four browser cookies surviving the
    // Google cross-site redirect while keeping the PKCE verifier confidential.
    stage = "oauth_state_validation";
    let transaction;
    try {
      transaction = openOAuthTransaction(returnedState);
    } catch {
      return failureRedirect("invalid_request");
    }

    const codeVerifier = transaction.verifier;
    const expectedNonce = transaction.nonce;
    const returnTo = sanitizeReturnTo(transaction.returnTo);

    stage = "database_schema_check";
    await assertAuthSchema();

    stage = "google_token_exchange";
    const { idToken } = await exchangeCodeForTokens(code, codeVerifier);

    stage = "google_id_token_verification";
    const claims = await verifyGoogleIdToken(idToken, expectedNonce);

    stage = "user_create_or_lookup";
    const { user, isNewUser } = await createOrGetUserFromGoogle(claims);

    if (user.status !== "ACTIVE") {
      stage = "account_status_check";
      await bestEffortLoginHistory({
        userId: user.id,
        success: false,
        failureReason: `account_${user.status.toLowerCase()}`,
        ipAddress: ip,
        userAgent,
      });
      await bestEffortSecurityEvent({
        userId: user.id,
        eventType: "login_blocked_account_status",
        severity: "MEDIUM",
        metadata: { status: user.status },
      });
      return failureRedirect("account_suspended");
    }

    if (!isNewUser) {
      stage = "profile_sync";
      await syncProfileFromGoogle(user.id, claims);
    }

    stage = "session_device_create";
    const deviceId = await upsertDevice({ userId: user.id, userAgent });

    stage = "session_create";
    const { rawToken } = await createSession({
      userId: user.id,
      deviceId,
      ipAddress: ip,
      userAgent,
    });

    try {
      await markLogin(user.id);
    } catch (err) {
      logger.error({ err: (err as Error).message, userId: user.id }, "auth_mark_login_failed");
    }

    await bestEffortLoginHistory({
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
      logger.warn({ code: err.code, stage }, "auth_google_callback_failed");
      await bestEffortSecurityEvent({
        userId: null,
        eventType: `oauth_failure:${err.code}`,
        severity: "MEDIUM",
        metadata: { ip, stage },
      });
      return failureRedirect(err.code);
    }

    logger.error({ err: (err as Error).message, stage }, "auth_google_callback_unexpected_error");

    if (stage === "user_create_or_lookup" || stage === "profile_sync" || stage === "database_schema_check") {
      return failureRedirect("database_error");
    }
    if (stage === "session_device_create" || stage === "session_create") {
      return failureRedirect("session_error");
    }

    return failureRedirect("server_error");
  }
}
