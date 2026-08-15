import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { ResearchBrief } from "@/lib/research/engine";

export type StoredResearchBrief = ResearchBrief & { id: string; mode: "ai" | "fallback"; model: string | null; contextFingerprint: string; createdAt: Date };

type Row = { id:string; question:string; mode:"ai"|"fallback"; model:string|null; context_fingerprint:string; synthesis:string; sources:ResearchBrief["sources"]; created_at:Date };
function map(row: Row): StoredResearchBrief { return { id:row.id, question:row.question, mode:row.mode, model:row.model, contextFingerprint:row.context_fingerprint, synthesis:row.synthesis, sources:row.sources, createdAt:row.created_at }; }

export async function saveResearchBrief(params:{userId:string; brief:ResearchBrief; mode:"ai"|"fallback"; model?:string; contextFingerprint:string}):Promise<StoredResearchBrief>{
  const rows=await db.execute(sql`INSERT INTO research_briefs (id,user_id,question,context_fingerprint,mode,model,synthesis,sources,context) VALUES (gen_random_uuid(),${params.userId},${params.brief.question},${params.contextFingerprint},${params.mode},${params.model??null},${params.brief.synthesis},${JSON.stringify(params.brief.sources)}::jsonb, '{}'::jsonb) RETURNING id,question,mode,model,context_fingerprint,synthesis,sources,created_at`);
  return map(rows.rows[0] as unknown as Row);
}

export async function listResearchBriefs(userId:string, limit=10):Promise<StoredResearchBrief[]>{
  const safe=Math.max(1,Math.min(20,Math.floor(limit)));
  const rows=await db.execute(sql`SELECT id,question,mode,model,context_fingerprint,synthesis,sources,created_at FROM research_briefs WHERE user_id=${userId} ORDER BY created_at DESC LIMIT ${safe}`);
  return (rows.rows as unknown as Row[]).map(map);
}
