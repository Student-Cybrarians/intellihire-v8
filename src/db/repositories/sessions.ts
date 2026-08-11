import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, devices, loginHistory, securityEvents, auditLogs, type Session } from "@/db/schema";
import { generateOpaqueToken, hashToken } from "@/lib/crypto";
import { SESSION_TTL_SECONDS } from "@/lib/cookies";

export async function upsertDevice(params: {
  userId: string;
  userAgent: string | null;
}): Promise<string> {
  // Simple heuristic device grouping: one device row per (user, user-agent).
  // Good enough for "list your devices" UX without fingerprinting libraries.
  const label = params.userAgent ?? "Unknown device";
  const [existing] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.userId, params.userId), eq(devices.label, label)))
    .limit(1);

  if (existing) {
    await db.update(devices).set({ lastSeenAt: sql`now()` }).where(eq(devices.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(devices)
    .values({ userId: params.userId, label, userAgent: params.userAgent })
    .returning();
  return created.id;
}

export async function createSession(params: {
  userId: string;
  deviceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<{ session: Session; rawToken: string }> {
  const rawToken = generateOpaqueToken();
  const [session] = await db
    .insert(sessions)
    .values({
      userId: params.userId,
      tokenHash: hashToken(rawToken),
      deviceId: params.deviceId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
    })
    .returning();
  return { session, rawToken };
}

export async function findActiveSessionByToken(rawToken: string): Promise<Session | undefined> {
  const tokenHash = hashToken(rawToken);
  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt), sql`${sessions.expiresAt} > now()`),
    )
    .limit(1);
  return session;
}

export async function touchSession(sessionId: string): Promise<void> {
  await db.update(sessions).set({ lastSeenAt: sql`now()` }).where(eq(sessions.id, sessionId));
}

/** Sliding-window renewal: push expiresAt forward from now, capped at SESSION_TTL_SECONDS. */
export async function extendSession(sessionId: string): Promise<Session> {
  const [updated] = await db
    .update(sessions)
    .set({
      lastSeenAt: sql`now()`,
      expiresAt: sql`now() + interval '${sql.raw(String(SESSION_TTL_SECONDS))} seconds'`,
    })
    .where(eq(sessions.id, sessionId))
    .returning();
  return updated;
}

export async function listSessionsForUser(userId: string): Promise<Session[]> {
  return db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
    .orderBy(sql`${sessions.lastSeenAt} desc`);
}

export async function revokeSessionById(
  sessionId: string,
  userId: string,
  reason: string,
): Promise<boolean> {
  const result = await db
    .update(sessions)
    .set({ revokedAt: sql`now()`, revokedReason: reason })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId), isNull(sessions.revokedAt)))
    .returning();
  return result.length > 0;
}

export async function revokeAllSessionsForUser(userId: string, reason: string): Promise<number> {
  const result = await db
    .update(sessions)
    .set({ revokedAt: sql`now()`, revokedReason: reason })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
    .returning();
  return result.length;
}

export async function recordLoginHistory(params: {
  userId: string | null;
  success: boolean;
  failureReason?: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(loginHistory).values({
    userId: params.userId,
    provider: "GOOGLE",
    success: params.success,
    failureReason: params.failureReason,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: params.metadata,
  });
}

export async function recordSecurityEvent(params: {
  userId: string | null;
  eventType: string;
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(securityEvents).values(params);
}

export async function recordAuditLog(params: {
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(auditLogs).values(params);
}
