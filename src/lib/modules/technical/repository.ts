import { randomUUID } from "crypto";
import { pgPool } from "@/db/client";
import { aiService } from "@/lib/ai/aiService";
import type { TechnicalQuestion, TechnicalResult } from "./types";

const BASE_QUESTIONS = [
  { kind: "technical", prompt: "Explain how you would design a resilient REST API for a high-traffic service. Cover authentication, rate limiting, observability, and failure handling." },
  { kind: "dsa", prompt: "Given an array of integers, explain an O(n) approach to find the first duplicate and discuss the time/space trade-off." },
  { kind: "system-design", prompt: "Design a URL-shortening service. Explain data model, API shape, collision handling, caching, and scaling strategy." },
  { kind: "project", prompt: "Describe a technically difficult project you worked on. What trade-off did you make, and what would you change today?" },
];

let schemaReady: Promise<void> | null = null;

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = pgPool.query(`
      CREATE TABLE IF NOT EXISTS technical_interviews (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role varchar(255),
        status varchar(24) NOT NULL DEFAULT 'IN_PROGRESS',
        started_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz
      );
      CREATE INDEX IF NOT EXISTS technical_interviews_user_idx ON technical_interviews(user_id);
      CREATE TABLE IF NOT EXISTS technical_questions (
        id uuid PRIMARY KEY,
        interview_id uuid NOT NULL REFERENCES technical_interviews(id) ON DELETE CASCADE,
        kind varchar(32) NOT NULL,
        prompt text NOT NULL,
        sequence_no integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS technical_questions_interview_idx ON technical_questions(interview_id);
      CREATE TABLE IF NOT EXISTS technical_responses (
        id uuid PRIMARY KEY,
        interview_id uuid NOT NULL REFERENCES technical_interviews(id) ON DELETE CASCADE,
        question_id uuid NOT NULL REFERENCES technical_questions(id) ON DELETE CASCADE,
        answer_text text NOT NULL,
        code text,
        evaluation jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(interview_id, question_id)
      );
      CREATE TABLE IF NOT EXISTS technical_results (
        id uuid PRIMARY KEY,
        interview_id uuid NOT NULL UNIQUE REFERENCES technical_interviews(id) ON DELETE CASCADE,
        overall_score integer NOT NULL,
        correctness integer NOT NULL,
        code_quality integer NOT NULL,
        problem_solving integer NOT NULL,
        communication integer NOT NULL,
        strengths jsonb NOT NULL,
        improvements jsonb NOT NULL,
        recommendations jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `).then(() => undefined);
  }
  return schemaReady;
}

export async function startInterview(userId: string, role: string | null) {
  await ensureSchema();
  const existing = await pgPool.query(`SELECT id, status FROM technical_interviews WHERE user_id = $1 AND status = 'IN_PROGRESS' ORDER BY started_at DESC LIMIT 1`, [userId]);
  if (existing.rows[0]) return getInterview(userId, existing.rows[0].id);
  const id = randomUUID();
  await pgPool.query(`INSERT INTO technical_interviews (id, user_id, role) VALUES ($1,$2,$3)`, [id, userId, role]);
  for (let i = 0; i < BASE_QUESTIONS.length; i++) {
    const q = BASE_QUESTIONS[i];
    await pgPool.query(`INSERT INTO technical_questions (id, interview_id, kind, prompt, sequence_no) VALUES ($1,$2,$3,$4,$5)`, [randomUUID(), id, q.kind, q.prompt, i + 1]);
  }
  return getInterview(userId, id);
}

export async function getInterview(userId: string, interviewId: string) {
  await ensureSchema();
  const i = await pgPool.query(`SELECT id, role, status FROM technical_interviews WHERE id = $1 AND user_id = $2`, [interviewId, userId]);
  if (!i.rows[0]) throw new Error("Technical interview not found");
  const qs = await pgPool.query(`SELECT q.id, q.kind, q.prompt, q.sequence_no FROM technical_questions q WHERE q.interview_id = $1 ORDER BY q.sequence_no`, [interviewId]);
  const answered = await pgPool.query(`SELECT question_id FROM technical_responses WHERE interview_id = $1`, [interviewId]);
  const answeredIds = new Set(answered.rows.map((r) => r.question_id));
  const next = qs.rows.find((q) => !answeredIds.has(q.id));
  return {
    id: i.rows[0].id,
    role: i.rows[0].role,
    status: i.rows[0].status,
    answered: answeredIds.size,
    total: qs.rows.length,
    currentQuestion: next ? { id: next.id, kind: next.kind, prompt: next.prompt, role: i.rows[0].role } as TechnicalQuestion : null,
  };
}

function parseEvaluation(text: string) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON evaluation");
    const raw = JSON.parse(match[0]);
    return {
      correctness: Math.round(Math.max(0, Math.min(100, Number(raw.correctness) || 0))),
      codeQuality: Math.round(Math.max(0, Math.min(100, Number(raw.codeQuality) || 0))),
      problemSolving: Math.round(Math.max(0, Math.min(100, Number(raw.problemSolving) || 0))),
      communication: Math.round(Math.max(0, Math.min(100, Number(raw.communication) || 0))),
      strengths: Array.isArray(raw.strengths) ? raw.strengths.slice(0, 5).map(String) : [],
      improvements: Array.isArray(raw.improvements) ? raw.improvements.slice(0, 5).map(String) : [],
    };
  } catch {
    throw new Error("AI evaluation response was not valid JSON");
  }
}

export async function answerQuestion(userId: string, interviewId: string, questionId: string, answerText: string, code?: string | null) {
  await ensureSchema();
  const interview = await pgPool.query(`SELECT id, role, status FROM technical_interviews WHERE id = $1 AND user_id = $2`, [interviewId, userId]);
  if (!interview.rows[0] || interview.rows[0].status !== "IN_PROGRESS") throw new Error("Technical interview is not active");
  const question = await pgPool.query(`SELECT id, prompt, kind FROM technical_questions WHERE id = $1 AND interview_id = $2`, [questionId, interviewId]);
  if (!question.rows[0]) throw new Error("Question not found");
  const prompt = `Evaluate this technical interview answer. This is a coaching evaluation, not a hiring decision. Do not infer protected characteristics or hidden mental states. Return ONLY JSON: {"correctness":number,"codeQuality":number,"problemSolving":number,"communication":number,"strengths":string[],"improvements":string[]}. Scores are 0-100. QUESTION: ${question.rows[0].prompt}\nANSWER: ${answerText.slice(0,10000)}\nCODE: ${(code ?? "").slice(0,20000)}`;
  const ai = await aiService.generate(userId, { capability: "reasoning", prompt, systemPrompt: "You are IntelliHire's technical interview evaluator. Be evidence-based, concise, and schema-compliant.", maxTokens: 700, temperature: 0.2 });
  const evaluation = parseEvaluation(ai.text);
  await pgPool.query(`INSERT INTO technical_responses (id, interview_id, question_id, answer_text, code, evaluation) VALUES ($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT (interview_id,question_id) DO UPDATE SET answer_text = EXCLUDED.answer_text, code = EXCLUDED.code, evaluation = EXCLUDED.evaluation`, [randomUUID(), interviewId, questionId, answerText, code ?? null, JSON.stringify(evaluation)]);
  return { evaluation, interview: await getInterview(userId, interviewId) };
}

export async function completeInterview(userId: string, interviewId: string): Promise<TechnicalResult> {
  await ensureSchema();
  const interview = await pgPool.query(`SELECT id FROM technical_interviews WHERE id = $1 AND user_id = $2`, [interviewId, userId]);
  if (!interview.rows[0]) throw new Error("Technical interview not found");
  const responses = await pgPool.query(`SELECT evaluation FROM technical_responses WHERE interview_id = $1`, [interviewId]);
  const evaluations = responses.rows.map((r) => r.evaluation).filter(Boolean);
  if (!evaluations.length) throw new Error("Answer at least one question before completing");
  const avg = (key: string) => Math.round(evaluations.reduce((sum, e) => sum + Number(e[key] ?? 0), 0) / evaluations.length);
  const result: TechnicalResult = {
    correctness: avg("correctness"),
    codeQuality: avg("codeQuality"),
    problemSolving: avg("problemSolving"),
    communication: avg("communication"),
    overallScore: Math.round((avg("correctness") + avg("codeQuality") + avg("problemSolving") + avg("communication")) / 4),
    strengths: [...new Set(evaluations.flatMap((e) => e.strengths ?? []))].slice(0, 6),
    improvements: [...new Set(evaluations.flatMap((e) => e.improvements ?? []))].slice(0, 6),
    recommendations: ["Practice explaining trade-offs before implementation details.", "Use explicit complexity analysis when discussing algorithms."],
  };
  await pgPool.query(`UPDATE technical_interviews SET status='COMPLETED', completed_at=now() WHERE id=$1`, [interviewId]);
  await pgPool.query(`INSERT INTO technical_results (id, interview_id, overall_score, correctness, code_quality, problem_solving, communication, strengths, improvements, recommendations) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb) ON CONFLICT (interview_id) DO UPDATE SET overall_score=EXCLUDED.overall_score, correctness=EXCLUDED.correctness, code_quality=EXCLUDED.code_quality, problem_solving=EXCLUDED.problem_solving, communication=EXCLUDED.communication, strengths=EXCLUDED.strengths, improvements=EXCLUDED.improvements, recommendations=EXCLUDED.recommendations`, [randomUUID(), interviewId, result.overallScore, result.correctness, result.codeQuality, result.problemSolving, result.communication, JSON.stringify(result.strengths), JSON.stringify(result.improvements), JSON.stringify(result.recommendations)]);
  return result;
}
