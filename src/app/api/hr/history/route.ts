import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth/current";
import { listInterviewHistory } from "@/lib/modules/hr/repository";

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  try {
    return NextResponse.json({ interviews: await listInterviewHistory(auth.user.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: { code: "HR_HISTORY_FAILED", message: error instanceof Error ? error.message : "Unable to load history" } }, { status: 500 });
  }
}
