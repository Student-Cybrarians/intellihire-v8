import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuth } from "@/lib/auth/current";
import { recordAuditLog } from "@/db/repositories/sessions";
import { buildResearchBrief } from "@/lib/research/engine";
import { listResearchBriefs, saveResearchBrief } from "@/db/repositories/research";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const noStore={"Cache-Control":"no-store, max-age=0"};
function json(data:unknown,status=200){return NextResponse.json(data,{status,headers:noStore});}
const input=z.object({question:z.string().trim().min(8).max(500)});

export async function GET(){
  const auth=await getCurrentAuth();
  if(!auth)return json({error:"AUTH_REQUIRED",message:"Please sign in."},401);
  try{return json({briefs:await listResearchBriefs(auth.user.id)});}catch(error){console.error("[research] GET failed",error);return json({error:"RESEARCH_READ_FAILED",message:"Research history could not be loaded."},500);}
}

export async function POST(request:Request){
  const auth=await getCurrentAuth();
  if(!auth)return json({error:"AUTH_REQUIRED",message:"Please sign in."},401);
  try{
    const parsed=input.safeParse(await request.json());
    if(!parsed.success)return json({error:"INVALID_INPUT",message:"Research question must be 8-500 characters."},400);
    const generated=await buildResearchBrief(auth.user.id,parsed.data.question);
    const saved=await saveResearchBrief({userId:auth.user.id,brief:generated.brief,mode:generated.mode,model:generated.model,contextFingerprint:generated.contextFingerprint});
    await recordAuditLog({actorUserId:auth.user.id,action:"research.generated",resourceType:"research_brief",resourceId:saved.id,metadata:{mode:generated.mode,sourceCount:saved.sources.length,contextFingerprint:generated.contextFingerprint}});
    return json({brief:saved,mode:generated.mode,model:generated.model??null,grounding:generated.brief.sources.length?"source-backed":"insufficient-external-evidence"});
  }catch(error){console.error("[research] POST failed",error);return json({error:"RESEARCH_FAILED",message:"Research could not be completed safely. Please try again."},500);}
}
