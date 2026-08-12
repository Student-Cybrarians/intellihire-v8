import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuth } from "@/lib/auth/current";
import { getOverview } from "@/lib/modules/insights/repository";

const querySchema = z.object({ days: z.coerce.number().int().min(1).max(365).optional().default(30) });

export async function GET(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({ days: url.searchParams.get("days") ?? undefined });
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "days must be between 1 and 365" } }, { status: 422 });
    return NextResponse.json(await getOverview(auth.user.id, parsed.data.days), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Module 5 overview failed", error instanceof Error ? { message: error.message } : { error: "unknown" });
    return NextResponse.json({ error: { code: "INSIGHTS_FAILED", message: "Unable to load performance insights" } }, { status: 500 });
  }
}
