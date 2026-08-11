import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuth } from "@/lib/auth/current";
import { startInterview } from "@/lib/modules/technical/repository";

const schema = z.object({ role: z.string().trim().max(255).optional().nullable() });

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  try {
    const body = schema.parse(await request.json().catch(() => ({})));
    return NextResponse.json(await startInterview(auth.user.id, body.role ?? null));
  } catch (error) {
    return NextResponse.json({ error: { code: "TECHNICAL_START_FAILED", message: (error as Error).message } }, { status: 400 });
  }
}
