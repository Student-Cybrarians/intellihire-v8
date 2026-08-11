import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentAuth } from "@/lib/auth/current";
import { errorEnvelope } from "@/lib/auth/guards";
import { revokeSessionById, recordAuditLog } from "@/db/repositories/sessions";
import { SESSION_COOKIE } from "@/lib/cookies";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentAuth();
  if (!auth) {
    return NextResponse.json(errorEnvelope("UNAUTHENTICATED", "Sign in required"), { status: 401 });
  }

  const { id } = await context.params;
  const revoked = await revokeSessionById(id, auth.user.id, "user_revoked_device");

  if (!revoked) {
    // Either it doesn't exist or doesn't belong to this user — don't leak which (IDOR-safe 404).
    return NextResponse.json(errorEnvelope("NOT_FOUND", "Session not found"), { status: 404 });
  }

  await recordAuditLog({
    actorUserId: auth.user.id,
    action: "REVOKE_SESSION",
    resourceType: "session",
    resourceId: id,
  });

  if (id === auth.session.id) {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
  }

  return NextResponse.json({ success: true });
}
