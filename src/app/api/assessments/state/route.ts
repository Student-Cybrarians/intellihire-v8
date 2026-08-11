import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuth } from "@/lib/auth/current";
import { getState } from "@/lib/modules/assessment/repository";

const querySchema = z.object({ attemptId: z.string().uuid() });

export async function GET(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  try {
    const url = new URL(request.url);
    const query = querySchema.parse({ attemptId: url.searchParams.get("attemptId") });
    return NextResponse.json(await getState(auth.user.id, query.attemptId));
  } catch (error) {
    return NextResponse.json({ error: { code: "ASSESSMENT_STATE_FAILED", message: (error as Error).message } }, { status: 400 });
  }
}
