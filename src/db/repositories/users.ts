import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users, type User } from "@/db/schema";
import type { GoogleIdTokenClaims } from "@/lib/oauth/google";

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
 */
export async function createOrGetUserFromGoogle(claims: GoogleIdTokenClaims): Promise<{
  user: User;
  isNewUser: boolean;
}> {
  const inserted = await db
    .insert(users)
    .values({
      googleSub: claims.sub,
      email: claims.email,
      emailVerified: claims.email_verified,
      name: claims.name ?? null,
      avatarUrl: claims.picture ?? null,
      provider: "GOOGLE",
      role: "USER",
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
    // Extremely unlikely (insert conflicted but row vanished), but fail loudly.
    throw new Error("Failed to create or locate user after Google sign-in");
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
