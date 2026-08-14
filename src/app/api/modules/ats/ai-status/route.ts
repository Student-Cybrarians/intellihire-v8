import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth/current";
import { aiService } from "@/lib/ai/aiService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth) {
    return NextResponse.json(
      { error: "AUTH_REQUIRED", message: "Please sign in first." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const configuredProvider = process.env.NVIDIA_API_KEY?.trim()
    ? "nvidia"
    : process.env.OPENROUTER_API_KEY?.trim()
      ? "openrouter"
      : "none";

  const health = await aiService.healthCheck();

  return NextResponse.json(
    {
      configured: configuredProvider !== "none",
      provider: configuredProvider,
      healthy: health.healthy,
      details: health.details,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
