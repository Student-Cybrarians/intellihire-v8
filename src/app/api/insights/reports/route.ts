import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuth } from "@/lib/auth/current";
import { createReport, listReports } from "@/lib/modules/insights/repository";

const bodySchema = z.object({ days: z.number().int().min(1).max(365).optional().default(30) });

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  try {
    return NextResponse.json({ reports: await listReports(auth.user.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: { code: "REPORTS_FAILED", message: "Unable to load reports" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "days must be between 1 and 365" } }, { status: 422 });
    const report = await createReport(auth.user.id, parsed.data.days);
    return NextResponse.json(report, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Module 5 report creation failed", error instanceof Error ? { message: error.message } : { error: "unknown" });
    return NextResponse.json({ error: { code: "REPORT_CREATE_FAILED", message: "Unable to create performance report" } }, { status: 500 });
  }
}
