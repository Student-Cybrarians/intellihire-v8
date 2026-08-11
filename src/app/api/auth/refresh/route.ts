import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { requireAuth } from "@/lib/auth/guards";
import { extendSession } from "@/db/repositories/sessions";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, baseCookieOptions } from "@/lib/cookies";
import { rateLimit } from "@/lib/rateLimit";
import { errorEnvelope } from "@/lib/auth/guards";

/**
 * This architecture uses a single opaque, server-managed session token
 * (see docs/ARCHITECTURE.md) rather than a short-lived JWT access token
 * paired with a separate refresh token — there is no access token to
 * expire quickly, so there's nothing to rotate in the classic sense.
 * This endpoint instead performs sliding-window renewal: it pushes the
 * session's expiry forward as long as the session is still valid, so an
 * active user is never abruptly logged out mid-session.
 */
export const POST = requireAuth(async (auth) => {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const limit = await rateLimit("auth:refresh", ip, 60, 60);
  if (!limit.allowed) {
    return NextResponse.json(errorEnvelope("RATE_LIMITED", "Too many refresh attempts"), {
      status: 429,
    });
  }

  const rawToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!rawToken) {
    return NextResponse.json(errorEnvelope("UNAUTHENTICATED", "Sign in required"), { status: 401 });
  }

  await extendSession(auth.session.id);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, rawToken, { ...baseCookieOptions, maxAge: SESSION_TTL_SECONDS });

  return NextResponse.json({ success: true, expiresInSeconds: SESSION_TTL_SECONDS });
});
