import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/cookies";

const PROTECTED_PREFIXES = ["/dashboard", "/admin"];

/**
 * Runs on the Edge runtime (Next.js 16 "proxy" convention, formerly
 * middleware) and cannot reach the database, so it only does a fast, coarse
 * check: is there a session cookie at all? A present-but-invalid/expired/
 * revoked cookie still passes this layer and is rejected authoritatively by
 * `getCurrentAuth()` inside the page/route, which does the real DB lookup.
 * This keeps unauthenticated users off protected pages immediately without
 * pretending the edge proxy can be the source of truth for session validity.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!isProtected) {
    return NextResponse.next();
  }

  const hasSessionCookie = request.cookies.has(SESSION_COOKIE);
  if (!hasSessionCookie) {
    const loginUrl = new URL("/", request.url);
    // returnTo is re-validated server-side (sanitizeReturnTo) before ever
    // being used in a redirect, so this can't become an open-redirect vector.
    loginUrl.searchParams.set("returnTo", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
