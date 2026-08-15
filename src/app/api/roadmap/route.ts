import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuth } from "@/lib/auth/current";
import { recordAuditLog } from "@/db/repositories/sessions";
import { getLatestCareerTwin } from "@/db/repositories/careerTwin";
import { buildRoadmap, fingerprintRoadmapInput } from "@/lib/roadmap/engine";
import { getLatestRoadmap, saveRoadmap } from "@/db/repositories/roadmap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const bodySchema = z.object({ targetRole: z.string().trim().max(255).optional() });
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0" } });

export async function GET() {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return json({ error: "AUTH_REQUIRED" }, 401);
    return json({ roadmap: await getLatestRoadmap(auth.user.id) });
  } catch (error) {
    console.error("[roadmap] GET failed", error);
    return json({ error: "ROADMAP_READ_FAILED", message: "Roadmap could not be loaded." }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) return json({ error: "AUTH_REQUIRED" }, 401);
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "INVALID_INPUT" }, 400);
    const twin = await getLatestCareerTwin(auth.user.id);
    if (!twin) return json({ error: "CAREER_TWIN_REQUIRED", message: "Generate a Career Digital Twin before creating a roadmap." }, 409);
    const targetRole = parsed.data.targetRole || twin.targetRole || null;
    const fingerprint = fingerprintRoadmapInput({ targetRole, skillGraph: twin.skillGraph });
    const generated = await buildRoadmap({ requesterId: auth.user.id, targetRole, skillGraph: twin.skillGraph });
    const roadmap = await saveRoadmap({ userId: auth.user.id, fingerprint, plan: generated.plan, mode: generated.mode });
    await recordAuditLog({ actorUserId: auth.user.id, action: "roadmap.generated", resourceType: "roadmap_plan", resourceId: roadmap.id, metadata: { mode: generated.mode, sourceFingerprint: fingerprint } });
    return json({ roadmap, mode: generated.mode, model: generated.model ?? null, correlationId: generated.correlationId ?? null });
  } catch (error) {
    console.error("[roadmap] POST failed", error);
    return json({ error: "ROADMAP_FAILED", message: "Roadmap generation failed. Please try again." }, 500);
  }
}
