import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuth } from "@/lib/auth/current";
import { recordAnswer, getState } from "@/lib/modules/assessment/repository";

const bodySchema = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string().uuid(),
  answerIndex: z.number().int().min(0).max(20),
  responseMs: z.number().int().min(0).max(10 * 60 * 1000).nullable().optional(),
});

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  try {
    const body = bodySchema.parse(await request.json());
    const result = await recordAnswer(auth.user.id, body.attemptId, body.questionId, body.answerIndex, body.responseMs ?? null);
    const state = await getState(auth.user.id, body.attemptId);
    return NextResponse.json({ ...result, state });
  } catch (error) {
    return NextResponse.json({ error: { code: "ASSESSMENT_ANSWER_FAILED", message: (error as Error).message } }, { status: 400 });
  }
}
