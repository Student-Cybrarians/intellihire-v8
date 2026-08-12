import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users, type User } from "@/db/schema";
import type { GoogleIdTokenClaims } from "@/lib/oauth/google";
import { env } from "@/lib/env";

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The single administrator identity is configured server-side. Google must
 * have verified the email before it can receive ADMIN privileges.
 */
export function isConfiguredAdminEmail(email: string, emailVerified = true): boolean {
  return emailVerified && normalizedEmail(email) === normalizedEmail(env.ADMIN_EMAIL);
}

export async function findUserByGoogleSub(googleSub: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.googleSub, googleSub)).limit(1);
  return user;
}

export async function findUserById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}

/**
 * Concurrency-safe first-login. Two simultaneous OAuth callbacks for the same
 * Google account race to INSERT; the unique index on `google_sub` guarantees
 * only one row is created. `ON CONFLICT DO NOTHING` + re-select turns the
 * loser of the race into a normal "returning user" read instead of an error.
 *
 * ADMIN is never user-selectable: it is derived exclusively from the single
 * verified email configured in ADMIN_EMAIL.
 */
export async function createOrGetUserFromGoogle(claims: GoogleIdTokenClaims): Promise<{
  user: User;
  isNewUser: boolean;
}> {
  const shouldBeAdmin = isConfiguredAdminEmail(claims.email, claims.email_verified);

  const inserted = await db
    .insert(users)
    .values({
      googleSub: claims.sub,
      email: claims.email,
      emailVerified: claims.email_verified,
      name: claims.name ?? null,
      avatarUrl: claims.picture ?? null,
      provider: "GOOGLE",
      role: shouldBeAdmin ? "ADMIN" : "USER",
      status: "ACTIVE",
    })
    .onConflictDoNothing({ target: users.googleSub })
    .returning();

  if (inserted.length > 0) {
    return { user: inserted[0], isNewUser: true };
  }

  // Lost the race (or already existed) — read the authoritative row.
  const existing = await findUserByGoogleSub(claims.sub);
  if (!existing) {
    throw new Error("Failed to create or locate user after Google sign-in");
  }

  // Reconcile the application-controlled role on every Google login. This
  // prevents stale ADMIN rows from retaining access after ADMIN_EMAIL changes
  // and promotes the configured account even if it was created previously.
  const expectedRole = shouldBeAdmin ? "ADMIN" : "USER";
  if (existing.role !== expectedRole) {
    const [updated] = await db
      .update(users)
      .set({ role: expectedRole, updatedAt: sql`now()` })
      .where(eq(users.id, existing.id))
      .returning();
    return { user: updated, isNewUser: false };
  }

  return { user: existing, isNewUser: false };
}

/**
 * On returning login, sync only the profile fields Google owns (name, avatar,
 * verified email). Application-controlled fields — role, status — are never
 * touched here.
 */
export async function syncProfileFromGoogle(
  userId: string,
  claims: GoogleIdTokenClaims,
): Promise<User> {
  const [updated] = await db
    .update(users)
    .set({
      email: claims.email,
      emailVerified: claims.email_verified,
      name: claims.name ?? null,
      avatarUrl: claims.picture ?? null,
      updatedAt: sql`now()`,
    })
    .where(eq(users.id, userId))
    .returning();
  return updated;
}

export async function markLogin(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ lastLoginAt: sql`now()`, lastActivityAt: sql`now()` })
    .where(eq(users.id, userId));
}

export async function touchActivity(userId: string): Promise<void> {
  await db.update(users).set({ lastActivityAt: sql`now()` }).where(eq(users.id, userId));
}
