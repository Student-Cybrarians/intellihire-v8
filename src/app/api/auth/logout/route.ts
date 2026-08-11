import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth/guards";
import { revokeSessionById, recordAuditLog } from "@/db/repositories/sessions";
import { SESSION_COOKIE } from "@/lib/cookies";
import { logger } from "@/lib/logger";

export const POST = requireAuth(async (auth) => {
  await revokeSessionById(auth.session.id, auth.user.id, "user_logout");
  await recordAuditLog({
    actorUserId: auth.user.id,
    action: "LOGOUT",
    resourceType: "session",
    resourceId: auth.session.id,
  });

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);

  logger.info({ userId: auth.user.id, sessionId: auth.session.id }, "auth_logout");

  return NextResponse.json({ success: true });
});
