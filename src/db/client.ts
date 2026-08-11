import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

// Reuse the pool/client across hot reloads in dev and across serverless
// invocations on the same lambda instance.
const globalForDb = globalThis as unknown as {
  pgPool?: Pool;
};

export const pgPool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    max: env.NODE_ENV === "production" ? 10 : 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

if (env.NODE_ENV !== "production") {
  globalForDb.pgPool = pgPool;
}

export const db = drizzle(pgPool, { schema });
