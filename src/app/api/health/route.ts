import { NextResponse } from "next/server";
import { pgPool } from "@/db/client";
import { safeRedis } from "@/lib/redis";

export async function GET() {
  const checks: Record<string, "ok" | "down" | "not_configured"> = { database: "down" };

  try {
    await pgPool.query("SELECT 1");
    checks.database = "ok";
  } catch {
    checks.database = "down";
  }

  checks.redis = safeRedis.isConfigured() ? "ok" : "not_configured";

  const healthy = checks.database === "ok";
  return NextResponse.json({ status: healthy ? "healthy" : "unhealthy", checks }, {
    status: healthy ? 200 : 503,
  });
}
