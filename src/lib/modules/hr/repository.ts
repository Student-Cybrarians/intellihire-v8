import { randomUUID } from "crypto";
import { pgPool } from "@/db/client";
import { aiService } from "@/lib/ai/aiService";

export type HREvaluation = {
  communication: number;
  behavioral: number;
  relevance: number;
  structure: number;
  strengths: string[];
  improvements: string[];
};

export type HRResult = HREvaluation & {
  overallScore: number;
  recommendations: string[];
};

const QUESTIONS = [
  { category: "intro", prompt: "Tell me about yourself and the experience that best prepares you for this role." },
  { category: "behavioral", prompt: "Tell me about a difficult situation at work or in a project. What did you do, and what was the outcome?" },
  { category: "teamwork", prompt: "Describe a time you disagreed with a teammate or stakeholder. How did you handle the disagreement?" },
  { category: "ownership", prompt: "Tell me about a mistake or setback. What did you learn and what did you change afterward?" },
  { category: "motivation", prompt: "Why are you interested in this role, and what would you want to accomplish in your first few months?" },
] as const;

let schemaReady: Promise<void> | null = null;

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = pgPool.query(`
      CREATE TABLE IF NOT EXISTS hr_interviews (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role varchar(255), company varchar(255), status varchar(24) NOT NULL DEFAULT 'IN_PROGRESS',
        started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
      );
      CREATE INDEX IF NOT EXISTS hr_interviews_user_status_idx ON hr_interviews(user_id, status, started_at DESC);
      CREATE TABLE IF NOT EXISTS hr_questions (
        id uuid PRIMARY KEY,
        interview_id uuid NOT NULL REFERENCES hr_interviews(id) ON DELETE CASCADE,
        category varchar(32) NOT NULL, prompt text NOT NULL, sequence_no integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(interview_id, sequence_no)
      );
      CREATE INDEX IF NOT EXISTS hr_questions_interview_idx ON hr_questions(interview_id, sequence_no);
      CREATE TABLE IF NOT EXISTS hr_responses (
        id uuid PRIMARY KEY,
        interview_id uuid NOT NULL REFERENCES hr_interviews(id) ON DELETE CASCADE,
        question_id uuid NOT NULL REFERENCES hr_questions(id) ON DELETE CASCADE,
        answer_text text NOT NULL, evaluation jsonb, created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(interview_id, question_id)
      );
      CREATE INDEX IF NOT EXISTS hr_responses_interview_idx ON hr_responses(interview_id, created_at);
      CREATE TABLE IF NOT EXISTS hr_results (
        id uuid PRIMARY KEY,
        interview_id uuid NOT NULL UNIQUE REFERENCES hr_interviews(id) ON DELETE CASCADE,
        overall_score integer NOT NULL, communication integer NOT NULL, behavioral integer NOT NULL,
        relevance integer NOT NULL, structure integer NOT NULL, strengths jsonb NOT NULL,
        improvements jsonb NOT NULL, recommendations jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
      );
    `).then(() => undefined);
  }
  return schemaReady;
}

function clampScore(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

function parseEvaluation(raw: string, answer: string): HREvaluation {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Invalid HR evaluation JSON");
  const value = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  if (!Array.isArray(value.strengths) || !Array.isArray(value.improvements)) throw new Error("Invalid HR evaluation shape");
  return {
    communication: clampScore(value.communication), behavioral: clampScore(value.behavioral),
    relevance: clampScore(value.relevance), structure: clampScore(value.structure),
    strengths: value.strengths.map(String).slice(0, 5), improvements: value.improvements.map(String).slice(0, 5),
  };
}

function deterministicEvaluation(answer: string): HREvaluation {
  const text = answer.trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  const lower = text.toLowerCase();
  const hasStar = ["situation", "task", "action", "result", "outcome"].filter((word) => lower.includes(word)).length;
  const base = Math.min(88, 45 + Math.min(words, 180) / 3 + hasStar * 5);
  return {
    communication: Math.round(Math.min(95, base + (words > 45 ? 5 : 0))),
    behavioral: Math.round(Math.min(95, base + hasStar * 2)),
    relevance: Math.round(Math.min(95, base + (words > 25 ? 4 : 0))),
    structure: Math.round(Math.min(95, base + hasStar * 4)),
    strengths: words >= 40 ? ["Provides enough detail to evaluate the example", "Connects actions to an outcome"] : ["Direct response to the question"],
    improvements: words < 40 ? ["Add a concrete example with your specific actions and outcome"] : ["Make the situation, action, and measurable result easier to distinguish"],
  };
}

async function evaluateAnswer(userId: string, question: string, answer: string, role: string | null, company: string | null): Promise<HREvaluation> {
  const prompt = `Evaluate an HR interview coaching answer. This is training feedback, not a hiring decision. Never infer protected characteristics, personality diagnoses, health, or other sensitive traits. Return ONLY JSON with numeric 0-100 fields communication, behavioral, relevance, structure and string arrays strengths, improvements. Be evidence-based. ROLE: ${role ?? "unspecified"}. COMPANY: ${company ?? "unspecified"}. QUESTION: ${question}\nANSWER: ${answer.slice(0, 10000)}`;
  try {
    const response = await aiService.generate(userId, {
      capability: "reasoning", prompt,
      systemPrompt: "You are IntelliHire's HR interview coach. Evaluate only the observable content of the answer and give actionable coaching.",
      maxTokens: 600, temperature: 0.2,
    });
    return parseEvaluation(response.text, answer);
  } catch {
    return deterministicEvaluation(answer);
  }
}

export async function startInterview(userId: string, role: string | null, company: string | null) {
  await ensureSchema();
  const existing = await pgPool.query(`SELECT id FROM hr_interviews WHERE user_id=$1 AND status='IN_PROGRESS' ORDER BY started_at DESC LIMIT 1`, [userId]);
  if (existing.rows[0]) return getInterview(userId, existing.rows[0].id);

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const id = randomUUID();
    await client.query(`INSERT INTO hr_interviews(id,user_id,role,company) VALUES($1,$2,$3,$4)`, [id, userId, role, company]);
    for (let index = 0; index < QUESTIONS.length; index += 1) {
      const question = QUESTIONS[index];
      await client.query(`INSERT INTO hr_questions(id,interview_id,category,prompt,sequence_no) VALUES($1,$2,$3,$4,$5)`, [randomUUID(), id, question.category, question.prompt, index + 1]);
    }
    await client.query("COMMIT");
    return getInterview(userId, id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function getInterview(userId: string, interviewId: string) {
  await ensureSchema();
  const interview = await pgPool.query(`SELECT id,role,company,status,started_at,completed_at FROM hr_interviews WHERE id=$1 AND user_id=$2`, [interviewId, userId]);
  if (!interview.rows[0]) throw Object.assign(new Error("HR interview not found"), { code: "NOT_FOUND" });
  const questions = await pgPool.query(`SELECT id,category,prompt,sequence_no FROM hr_questions WHERE interview_id=$1 ORDER BY sequence_no`, [interviewId]);
  const answered = await pgPool.query(`SELECT question_id FROM hr_responses WHERE interview_id=$1`, [interviewId]);
  const answeredIds = new Set(answered.rows.map((row) => row.question_id));
  const next = questions.rows.find((row) => !answeredIds.has(row.id));
  return {
    id: interview.rows[0].id, role: interview.rows[0].role, company: interview.rows[0].company,
    status: interview.rows[0].status, startedAt: interview.rows[0].started_at, completedAt: interview.rows[0].completed_at,
    answered: answeredIds.size, total: questions.rows.length,
    currentQuestion: next ? { id: next.id, category: next.category, prompt: next.prompt, sequenceNo: next.sequence_no } : null,
  };
}

export async function answerQuestion(userId: string, interviewId: string, questionId: string, answerText: string) {
  await ensureSchema();
  const answer = answerText.trim();
  if (answer.length < 10) throw Object.assign(new Error("Answer must contain at least 10 characters"), { code: "VALIDATION_ERROR" });
  if (answer.length > 10000) throw Object.assign(new Error("Answer is too long"), { code: "VALIDATION_ERROR" });
  const interview = await pgPool.query(`SELECT id,role,company,status FROM hr_interviews WHERE id=$1 AND user_id=$2`, [interviewId, userId]);
  if (!interview.rows[0]) throw Object.assign(new Error("HR interview not found"), { code: "NOT_FOUND" });
  if (interview.rows[0].status !== "IN_PROGRESS") throw Object.assign(new Error("HR interview is not active"), { code: "CONFLICT" });
  const question = await pgPool.query(`SELECT id,prompt FROM hr_questions WHERE id=$1 AND interview_id=$2`, [questionId, interviewId]);
  if (!question.rows[0]) throw Object.assign(new Error("Question not found"), { code: "NOT_FOUND" });
  const duplicate = await pgPool.query(`SELECT 1 FROM hr_responses WHERE interview_id=$1 AND question_id=$2`, [interviewId, questionId]);
  if (duplicate.rows[0]) throw Object.assign(new Error("This question has already been answered"), { code: "CONFLICT" });

  const evaluation = await evaluateAnswer(userId, question.rows[0].prompt, answer, interview.rows[0].role, interview.rows[0].company);
  await pgPool.query(`INSERT INTO hr_responses(id,interview_id,question_id,answer_text,evaluation) VALUES($1,$2,$3,$4,$5::jsonb)`, [randomUUID(), interviewId, questionId, answer, JSON.stringify(evaluation)]);
  return { evaluation, interview: await getInterview(userId, interviewId) };
}

export async function completeInterview(userId: string, interviewId: string): Promise<HRResult> {
  await ensureSchema();
  const interview = await pgPool.query(`SELECT id,status FROM hr_interviews WHERE id=$1 AND user_id=$2`, [interviewId, userId]);
  if (!interview.rows[0]) throw Object.assign(new Error("HR interview not found"), { code: "NOT_FOUND" });
  if (interview.rows[0].status === "COMPLETED") {
    const existing = await pgPool.query(`SELECT * FROM hr_results WHERE interview_id=$1`, [interviewId]);
    if (existing.rows[0]) return mapResult(existing.rows[0]);
  }
  if (interview.rows[0].status !== "IN_PROGRESS") throw Object.assign(new Error("HR interview is not active"), { code: "CONFLICT" });
  const counts = await pgPool.query(`SELECT COUNT(*)::int AS answered FROM hr_responses WHERE interview_id=$1 AND evaluation IS NOT NULL`, [interviewId]);
  const total = await pgPool.query(`SELECT COUNT(*)::int AS total FROM hr_questions WHERE interview_id=$1`, [interviewId]);
  if (counts.rows[0].answered !== total.rows[0].total || total.rows[0].total === 0) throw Object.assign(new Error(`Complete all ${total.rows[0].total} questions before finishing the interview`), { code: "INCOMPLETE" });
  const rows = await pgPool.query(`SELECT evaluation FROM hr_responses WHERE interview_id=$1`, [interviewId]);
  const evaluations = rows.rows.map((row) => row.evaluation as HREvaluation).filter(Boolean);
  const avg = (key: keyof Pick<HREvaluation, "communication"|"behavioral"|"relevance"|"structure">) => Math.round(evaluations.reduce((sum, item) => sum + clampScore(item[key]), 0) / evaluations.length);
  const result: HRResult = {
    communication: avg("communication"), behavioral: avg("behavioral"), relevance: avg("relevance"), structure: avg("structure"),
    overallScore: 0,
    strengths: [...new Set(evaluations.flatMap((item) => item.strengths ?? []))].slice(0, 6),
    improvements: [...new Set(evaluations.flatMap((item) => item.improvements ?? []))].slice(0, 6),
    recommendations: ["Use the STAR structure for behavioral questions.", "Quantify outcomes when possible.", "Keep the focus on your specific actions and decisions."],
  };
  result.overallScore = Math.round((result.communication + result.behavioral + result.relevance + result.structure) / 4);

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE hr_interviews SET status='COMPLETED',completed_at=now() WHERE id=$1 AND user_id=$2`, [interviewId, userId]);
    await client.query(`INSERT INTO hr_results(id,interview_id,overall_score,communication,behavioral,relevance,structure,strengths,improvements,recommendations) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb) ON CONFLICT(interview_id) DO UPDATE SET overall_score=EXCLUDED.overall_score,communication=EXCLUDED.communication,behavioral=EXCLUDED.behavioral,relevance=EXCLUDED.relevance,structure=EXCLUDED.structure,strengths=EXCLUDED.strengths,improvements=EXCLUDED.improvements,recommendations=EXCLUDED.recommendations`, [randomUUID(), interviewId, result.overallScore, result.communication, result.behavioral, result.relevance, result.structure, JSON.stringify(result.strengths), JSON.stringify(result.improvements), JSON.stringify(result.recommendations)]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  return result;
}

function mapResult(row: Record<string, unknown>): HRResult {
  return {
    overallScore: Number(row.overall_score), communication: Number(row.communication), behavioral: Number(row.behavioral),
    relevance: Number(row.relevance), structure: Number(row.structure),
    strengths: Array.isArray(row.strengths) ? row.strengths.map(String) : [],
    improvements: Array.isArray(row.improvements) ? row.improvements.map(String) : [],
    recommendations: Array.isArray(row.recommendations) ? row.recommendations.map(String) : [],
  };
}

export async function listInterviewHistory(userId: string) {
  await ensureSchema();
  const result = await pgPool.query(`SELECT i.id,i.role,i.company,i.status,i.started_at,i.completed_at,r.overall_score,r.communication,r.behavioral,r.relevance,r.structure FROM hr_interviews i LEFT JOIN hr_results r ON r.interview_id=i.id WHERE i.user_id=$1 ORDER BY i.started_at DESC LIMIT 50`, [userId]);
  return result.rows.map((row) => ({ id: row.id, role: row.role, company: row.company, status: row.status, startedAt: row.started_at, completedAt: row.completed_at, result: row.overall_score == null ? null : { overallScore: Number(row.overall_score), communication: Number(row.communication), behavioral: Number(row.behavioral), relevance: Number(row.relevance), structure: Number(row.structure) } }));
}
