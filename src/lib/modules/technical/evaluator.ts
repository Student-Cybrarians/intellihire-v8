import { z } from "zod";

export const technicalEvaluationSchema = z.object({
  correctness: z.number().min(0).max(100),
  codeQuality: z.number().min(0).max(100),
  problemSolving: z.number().min(0).max(100),
  communication: z.number().min(0).max(100),
  strengths: z.array(z.string().trim().min(1).max(300)).max(5),
  improvements: z.array(z.string().trim().min(1).max(300)).max(5),
});

export type TechnicalEvaluation = z.infer<typeof technicalEvaluationSchema>;

export function clampScore(value: unknown) {
  return Math.round(Math.max(0, Math.min(100, Number(value) || 0)));
}

export function parseTechnicalEvaluation(text: string): TechnicalEvaluation {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI evaluation response was not valid JSON");
  const raw = JSON.parse(match[0]) as Record<string, unknown>;
  return technicalEvaluationSchema.parse({
    correctness: clampScore(raw.correctness),
    codeQuality: clampScore(raw.codeQuality),
    problemSolving: clampScore(raw.problemSolving),
    communication: clampScore(raw.communication),
    strengths: Array.isArray(raw.strengths) ? raw.strengths.slice(0, 5).map(String) : [],
    improvements: Array.isArray(raw.improvements) ? raw.improvements.slice(0, 5).map(String) : [],
  });
}

export function deterministicTechnicalEvaluation(answerText: string, code?: string | null): TechnicalEvaluation {
  const words = answerText.trim().split(/\s+/).filter(Boolean).length;
  const hasTradeoff = /trade.?off|complexity|edge case|failure|scale|latency|security/i.test(answerText);
  const hasCode = Boolean(code?.trim());
  const base = Math.min(85, 45 + Math.min(30, Math.floor(words / 12)) + (hasTradeoff ? 10 : 0));
  return {
    correctness: clampScore(base),
    codeQuality: clampScore(hasCode ? base + 5 : 55),
    problemSolving: clampScore(base + (hasTradeoff ? 5 : 0)),
    communication: clampScore(50 + Math.min(40, Math.floor(words / 10))),
    strengths: [hasTradeoff ? "You addressed engineering trade-offs or edge cases." : "You provided a direct technical explanation."],
    improvements: ["Add concrete assumptions, complexity analysis, and failure cases to make the reasoning easier to evaluate."],
  };
}
