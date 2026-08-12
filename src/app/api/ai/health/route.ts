import { NextResponse } from "next/server";
import { aiService } from "@/lib/ai/aiService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const health = await aiService.healthCheck();

  return NextResponse.json(
    {
      provider: process.env.NVIDIA_API_KEY?.trim() ? "nvidia" : "openrouter",
      ...health,
    },
    {
      status: health.healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
