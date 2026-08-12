import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuth } from "@/lib/auth/current";
import { getReport } from "@/lib/modules/insights/repository";

const idSchema = z.string().uuid();

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid report id" } }, { status: 422 });
  try {
    return NextResponse.json(await getReport(auth.user.id, id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as Error & { code?: string }).code === "NOT_FOUND") {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Performance report not found" } }, { status: 404 });
    }
    return NextResponse.json({ error: { code: "REPORT_FAILED", message: "Unable to load performance report" } }, { status: 500 });
  }
}
