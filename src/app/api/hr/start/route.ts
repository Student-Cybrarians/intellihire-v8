import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuth } from "@/lib/auth/current";
import { startInterview } from "@/lib/modules/hr/repository";

const schema = z.object({ role: z.string().trim().min(1).max(255).optional().nullable(), company: z.string().trim().min(1).max(255).optional().nullable() });

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  try {
    const body = schema.parse(await request.json().catch(() => ({})));
    const result = await startInterview(auth.user.id, body.role ?? null, body.company ?? null);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid role or company" } }, { status: 422 });
    return NextResponse.json({ error: { code: "HR_START_FAILED", message: error instanceof Error ? error.message : "Unable to start HR interview" } }, { status: 500 });
  }
}
