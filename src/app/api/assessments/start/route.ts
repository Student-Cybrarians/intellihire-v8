import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuth } from "@/lib/auth/current";
import { startAttempt } from "@/lib/modules/assessment/repository";

const bodySchema = z.object({ role: z.string().trim().max(255).optional().nullable() });

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  try {
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const state = await startAttempt(auth.user.id, body.role ?? null);
    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json({ error: { code: "ASSESSMENT_START_FAILED", message: (error as Error).message } }, { status: 400 });
  }
}
