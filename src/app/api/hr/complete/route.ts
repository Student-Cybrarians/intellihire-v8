import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuth } from "@/lib/auth/current";
import { completeInterview } from "@/lib/modules/hr/repository";

const schema = z.object({ interviewId: z.string().uuid() });

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  try {
    const body = schema.parse(await request.json());
    return NextResponse.json(await completeInterview(auth.user.id, body.interviewId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid interview id" } }, { status: 422 });
    const code = (error as { code?: string }).code;
    const status = code === "NOT_FOUND" ? 404 : code === "CONFLICT" ? 409 : code === "INCOMPLETE" ? 422 : 500;
    return NextResponse.json({ error: { code: code ?? "HR_COMPLETE_FAILED", message: error instanceof Error ? error.message : "Unable to complete interview" } }, { status });
  }
}
