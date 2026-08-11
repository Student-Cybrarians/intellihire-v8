import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuth } from "@/lib/auth/current";
import { answerQuestion } from "@/lib/modules/technical/repository";

const schema = z.object({
  interviewId: z.string().uuid(),
  questionId: z.string().uuid(),
  answerText: z.string().trim().min(1).max(10000),
  code: z.string().max(20000).optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  try {
    const body = schema.parse(await request.json());
    return NextResponse.json(await answerQuestion(auth.user.id, body.interviewId, body.questionId, body.answerText, body.code ?? null));
  } catch (error) {
    return NextResponse.json({ error: { code: "TECHNICAL_ANSWER_FAILED", message: (error as Error).message } }, { status: 400 });
  }
}
