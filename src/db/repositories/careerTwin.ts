import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { CareerTwin } from "@/lib/career-twin/engine";

export type StoredCareerTwin = CareerTwin & {
  id: string;
  sourceFingerprint: string;
  mode: "ai" | "fallback";
  createdAt: Date;
};

type CareerTwinRow = {
  id: string;
  target_role: string | null;
  target_company: string | null;
  source_fingerprint: string;
  mode: "ai" | "fallback";
  confidence: number;
  skill_graph: CareerTwin["skillGraph"];
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  created_at: Date;
};

function mapRow(row: CareerTwinRow): StoredCareerTwin {
  return {
    id: row.id,
    targetRole: row.target_role,
    targetCompany: row.target_company,
    skillGraph: row.skill_graph,
    strengths: row.strengths,
    gaps: row.gaps,
    recommendations: row.recommendations,
    confidence: row.confidence,
    sourceFingerprint: row.source_fingerprint,
    mode: row.mode,
    createdAt: row.created_at,
  };
}

export async function saveCareerTwin(params: {
  userId: string;
  fingerprint: string;
  twin: CareerTwin;
  mode: "ai" | "fallback";
}): Promise<StoredCareerTwin> {
  const rows = await db.execute(sql`
    INSERT INTO career_twin_profiles
      (id, user_id, target_role, target_company, source_fingerprint, mode, confidence, skill_graph, strengths, gaps, recommendations)
    VALUES
      (gen_random_uuid(), ${params.userId}, ${params.twin.targetRole}, ${params.twin.targetCompany}, ${params.fingerprint}, ${params.mode}, ${params.twin.confidence}, ${JSON.stringify(params.twin.skillGraph)}::jsonb, ${JSON.stringify(params.twin.strengths)}::jsonb, ${JSON.stringify(params.twin.gaps)}::jsonb, ${JSON.stringify(params.twin.recommendations)}::jsonb)
    ON CONFLICT (user_id, source_fingerprint)
    DO UPDATE SET
      target_role = EXCLUDED.target_role,
      target_company = EXCLUDED.target_company,
      mode = EXCLUDED.mode,
      confidence = EXCLUDED.confidence,
      skill_graph = EXCLUDED.skill_graph,
      strengths = EXCLUDED.strengths,
      gaps = EXCLUDED.gaps,
      recommendations = EXCLUDED.recommendations
    RETURNING id, target_role, target_company, source_fingerprint, mode, confidence, skill_graph, strengths, gaps, recommendations, created_at
  `);
  return mapRow(rows.rows[0] as unknown as CareerTwinRow);
}

export async function getLatestCareerTwin(userId: string): Promise<StoredCareerTwin | null> {
  const rows = await db.execute(sql`
    SELECT id, target_role, target_company, source_fingerprint, mode, confidence, skill_graph, strengths, gaps, recommendations, created_at
    FROM career_twin_profiles
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const row = rows.rows[0] as unknown as CareerTwinRow | undefined;
  return row ? mapRow(row) : null;
}
