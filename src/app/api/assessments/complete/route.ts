import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuth } from "@/lib/auth/current";
import { completeAttempt } from "@/lib/modules/assessment/repository";

const bodySchema = z.object({ attemptId: z.string().uuid() });

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  try {
    const body = bodySchema.parse(await request.json());
    return NextResponse.json(await completeAttempt(auth.user.id, body.attemptId));
  } catch (error) {
    return NextResponse.json({ error: { code: "ASSESSMENT_COMPLETE_FAILED", message: (error as Error).message } }, { status: 400 });
  }
}
