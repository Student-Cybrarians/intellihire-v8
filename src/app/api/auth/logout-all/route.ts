import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth/guards";
import { revokeAllSessionsForUser, recordAuditLog } from "@/db/repositories/sessions";
import { SESSION_COOKIE } from "@/lib/cookies";
import { logger } from "@/lib/logger";

export const POST = requireAuth(async (auth) => {
  const revokedCount = await revokeAllSessionsForUser(auth.user.id, "user_logout_all");
  await recordAuditLog({
    actorUserId: auth.user.id,
    action: "LOGOUT_ALL",
    resourceType: "session",
    metadata: { revokedCount },
  });

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);

  logger.info({ userId: auth.user.id, revokedCount }, "auth_logout_all");

  return NextResponse.json({ success: true, revokedCount });
});
