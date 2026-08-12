import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuth } from "@/lib/auth/current";
import { startInterview } from "@/lib/modules/technical/repository";

const schema = z.object({ role: z.string().trim().min(1).max(255).optional().nullable() });

function errorResponse(error: unknown) {
  const code = (error as { code?: string }).code;
  const message = error instanceof Error ? error.message : "Unable to start interview";
  const status = code === "INCOMPLETE" ? 422 : code === "CONFLICT" ? 409 : code === "NOT_FOUND" ? 404 : 400;
  return NextResponse.json({ error: { code: code ?? "TECHNICAL_START_FAILED", message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  try {
    const body = schema.parse(await request.json().catch(() => ({})));
    return NextResponse.json(await startInterview(auth.user.id, body.role ?? null), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid role" } }, { status: 422 });
    return errorResponse(error);
  }
}
