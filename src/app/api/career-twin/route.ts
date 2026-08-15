import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuth } from "@/lib/auth/current";
import { recordAuditLog } from "@/db/repositories/sessions";
import { fingerprintCareerTwinInput, buildCareerTwin } from "@/lib/career-twin/engine";
import { getLatestCareerTwin, saveCareerTwin } from "@/db/repositories/careerTwin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const inputSchema = z.object({
  resumeText: z.string().trim().min(100).max(30_000),
  jobDescription: z.string().trim().min(50).max(20_000),
  targetRole: z.string().trim().max(255).optional().default(""),
  targetCompany: z.string().trim().max(255).optional().default(""),
});

const noStore = { "Cache-Control": "no-store, max-age=0" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: noStore });
}

export async function GET() {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return json({ error: "AUTH_REQUIRED", message: "Please sign in." }, 401);
    const twin = await getLatestCareerTwin(auth.user.id);
    return json({ twin });
  } catch (error) {
    console.error("[career-twin] GET failed", error);
    return json({ error: "CAREER_TWIN_READ_FAILED", message: "Career Twin could not be loaded." }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return json({ error: "AUTH_REQUIRED", message: "Please sign in." }, 401);

    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return json({ error: "INVALID_INPUT", message: "Resume and job description do not meet the required limits." }, 400);
    }

    const { resumeText, jobDescription, targetRole, targetCompany } = parsed.data;
    const fingerprint = fingerprintCareerTwinInput(resumeText, jobDescription, targetRole || null, targetCompany || null);
    const generated = await buildCareerTwin({
      requesterId: auth.user.id,
      resumeText,
      jobDescription,
      targetRole: targetRole || null,
      targetCompany: targetCompany || null,
    });

    const twin = await saveCareerTwin({
      userId: auth.user.id,
      fingerprint,
      twin: generated.twin,
      mode: generated.mode,
    });

    await recordAuditLog({
      actorUserId: auth.user.id,
      action: "career_twin.generated",
      resourceType: "career_twin_profile",
      resourceId: twin.id,
      metadata: { mode: generated.mode, sourceFingerprint: fingerprint },
    });

    return json({
      twin,
      mode: generated.mode,
      model: generated.model ?? null,
      correlationId: generated.correlationId ?? null,
      privacy: "Only derived skill-graph data is persisted; raw resume/job-description text is not stored.",
    });
  } catch (error) {
    console.error("[career-twin] POST failed", error);
    return json({ error: "CAREER_TWIN_FAILED", message: "Career Twin generation failed. Please try again." }, 500);
  }
}
