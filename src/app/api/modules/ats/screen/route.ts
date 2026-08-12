import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth/current";
import { aiService } from "@/lib/ai/aiService";
import { buildAtsPrompt } from "@/lib/modules/ats/prompt";
import type { AtsScreeningResult } from "@/lib/modules/ats/types";

export const runtime = "nodejs";

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

function parseResult(text: string): AtsScreeningResult {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
  const raw = fenced ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const json = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("The AI response was not valid JSON. Please try screening again.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("The AI returned an invalid screening result.");
  const value = parsed as Record<string, unknown>;
  const list = (key: string): string[] =>
    Array.isArray(value[key])
      ? value[key].filter((item): item is string => typeof item === "string").slice(0, 8)
      : [];
  return {
    overallScore: clampScore(value.overallScore),
    atsCompatibility: clampScore(value.atsCompatibility),
    keywordMatch: clampScore(value.keywordMatch),
    experienceFit: clampScore(value.experienceFit),
    educationFit: clampScore(value.educationFit),
    summary: typeof value.summary === "string" ? value.summary.slice(0, 500) : "Analysis completed.",
    matchedSkills: list("matchedSkills"),
    missingSkills: list("missingSkills"),
    strengths: list("strengths"),
    recommendations: list("recommendations"),
  };
}

function normalizeTokens(text: string): Set<string> {
  return new Set(text.toLowerCase().replace(/[^a-z0-9+#.\- ]/g, " ").split(/\s+/).filter((x) => x.length >= 3));
}

function fallbackScreen(resumeText: string, jobDescription: string): AtsScreeningResult {
  const resume = normalizeTokens(resumeText);
  const jd = normalizeTokens(jobDescription);
  const required = [...jd].filter((token) => !["the", "and", "with", "for", "you", "are", "our", "this", "that", "from", "will", "have"].includes(token));
  const matched = required.filter((token) => resume.has(token));
  const missing = required.filter((token) => !resume.has(token));
  const keywordMatch = required.length ? Math.round((matched.length / required.length) * 100) : 0;
  const experienceFit = /experience|years|intern|developer|engineer|project/i.test(resumeText) ? 70 : 40;
  const educationFit = /bachelor|master|degree|university|college|b\.s\.|m\.s\./i.test(resumeText) ? 80 : 45;
  const atsCompatibility = Math.min(100, 55 + (resumeText.length > 500 ? 20 : 0) + (resumeText.length > 1200 ? 15 : 0));
  const overallScore = Math.round(0.45 * keywordMatch + 0.2 * experienceFit + 0.15 * educationFit + 0.2 * atsCompatibility);
  return {
    overallScore,
    atsCompatibility,
    keywordMatch,
    experienceFit,
    educationFit,
    summary: `Screening completed using the available ATS text-matching engine. ${matched.length} job-description terms were found in the supplied resume. AI enrichment can be retried when the provider is available.`,
    matchedSkills: matched.slice(0, 8),
    missingSkills: missing.slice(0, 8),
    strengths: [
      resumeText.length > 500 ? "Resume contains substantial evidence for automated screening." : "Resume text was successfully parsed for screening.",
      matched.length ? "Relevant job-description terminology is present." : "Resume was accepted and analyzed.",
    ],
    recommendations: missing.length
      ? [`Address these missing job-description terms where truthful: ${missing.slice(0, 5).join(", ")}.`, "Use measurable outcomes and technologies already supported by your experience."]
      : ["Keep the resume aligned to the exact terminology used in the target job description.", "Add measurable outcomes to major experience bullets."],
  };
}

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "AUTH_REQUIRED", message: "Please sign in before running Module 1." }, { status: 401 });

  try {
    const body = (await request.json()) as { resumeText?: unknown; jobDescription?: unknown };
    const resumeText = typeof body.resumeText === "string" ? body.resumeText.trim() : "";
    const jobDescription = typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";
    if (resumeText.length < 100) return NextResponse.json({ error: "RESUME_TOO_SHORT", message: "Resume text must be at least 100 characters." }, { status: 400 });
    if (jobDescription.length < 50) return NextResponse.json({ error: "JOB_DESCRIPTION_TOO_SHORT", message: "Job description must be at least 50 characters." }, { status: 400 });
    if (resumeText.length > 30_000 || jobDescription.length > 20_000) return NextResponse.json({ error: "INPUT_TOO_LARGE", message: "Input is too large for screening." }, { status: 413 });

    try {
      const response = await aiService.analyzeText(auth.user.id, {
        capability: "reasoning",
        prompt: buildAtsPrompt(resumeText, jobDescription),
        systemPrompt: "You are IntelliHire's ATS evaluator. Return ONLY valid JSON matching the requested schema. Do not use markdown fences.",
        maxTokens: 1400,
        temperature: 0.2,
      });
      return NextResponse.json({ result: parseResult(response.text), mode: "ai", model: response.model, correlationId: response.correlationId });
    } catch (aiError) {
      const result = fallbackScreen(resumeText, jobDescription);
      return NextResponse.json({
        result,
        mode: "fallback",
        warning: aiError instanceof Error ? `AI enrichment unavailable: ${aiError.message}` : "AI enrichment unavailable; ATS text analysis was used.",
      });
    }
  } catch (error) {
    return NextResponse.json({ error: "ATS_SCREENING_FAILED", message: error instanceof Error ? error.message : "ATS screening failed." }, { status: 500 });
  }
}
