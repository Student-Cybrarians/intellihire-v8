import { NextResponse } from "next/server";
import { pgPool } from "@/db/client";
import { safeRedis } from "@/lib/redis";

const REQUIRED_AUTH_TABLES = [
  "users",
  "devices",
  "sessions",
  "login_history",
  "security_events",
  "audit_logs",
] as const;

export async function GET() {
  const checks: Record<string, "ok" | "down" | "not_configured"> = {
    database: "down",
    auth_schema: "down",
  };

  try {
    await pgPool.query("SELECT 1");
    checks.database = "ok";

    const result = await pgPool.query<{ tablename: string }>(
      `SELECT tablename
       FROM pg_catalog.pg_tables
       WHERE schemaname = 'public'
         AND tablename = ANY($1::text[])`,
      [REQUIRED_AUTH_TABLES],
    );

    const present = new Set(result.rows.map((row) => row.tablename));
    const missing = REQUIRED_AUTH_TABLES.filter((table) => !present.has(table));
    checks.auth_schema = missing.length === 0 ? "ok" : "down";

    checks.redis = safeRedis.isConfigured() ? "ok" : "not_configured";

    const healthy = checks.database === "ok" && checks.auth_schema === "ok";
    return NextResponse.json(
      {
        status: healthy ? "healthy" : "unhealthy",
        checks,
        ...(missing.length > 0 ? { missing_auth_tables: missing } : {}),
      },
      { status: healthy ? 200 : 503 },
    );
  } catch {
    checks.redis = safeRedis.isConfigured() ? "ok" : "not_configured";
    return NextResponse.json({ status: "unhealthy", checks }, { status: 503 });
  }
}
