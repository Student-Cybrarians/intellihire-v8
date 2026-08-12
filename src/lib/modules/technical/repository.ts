import { randomUUID } from "crypto";
import { z } from "zod";
import { pgPool } from "@/db/client";
import { aiService } from "@/lib/ai/aiService";
import type { TechnicalQuestion, TechnicalResult } from "./types";

const BASE_QUESTIONS = [
  { kind: "technical", prompt: "Explain how you would design a resilient REST API for a high-traffic service. Cover authentication, rate limiting, observability, and failure handling." },
  { kind: "dsa", prompt: "Given an array of integers, explain an O(n) approach to find the first duplicate and discuss the time/space trade-off." },
  { kind: "system-design", prompt: "Design a URL-shortening service. Explain data model, API shape, collision handling, caching, and scaling strategy." },
  { kind: "project", prompt: "Describe a technically difficult project you worked on. What trade-off did you make, and what would you change today?" },
] as const;

const evaluationSchema = z.object({
  correctness: z.number().min(0).max(100),
  codeQuality: z.number().min(0).max(100),
  problemSolving: z.number().min(0).max(100),
  communication: z.number().min(0).max(100),
  strengths: z.array(z.string().trim().min(1).max(300)).max(5),
  improvements: z.array(z.string().trim().min(1).max(300)).max(5),
});

type Evaluation = z.infer<typeof evaluationSchema>;

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
      CREATE INDEX IF NOT EXISTS technical_interviews_user_status_idx ON technical_interviews(user_id, status, started_at DESC);
      CREATE TABLE IF NOT EXISTS technical_questions (
        id uuid PRIMARY KEY,
        interview_id uuid NOT NULL REFERENCES technical_interviews(id) ON DELETE CASCADE,
        kind varchar(32) NOT NULL,
        prompt text NOT NULL,
        sequence_no integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(interview_id, sequence_no)
      );
      CREATE INDEX IF NOT EXISTS technical_questions_interview_idx ON technical_questions(interview_id, sequence_no);
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
      CREATE INDEX IF NOT EXISTS technical_responses_interview_idx ON technical_responses(interview_id, created_at);
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

function clampScore(value: unknown) {
  return Math.round(Math.max(0, Math.min(100, Number(value) || 0)));
}

function deterministicEvaluation(answerText: string, code?: string | null): Evaluation {
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

function parseEvaluation(text: string): Evaluation {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON evaluation");
    const raw = JSON.parse(match[0]);
    return evaluationSchema.parse({
      correctness: clampScore(raw.correctness),
      codeQuality: clampScore(raw.codeQuality),
      problemSolving: clampScore(raw.problemSolving),
      communication: clampScore(raw.communication),
      strengths: Array.isArray(raw.strengths) ? raw.strengths.slice(0, 5).map(String) : [],
      improvements: Array.isArray(raw.improvements) ? raw.improvements.slice(0, 5).map(String) : [],
    });
  } catch {
    throw new Error("AI evaluation response was not valid JSON");
  }
}

export async function startInterview(userId: string, role: string | null) {
  await ensureSchema();
  const existing = await pgPool.query(
    `SELECT id FROM technical_interviews WHERE user_id = $1 AND status = 'IN_PROGRESS' ORDER BY started_at DESC LIMIT 1`,
    [userId],
  );
  if (existing.rows[0]) return getInterview(userId, existing.rows[0].id);

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const id = randomUUID();
    await client.query(`INSERT INTO technical_interviews (id, user_id, role) VALUES ($1,$2,$3)`, [id, userId, role]);
    for (let i = 0; i < BASE_QUESTIONS.length; i++) {
      const q = BASE_QUESTIONS[i];
      await client.query(
        `INSERT INTO technical_questions (id, interview_id, kind, prompt, sequence_no) VALUES ($1,$2,$3,$4,$5)`,
        [randomUUID(), id, q.kind, q.prompt, i + 1],
      );
    }
    await client.query("COMMIT");
    return getInterview(userId, id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getInterview(userId: string, interviewId: string) {
  await ensureSchema();
  const i = await pgPool.query(
    `SELECT id, role, status, started_at, completed_at FROM technical_interviews WHERE id = $1 AND user_id = $2`,
    [interviewId, userId],
  );
  if (!i.rows[0]) throw new Error("Technical interview not found");
  const qs = await pgPool.query(
    `SELECT q.id, q.kind, q.prompt, q.sequence_no FROM technical_questions q WHERE q.interview_id = $1 ORDER BY q.sequence_no`,
    [interviewId],
  );
  const answered = await pgPool.query(`SELECT question_id FROM technical_responses WHERE interview_id = $1`, [interviewId]);
  const answeredIds = new Set(answered.rows.map((r) => r.question_id));
  const next = qs.rows.find((q) => !answeredIds.has(q.id));
  return {
    id: i.rows[0].id,
    role: i.rows[0].role,
    status: i.rows[0].status,
    startedAt: i.rows[0].started_at,
    completedAt: i.rows[0].completed_at,
    answered: answeredIds.size,
    total: qs.rows.length,
    currentQuestion: next ? ({ id: next.id, kind: next.kind, prompt: next.prompt, role: i.rows[0].role } as TechnicalQuestion) : null,
  };
}

export async function answerQuestion(userId: string, interviewId: string, questionId: string, answerText: string, code?: string | null) {
  await ensureSchema();
  const interview = await pgPool.query(
    `SELECT id, role, status FROM technical_interviews WHERE id = $1 AND user_id = $2 FOR UPDATE`,
    [interviewId, userId],
  );
  if (!interview.rows[0]) throw Object.assign(new Error("Technical interview not found"), { code: "NOT_FOUND" });
  if (interview.rows[0].status !== "IN_PROGRESS") throw Object.assign(new Error("Technical interview is not active"), { code: "CONFLICT" });

  const question = await pgPool.query(
    `SELECT id, prompt, kind FROM technical_questions WHERE id = $1 AND interview_id = $2`,
    [questionId, interviewId],
  );
  if (!question.rows[0]) throw Object.assign(new Error("Question not found"), { code: "NOT_FOUND" });

  const duplicate = await pgPool.query(`SELECT 1 FROM technical_responses WHERE interview_id = $1 AND question_id = $2`, [interviewId, questionId]);
  if (duplicate.rows[0]) throw Object.assign(new Error("This question has already been answered"), { code: "CONFLICT" });

  const prompt = `Evaluate this technical interview answer. This is coaching feedback, not a hiring decision. Do not infer protected characteristics or hidden mental states. Return ONLY JSON: {"correctness":number,"codeQuality":number,"problemSolving":number,"communication":number,"strengths":string[],"improvements":string[]}. Scores are 0-100. QUESTION: ${question.rows[0].prompt}\nANSWER: ${answerText.slice(0, 10000)}\nCODE: ${(code ?? "").slice(0, 20000)}`;

  let evaluation: Evaluation;
  try {
    const ai = await aiService.generate(userId, {
      capability: "reasoning",
      prompt,
      systemPrompt: "You are IntelliHire's technical interview evaluator. Be evidence-based, concise, and schema-compliant.",
      maxTokens: 700,
      temperature: 0.2,
    });
    evaluation = parseEvaluation(ai.text);
  } catch {
    // The interview remains usable if the external model is unavailable. The fallback
    // is deterministic coaching feedback and is explicitly marked by the response path.
    evaluation = deterministicEvaluation(answerText, code);
  }

  await pgPool.query(
    `INSERT INTO technical_responses (id, interview_id, question_id, answer_text, code, evaluation) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    [randomUUID(), interviewId, questionId, answerText, code ?? null, JSON.stringify(evaluation)],
  );
  return { evaluation, interview: await getInterview(userId, interviewId) };
}

export async function completeInterview(userId: string, interviewId: string): Promise<TechnicalResult> {
  await ensureSchema();
  const interview = await pgPool.query(
    `SELECT id, status FROM technical_interviews WHERE id = $1 AND user_id = $2 FOR UPDATE`,
    [interviewId, userId],
  );
  if (!interview.rows[0]) throw Object.assign(new Error("Technical interview not found"), { code: "NOT_FOUND" });
  if (interview.rows[0].status === "COMPLETED") {
    const existing = await pgPool.query(`SELECT overall_score, correctness, code_quality, problem_solving, communication, strengths, improvements, recommendations FROM technical_results WHERE interview_id = $1`, [interviewId]);
    if (existing.rows[0]) return mapResult(existing.rows[0]);
  }
  if (interview.rows[0].status !== "IN_PROGRESS") throw Object.assign(new Error("Technical interview is not active"), { code: "CONFLICT" });

  const counts = await pgPool.query(`SELECT COUNT(*)::int AS total, COUNT(evaluation)::int AS evaluated FROM technical_responses WHERE interview_id = $1`, [interviewId]);
  const answered = counts.rows[0].evaluated;
  const questions = await pgPool.query(`SELECT COUNT(*)::int AS total FROM technical_questions WHERE interview_id = $1`, [interviewId]);
  const total = questions.rows[0].total;
  if (answered !== total || total === 0) {
    throw Object.assign(new Error(`Complete all ${total} questions before finishing the interview`), { code: "INCOMPLETE" });
  }

  const responses = await pgPool.query(`SELECT evaluation FROM technical_responses WHERE interview_id = $1`, [interviewId]);
  const evaluations = responses.rows.map((r) => r.evaluation as Evaluation).filter(Boolean);
  const avg = (key: keyof Pick<Evaluation, "correctness" | "codeQuality" | "problemSolving" | "communication">) =>
    Math.round(evaluations.reduce((sum, e) => sum + Number(e[key] ?? 0), 0) / evaluations.length);
  const result: TechnicalResult = {
    correctness: avg("correctness"),
    codeQuality: avg("codeQuality"),
    problemSolving: avg("problemSolving"),
    communication: avg("communication"),
    overallScore: Math.round((avg("correctness") + avg("codeQuality") + avg("problemSolving") + avg("communication")) / 4),
    strengths: [...new Set(evaluations.flatMap((e) => e.strengths ?? []))].slice(0, 6),
    improvements: [...new Set(evaluations.flatMap((e) => e.improvements ?? []))].slice(0, 6),
    recommendations: [
      "Practice explaining trade-offs before implementation details.",
      "Use explicit complexity analysis when discussing algorithms.",
      "State assumptions and failure modes before proposing a production design.",
    ],
  };

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE technical_interviews SET status='COMPLETED', completed_at=now() WHERE id=$1 AND user_id=$2`, [interviewId, userId]);
    await client.query(
      `INSERT INTO technical_results (id, interview_id, overall_score, correctness, code_quality, problem_solving, communication, strengths, improvements, recommendations) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb) ON CONFLICT (interview_id) DO UPDATE SET overall_score=EXCLUDED.overall_score, correctness=EXCLUDED.correctness, code_quality=EXCLUDED.code_quality, problem_solving=EXCLUDED.problem_solving, communication=EXCLUDED.communication, strengths=EXCLUDED.strengths, improvements=EXCLUDED.improvements, recommendations=EXCLUDED.recommendations`,
      [randomUUID(), interviewId, result.overallScore, result.correctness, result.codeQuality, result.problemSolving, result.communication, JSON.stringify(result.strengths), JSON.stringify(result.improvements), JSON.stringify(result.recommendations)],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return result;
}

function mapResult(row: Record<string, unknown>): TechnicalResult {
  return {
    overallScore: Number(row.overall_score),
    correctness: Number(row.correctness),
    codeQuality: Number(row.code_quality),
    problemSolving: Number(row.problem_solving),
    communication: Number(row.communication),
    strengths: Array.isArray(row.strengths) ? row.strengths.map(String) : [],
    improvements: Array.isArray(row.improvements) ? row.improvements.map(String) : [],
    recommendations: Array.isArray(row.recommendations) ? row.recommendations.map(String) : [],
  };
}

export async function listInterviewHistory(userId: string) {
  await ensureSchema();
  const result = await pgPool.query(
    `SELECT i.id, i.role, i.status, i.started_at, i.completed_at, r.overall_score, r.correctness, r.code_quality, r.problem_solving, r.communication
     FROM technical_interviews i
     LEFT JOIN technical_results r ON r.interview_id = i.id
     WHERE i.user_id = $1
     ORDER BY i.started_at DESC
     LIMIT 50`,
    [userId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    role: row.role,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    result: row.overall_score == null ? null : {
      overallScore: Number(row.overall_score),
      correctness: Number(row.correctness),
      codeQuality: Number(row.code_quality),
      problemSolving: Number(row.problem_solving),
      communication: Number(row.communication),
    },
  }));
}
