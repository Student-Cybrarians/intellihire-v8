import { cookies } from "next/headers";
import { findActiveSessionByToken, touchSession } from "@/db/repositories/sessions";
import { findUserById, touchActivity } from "@/db/repositories/users";
import { SESSION_COOKIE } from "@/lib/cookies";
import type { Session, User } from "@/db/schema";

export type AuthContext = { user: User; session: Session };

/**
 * Resolves the caller's identity from the HttpOnly session cookie. Returns
 * null for missing/invalid/expired/revoked sessions and for any user whose
 * account is no longer ACTIVE — callers must not distinguish these cases in
 * user-facing responses (all collapse to 401/redirect-to-login).
 */
export async function getCurrentAuth(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!rawToken) return null;

  const session = await findActiveSessionByToken(rawToken);
  if (!session) return null;

  const user = await findUserById(session.userId);
  if (!user || user.status !== "ACTIVE" || user.deletedAt) return null;

  // Fire-and-forget activity/session touch — don't block the response on it.
  void touchSession(session.id);
  void touchActivity(user.id);

  return { user, session };
}
