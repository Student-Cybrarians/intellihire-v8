import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { RoadmapPlan } from "@/lib/roadmap/engine";

export type StoredRoadmap = RoadmapPlan & { id: string; sourceFingerprint: string; mode: "ai" | "fallback"; createdAt: Date };

type Row = { id: string; source_fingerprint: string; target_role: string | null; mode: "ai" | "fallback"; confidence: number; milestones: RoadmapPlan["milestones"]; projects: RoadmapPlan["projects"]; integrity: RoadmapPlan["integrity"]; created_at: Date };
const map = (r: Row): StoredRoadmap => ({ id: r.id, sourceFingerprint: r.source_fingerprint, targetRole: r.target_role, mode: r.mode, confidence: Number(r.confidence), milestones: r.milestones, projects: r.projects, integrity: r.integrity, createdAt: r.created_at });

export async function saveRoadmap(params: { userId: string; fingerprint: string; plan: RoadmapPlan; mode: "ai" | "fallback" }): Promise<StoredRoadmap> {
  const result = await db.execute(sql`INSERT INTO roadmap_plans (id,user_id,source_fingerprint,target_role,mode,confidence,milestones,projects,integrity) VALUES (gen_random_uuid(),${params.userId},${params.fingerprint},${params.plan.targetRole},${params.mode},${params.plan.confidence},${JSON.stringify(params.plan.milestones)}::jsonb,${JSON.stringify(params.plan.projects)}::jsonb,${JSON.stringify(params.plan.integrity)}::jsonb) ON CONFLICT(user_id,source_fingerprint) DO UPDATE SET target_role=EXCLUDED.target_role,mode=EXCLUDED.mode,confidence=EXCLUDED.confidence,milestones=EXCLUDED.milestones,projects=EXCLUDED.projects,integrity=EXCLUDED.integrity RETURNING id,source_fingerprint,target_role,mode,confidence,milestones,projects,integrity,created_at`);
  return map(result.rows[0] as unknown as Row);
}

export async function getLatestRoadmap(userId: string): Promise<StoredRoadmap | null> {
  const result = await db.execute(sql`SELECT id,source_fingerprint,target_role,mode,confidence,milestones,projects,integrity,created_at FROM roadmap_plans WHERE user_id=${userId} ORDER BY created_at DESC LIMIT 1`);
  const row = result.rows[0] as unknown as Row | undefined;
  return row ? map(row) : null;
}
