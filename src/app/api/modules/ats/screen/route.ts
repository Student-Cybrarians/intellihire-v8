import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth/current";
import { aiService } from "@/lib/ai/aiService";
import { buildAtsPrompt } from "@/lib/modules/ats/prompt";
import type { AtsScreeningResult } from "@/lib/modules/ats/types";

export const runtime = "nodejs";

function clampScore(value: unknown): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.max(0, Math.min(100, Math.round(numberValue)));
}

function parseResult(text: string): AtsScreeningResult {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(fenced);
  } catch {
    throw new Error("ATS model returned invalid JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("ATS model returned an invalid result");
  }

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
    summary: typeof value.summary === "string" ? value.summary.slice(0, 500) : "No summary returned.",
    matchedSkills: list("matchedSkills"),
    missingSkills: list("missingSkills"),
    strengths: list("strengths"),
    recommendations: list("recommendations"),
  };
}

export async function POST(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { resumeText?: unknown; jobDescription?: unknown };
    const resumeText = typeof body.resumeText === "string" ? body.resumeText.trim() : "";
    const jobDescription = typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";

    if (resumeText.length < 100) {
      return NextResponse.json({ error: "RESUME_TOO_SHORT", message: "Resume text must be at least 100 characters." }, { status: 400 });
    }
    if (jobDescription.length < 50) {
      return NextResponse.json({ error: "JOB_DESCRIPTION_TOO_SHORT", message: "Job description must be at least 50 characters." }, { status: 400 });
    }
    if (resumeText.length > 30_000 || jobDescription.length > 20_000) {
      return NextResponse.json({ error: "INPUT_TOO_LARGE", message: "Input is too large for screening." }, { status: 413 });
    }

    const response = await aiService.analyzeText(auth.user.id, {
      capability: "reasoning",
      prompt: buildAtsPrompt(resumeText, jobDescription),
      systemPrompt: "You are a deterministic ATS coaching evaluator. Follow the requested JSON schema exactly.",
      maxTokens: 1400,
      temperature: 0.2,
    });

    const result = parseResult(response.text);
    return NextResponse.json({ result, model: response.model, correlationId: response.correlationId });
  } catch (error) {
    return NextResponse.json(
      { error: "ATS_SCREENING_FAILED", message: error instanceof Error ? error.message : "ATS screening failed." },
      { status: 502 },
    );
  }
}
