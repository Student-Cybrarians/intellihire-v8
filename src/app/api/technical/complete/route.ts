import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuth } from "@/lib/auth/current";
import { completeInterview } from "@/lib/modules/technical/repository";

const schema = z.object({ interviewId: z.string().uuid() });

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  try {
    const body = schema.parse(await request.json());
    return NextResponse.json(await completeInterview(auth.user.id, body.interviewId));
  } catch (error) {
    return NextResponse.json({ error: { code: "TECHNICAL_COMPLETE_FAILED", message: (error as Error).message } }, { status: 400 });
  }
}
