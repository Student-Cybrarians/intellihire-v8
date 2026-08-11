import { NextResponse } from "next/server";
import { getCurrentAuth, type AuthContext } from "./current";
import type { User } from "@/db/schema";

export function errorEnvelope(code: string, message: string) {
  return { error: { code, message } };
}

type RouteHandler = (auth: AuthContext, request: Request) => Promise<Response> | Response;

/** Wrap a route handler so it only runs for an authenticated, active user. */
export function requireAuth(handler: RouteHandler) {
  return async (request: Request): Promise<Response> => {
    const auth = await getCurrentAuth();
    if (!auth) {
      return NextResponse.json(errorEnvelope("UNAUTHENTICATED", "Sign in required"), {
        status: 401,
      });
    }
    return handler(auth, request);
  };
}

/** Role-based guard. Roles are coarse (USER/ADMIN); use requirePermission for finer control. */
export function requireRole(role: User["role"], handler: RouteHandler) {
  return requireAuth(async (auth, request) => {
    if (auth.user.role !== role && auth.user.role !== "ADMIN") {
      return NextResponse.json(
        errorEnvelope("FORBIDDEN", "You do not have permission to perform this action"),
        { status: 403 },
      );
    }
    return handler(auth, request);
  });
}

/**
 * Permission-based guard, forward-compatible with a future granular
 * permissions table. For now, ADMIN implicitly holds every permission and
 * USER holds none — future modules register real permission checks here
 * without changing call sites.
 */
export function requirePermission(permission: string, handler: RouteHandler) {
  return requireAuth(async (auth, request) => {
    const hasPermission = auth.user.role === "ADMIN";
    if (!hasPermission) {
      return NextResponse.json(
        errorEnvelope("FORBIDDEN", `Missing required permission: ${permission}`),
        { status: 403 },
      );
    }
    return handler(auth, request);
  });
}
