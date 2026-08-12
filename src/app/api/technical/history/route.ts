import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth/current";
import { listInterviewHistory } from "@/lib/modules/technical/repository";

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  try {
    const interviews = await listInterviewHistory(auth.user.id);
    return NextResponse.json({ interviews }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: { code: "TECHNICAL_HISTORY_FAILED", message: "Unable to load interview history" } }, { status: 500 });
  }
}
