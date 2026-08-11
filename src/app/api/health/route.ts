import { NextResponse } from "next/server";
import { pgPool } from "@/db/client";
import { safeRedis } from "@/lib/redis";

const REQUIRED_TABLES = [
  "users",
  "devices",
  "sessions",
  "login_history",
  "security_events",
  "audit_logs",
  "assessment_questions",
  "assessment_attempts",
  "assessment_responses",
  "assessment_results",
] as const;

export async function GET() {
  const checks: Record<string, "ok" | "down" | "not_configured"> = {
    database: "down",
    schema: "down",
    redis: safeRedis.isConfigured() ? "ok" : "not_configured",
  };

  try {
    await pgPool.query("SELECT 1");
    checks.database = "ok";
    const result = await pgPool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])`,
      [REQUIRED_TABLES],
    );
    const present = new Set(result.rows.map((row) => row.tablename));
    const missing = REQUIRED_TABLES.filter((table) => !present.has(table));
    checks.schema = missing.length === 0 ? "ok" : "down";
    const healthy = checks.database === "ok" && checks.schema === "ok";
    return NextResponse.json(
      { status: healthy ? "healthy" : "unhealthy", checks, ...(missing.length ? { missing_tables: missing } : {}) },
      { status: healthy ? 200 : 503 },
    );
  } catch {
    return NextResponse.json({ status: "unhealthy", checks }, { status: 503 });
  }
}
