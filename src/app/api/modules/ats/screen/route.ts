import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth/current";
import { aiService } from "@/lib/ai/aiService";
import { buildAtsPrompt } from "@/lib/modules/ats/prompt";
import type { AtsScreeningResult } from "@/lib/modules/ats/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const noStore = { "Cache-Control": "no-store, max-age=0" };
// The local ATS engine is deterministic and fast. AI is enrichment only and
// must never be allowed to make the Module 1 demo/request hang.
const AI_ATTEMPT_TIMEOUT_MS = 4_000;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: noStore });
}

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

function parseResult(text: string): AtsScreeningResult {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
  const raw = fenced ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const jsonText = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("The AI response was not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("The AI returned an invalid screening result.");
  }

  const value = parsed as Record<string, unknown>;
  const list = (key: string): string[] =>
    Array.isArray(value[key])
      ? value[key]
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 8)
      : [];

  return {
    overallScore: clampScore(value.overallScore),
    atsCompatibility: clampScore(value.atsCompatibility),
    keywordMatch: clampScore(value.keywordMatch),
    experienceFit: clampScore(value.experienceFit),
    educationFit: clampScore(value.educationFit),
    summary:
      typeof value.summary === "string"
        ? value.summary.trim().slice(0, 500)
        : "AI analysis completed.",
    matchedSkills: list("matchedSkills"),
    missingSkills: list("missingSkills"),
    strengths: list("strengths"),
    recommendations: list("recommendations"),
  };
}

function normalizeTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9+#.\- ]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3),
  );
}

function fallbackScreen(resumeText: string, jobDescription: string): AtsScreeningResult {
  const resume = normalizeTokens(resumeText);
  const jd = normalizeTokens(jobDescription);
  const stopWords = new Set([
    "the", "and", "with", "for", "you", "are", "our", "this", "that", "from", "will",
    "have", "your", "their", "they", "must", "should", "good", "skills", "skill",
    "experience", "candidate", "position", "role", "work", "using", "including", "years",
    "ability", "knowledge", "responsibilities", "required", "requirements", "additional",
    "information", "into", "about", "more", "than", "not", "can", "who", "all", "has",
  ]);

  const required = [...jd].filter((token) => !stopWords.has(token));
  const matched = required.filter((token) => resume.has(token));
  const missing = required.filter((token) => !resume.has(token));
  const keywordMatch = required.length
    ? Math.round((matched.length / required.length) * 100)
    : 0;

  const experienceFit = /experience|years|intern|developer|engineer|project/i.test(resumeText)
    ? 70
    : 40;
  const educationFit = /bachelor|master|degree|university|college|diploma|b\.s\.|m\.s\./i.test(
    resumeText,
  )
    ? 80
    : 45;
  const atsCompatibility = Math.min(
    100,
    55 + (resumeText.length > 500 ? 20 : 0) + (resumeText.length > 1200 ? 15 : 0),
  );
  const overallScore = Math.round(
    0.45 * keywordMatch + 0.2 * experienceFit + 0.15 * educationFit + 0.2 * atsCompatibility,
  );

  return {
    overallScore,
    atsCompatibility,
    keywordMatch,
    experienceFit,
    educationFit,
    summary: `Screening completed with the deterministic ATS engine. ${matched.length} job-description terms were found in the supplied resume.`,
    matchedSkills: matched.slice(0, 8),
    missingSkills: missing.slice(0, 8),
    strengths: [
      resumeText.length > 500
        ? "Resume contains substantial evidence for automated screening."
        : "Resume text was successfully parsed for screening.",
      matched.length
        ? "Relevant job-description terminology is present."
        : "Resume was accepted and analyzed.",
    ],
    recommendations: missing.length
      ? [
          `Address these missing job-description terms where truthful: ${missing.slice(0, 5).join(", ")}.`,
          "Use measurable outcomes and technologies already supported by your experience.",
        ]
      : [
          "Keep the resume aligned to the exact terminology used in the target job description.",
          "Add measurable outcomes to major experience bullets.",
        ],
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`AI analysis timed out after ${timeoutMs / 1000} seconds.`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) {
      return json(
        { error: "AUTH_REQUIRED", message: "Please sign in before running Module 1." },
        401,
      );
    }

    const body = (await request.json()) as {
      resumeText?: unknown;
      jobDescription?: unknown;
      company?: unknown;
      targetRole?: unknown;
    };
    const resumeText = typeof body.resumeText === "string" ? body.resumeText.trim() : "";
    const jobDescription =
      typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";
    const company = typeof body.company === "string" ? body.company.trim() : "";
    const targetRole = typeof body.targetRole === "string" ? body.targetRole.trim() : "";

    if (resumeText.length < 100) {
      return json(
        { error: "RESUME_TOO_SHORT", message: "Resume text must be at least 100 characters." },
        400,
      );
    }
    if (jobDescription.length < 50) {
      return json(
        {
          error: "JOB_DESCRIPTION_TOO_SHORT",
          message: "Job description must be at least 50 characters.",
        },
        400,
      );
    }
    if (resumeText.length > 30_000 || jobDescription.length > 20_000) {
      return json(
        { error: "INPUT_TOO_LARGE", message: "Input is too large for screening." },
        413,
      );
    }

    // Always have a valid result before attempting an external AI provider.
    // This is important for production reliability and for deployments where
    // OPENROUTER_API_KEY is intentionally not configured.
    const fallback = fallbackScreen(resumeText, jobDescription);

    if (!process.env.OPENROUTER_API_KEY?.trim()) {
      return json({
        result: fallback,
        mode: "fallback",
        warning:
          "AI enrichment is not configured on this deployment. The deterministic ATS engine completed the screening successfully.",
      });
    }

    try {
      const response = await withTimeout(
        aiService.analyzeText(auth.user.id, {
          capability: "reasoning",
          prompt: buildAtsPrompt(resumeText, jobDescription),
          systemPrompt:
            "You are IntelliHire's ATS evaluator. Return ONLY valid JSON matching the requested schema. Do not use markdown fences.",
          maxTokens: 1400,
          temperature: 0.2,
        }),
        AI_ATTEMPT_TIMEOUT_MS,
      );

      const result = parseResult(response.text);
      return json({
        result,
        mode: "ai",
        model: response.model,
        correlationId: response.correlationId,
        company: company || null,
        targetRole: targetRole || null,
      });
    } catch (aiError) {
      console.error("[module-1] AI enrichment failed; returning deterministic ATS result", {
        code: aiError instanceof Error ? aiError.name : "UNKNOWN",
        message: aiError instanceof Error ? aiError.message : String(aiError),
      });

      return json({
        result: fallback,
        mode: "fallback",
        warning:
          "AI enrichment was unavailable, so IntelliHire completed the screening with its deterministic ATS engine instead.",
        company: company || null,
        targetRole: targetRole || null,
      });
    }
  } catch (error) {
    console.error("[module-1] ATS screening request failed", error);
    return json(
      {
        error: "ATS_SCREENING_FAILED",
        message: error instanceof Error ? error.message : "ATS screening failed.",
      },
      500,
    );
  }
}
