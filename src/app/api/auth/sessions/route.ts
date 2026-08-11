import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { listSessionsForUser } from "@/db/repositories/sessions";

export const GET = requireAuth(async (auth) => {
  const sessions = await listSessionsForUser(auth.user.id);
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      isCurrent: s.id === auth.session.id,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      expiresAt: s.expiresAt,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
    })),
  });
});
