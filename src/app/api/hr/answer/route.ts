import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuth } from "@/lib/auth/current";
import { answerQuestion } from "@/lib/modules/hr/repository";

const schema = z.object({ interviewId: z.string().uuid(), questionId: z.string().uuid(), answer: z.string().trim().min(10).max(10000) });

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  try {
    const body = schema.parse(await request.json());
    return NextResponse.json(await answerQuestion(auth.user.id, body.interviewId, body.questionId, body.answer), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Provide a valid interview, question, and answer" } }, { status: 422 });
    const code = (error as { code?: string }).code;
    const status = code === "NOT_FOUND" ? 404 : code === "CONFLICT" ? 409 : code === "VALIDATION_ERROR" ? 422 : 500;
    return NextResponse.json({ error: { code: code ?? "HR_ANSWER_FAILED", message: error instanceof Error ? error.message : "Unable to evaluate answer" } }, { status });
  }
}
