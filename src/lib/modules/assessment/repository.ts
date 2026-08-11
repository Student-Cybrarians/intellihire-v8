import { pgPool } from "@/db/client";
import { randomUUID } from "crypto";
import type { AssessmentQuestion, AssessmentResult, AssessmentSection, AssessmentState } from "./types";
import { chooseQuestion, updateAbility, abilityToScore } from "./engine";

const SEED_QUESTIONS: Array<Omit<AssessmentQuestion, "id"> & { correctIndex: number; explanation: string }> = [
  { section: "quantitative", prompt: "A and B have ages in the ratio 3:5. Five years ago the ratio was 2:3. What is A's current age?", options: ["15", "20", "25", "30"], correctIndex: 1, difficulty: 0, discrimination: 1.1, explanation: "Solve 3x/5x with the five-year offset; A is 20." },
  { section: "quantitative", prompt: "A service costs $80 and is discounted by 15%. What is the final price?", options: ["$66", "$68", "$70", "$72"], correctIndex: 1, difficulty: -0.4, discrimination: 1, explanation: "80 × 0.85 = 68." },
  { section: "logical", prompt: "Which sequence continues the pattern 2, 6, 12, 20, 30, ?", options: ["36", "40", "42", "44"], correctIndex: 2, difficulty: 0.2, discrimination: 1.2, explanation: "Differences are 4, 6, 8, 10, then 12; 30 + 12 = 42." },
  { section: "logical", prompt: "If every API request requires authentication and endpoint X accepts unauthenticated requests, what follows?", options: ["X is an exception", "The policy is inconsistent", "Authentication is optional", "Nothing can be inferred"], correctIndex: 1, difficulty: 0.1, discrimination: 1, explanation: "The stated rule and observed behavior conflict." },
  { section: "verbal", prompt: "Choose the clearest professional sentence.", options: ["Send me it quickly.", "Please send the updated report by 5 PM.", "You should maybe send the thing.", "The report, if possible, can be sent."], correctIndex: 1, difficulty: -0.2, discrimination: 0.9, explanation: "It is specific, concise, and action-oriented." },
  { section: "domain", prompt: "Which database index is generally appropriate for frequent equality lookups on a unique identifier?", options: ["B-tree", "Bitmap only", "Heap scan", "No index"], correctIndex: 0, difficulty: 0.3, discrimination: 1.1, explanation: "A B-tree index is the standard choice for equality lookups." },
  { section: "coding", prompt: "What is the average time complexity of HashMap key lookup with a good hash distribution?", options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"], correctIndex: 0, difficulty: -0.1, discrimination: 1.2, explanation: "Average-case hash lookup is O(1)." },
  { section: "coding", prompt: "Which approach detects a cycle in a singly linked list in O(n) time and O(1) extra space?", options: ["HashSet of nodes", "Floyd's tortoise and hare", "Sorting", "Recursion only"], correctIndex: 1, difficulty: 0.8, discrimination: 1.3, explanation: "Floyd's two-pointer algorithm uses constant extra space." },
  { section: "domain", prompt: "Which HTTP method is normally used for a partial update of an existing resource?", options: ["GET", "POST", "PATCH", "OPTIONS"], correctIndex: 2, difficulty: -0.6, discrimination: 1, explanation: "PATCH is defined for partial modifications." },
  { section: "logical", prompt: "If no microservice may call the database directly except through the data service, what architecture principle is being enforced?", options: ["Layered access control", "Eventual consistency", "Randomized testing", "Horizontal scaling"], correctIndex: 0, difficulty: 0.5, discrimination: 1.1, explanation: "The rule enforces a controlled data-access boundary." },
];

let schemaReady: Promise<void> | null = null;

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS assessment_questions (
          id uuid PRIMARY KEY,
          section varchar(32) NOT NULL,
          prompt text NOT NULL,
          options jsonb NOT NULL,
          correct_index integer NOT NULL,
          difficulty real NOT NULL DEFAULT 0,
          discrimination real NOT NULL DEFAULT 1,
          explanation text NOT NULL,
          active boolean NOT NULL DEFAULT true,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS assessment_attempts (
          id uuid PRIMARY KEY,
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role varchar(255),
          status varchar(24) NOT NULL DEFAULT 'IN_PROGRESS',
          ability real NOT NULL DEFAULT 0,
          question_count integer NOT NULL DEFAULT 0,
          started_at timestamptz NOT NULL DEFAULT now(),
          completed_at timestamptz
        );
        CREATE INDEX IF NOT EXISTS assessment_attempts_user_idx ON assessment_attempts(user_id);
        CREATE TABLE IF NOT EXISTS assessment_responses (
          id uuid PRIMARY KEY,
          attempt_id uuid NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
          question_id uuid NOT NULL REFERENCES assessment_questions(id),
          answer_index integer NOT NULL,
          is_correct boolean NOT NULL,
          response_ms integer,
          ability_after real NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE(attempt_id, question_id)
        );
        CREATE INDEX IF NOT EXISTS assessment_responses_attempt_idx ON assessment_responses(attempt_id);
        CREATE TABLE IF NOT EXISTS assessment_results (
          id uuid PRIMARY KEY,
          attempt_id uuid NOT NULL UNIQUE REFERENCES assessment_attempts(id) ON DELETE CASCADE,
          overall_score integer NOT NULL,
          accuracy integer NOT NULL,
          speed_score integer NOT NULL,
          ability real NOT NULL,
          section_scores jsonb NOT NULL,
          strengths jsonb NOT NULL,
          weaknesses jsonb NOT NULL,
          recommendations jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      for (const q of SEED_QUESTIONS) {
        const id = randomUUID();
        await pgPool.query(
          `INSERT INTO assessment_questions (id, section, prompt, options, correct_index, difficulty, discrimination, explanation)
           SELECT $1, $2, $3, $4::jsonb, $5, $6, $7, $8
           WHERE NOT EXISTS (SELECT 1 FROM assessment_questions WHERE prompt = $3)`,
          [id, q.section, q.prompt, JSON.stringify(q.options), q.correctIndex, q.difficulty, q.discrimination, q.explanation],
        );
      }
    })();
  }
  return schemaReady;
}

export async function startAttempt(userId: string, role: string | null): Promise<AssessmentState> {
  await ensureSchema();
  const existing = await pgPool.query(
    `SELECT id, status, role, ability, question_count FROM assessment_attempts
     WHERE user_id = $1 AND status = 'IN_PROGRESS' ORDER BY started_at DESC LIMIT 1`,
    [userId],
  );
  if (existing.rows[0]) return getState(userId, existing.rows[0].id);

  const id = randomUUID();
  await pgPool.query(
    `INSERT INTO assessment_attempts (id, user_id, role, status, ability, question_count) VALUES ($1, $2, $3, 'IN_PROGRESS', 0, 0)`,
    [id, userId, role],
  );
  return getState(userId, id);
}

export async function getState(userId: string, attemptId: string): Promise<AssessmentState> {
  await ensureSchema();
  const attempt = await pgPool.query(
    `SELECT id, status, role, ability, question_count FROM assessment_attempts WHERE id = $1 AND user_id = $2`,
    [attemptId, userId],
  );
  if (!attempt.rows[0]) throw new Error("Assessment attempt not found");
  const answered = await pgPool.query(`SELECT question_id FROM assessment_responses WHERE attempt_id = $1`, [attemptId]);
  const answeredIds = new Set<string>(answered.rows.map((r) => r.question_id));
  const count = attempt.rows[0].question_count as number;
  const questions = await pgPool.query(`SELECT id, section, prompt, options, difficulty, discrimination FROM assessment_questions WHERE active = true`);
  const mapped: AssessmentQuestion[] = questions.rows.map((r) => ({
    id: r.id,
    section: r.section,
    prompt: r.prompt,
    options: r.options,
    difficulty: Number(r.difficulty),
    discrimination: Number(r.discrimination),
  }));
  const currentQuestion = attempt.rows[0].status === "IN_PROGRESS" && count < 8
    ? chooseQuestion(mapped, answeredIds, Number(attempt.rows[0].ability))
    : null;
  return {
    id: attempt.rows[0].id,
    status: attempt.rows[0].status,
    role: attempt.rows[0].role,
    ability: Number(attempt.rows[0].ability),
    answered: answeredIds.size,
    questionCount: count,
    currentQuestion,
  };
}

export async function recordAnswer(userId: string, attemptId: string, questionId: string, answerIndex: number, responseMs: number | null) {
  await ensureSchema();
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const a = await client.query(`SELECT id, ability, question_count, status FROM assessment_attempts WHERE id = $1 AND user_id = $2 FOR UPDATE`, [attemptId, userId]);
    if (!a.rows[0] || a.rows[0].status !== "IN_PROGRESS") throw new Error("Assessment is not active");
    const q = await client.query(`SELECT id, section, prompt, options, correct_index, difficulty, discrimination FROM assessment_questions WHERE id = $1 AND active = true`, [questionId]);
    if (!q.rows[0]) throw new Error("Question not found");
    const dup = await client.query(`SELECT 1 FROM assessment_responses WHERE attempt_id = $1 AND question_id = $2`, [attemptId, questionId]);
    if (dup.rows[0]) throw new Error("Question already answered");
    const question: AssessmentQuestion = {
      id: q.rows[0].id,
      section: q.rows[0].section,
      prompt: q.rows[0].prompt,
      options: q.rows[0].options,
      difficulty: Number(q.rows[0].difficulty),
      discrimination: Number(q.rows[0].discrimination),
    };
    const correct = Number(answerIndex) === Number(q.rows[0].correct_index);
    const abilityAfter = updateAbility(Number(a.rows[0].ability), question, correct);
    await client.query(`INSERT INTO assessment_responses (id, attempt_id, question_id, answer_index, is_correct, response_ms, ability_after) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [randomUUID(), attemptId, questionId, answerIndex, correct, responseMs, abilityAfter]);
    await client.query(`UPDATE assessment_attempts SET ability = $2, question_count = question_count + 1 WHERE id = $1`, [attemptId, abilityAfter]);
    await client.query("COMMIT");
    return { correct, ability: abilityAfter, explanation: q.rows[0].explanation };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function completeAttempt(userId: string, attemptId: string): Promise<AssessmentResult> {
  await ensureSchema();
  const attempt = await pgPool.query(`SELECT id, ability, status FROM assessment_attempts WHERE id = $1 AND user_id = $2`, [attemptId, userId]);
  if (!attempt.rows[0]) throw new Error("Assessment attempt not found");
  if (attempt.rows[0].status === "COMPLETED") return getResult(userId, attemptId);
  const responses = await pgPool.query(
    `SELECT r.is_correct, r.response_ms, r.ability_after, q.section FROM assessment_responses r JOIN assessment_questions q ON q.id = r.question_id WHERE r.attempt_id = $1 ORDER BY r.created_at`,
    [attemptId],
  );
  const rows = responses.rows as Array<{is_correct:boolean; response_ms:number|null; ability_after:number; section:AssessmentSection}>;
  const accuracy = rows.length ? Math.round((rows.filter((r) => r.is_correct).length / rows.length) * 100) : 0;
  const avgMs = rows.filter((r) => r.response_ms !== null).reduce((s, r) => s + Number(r.response_ms), 0) / Math.max(1, rows.filter((r) => r.response_ms !== null).length);
  const speedScore = Math.round(Math.max(0, Math.min(100, 100 - Math.max(0, avgMs - 45000) / 150)));
  const overallScore = Math.round(abilityToScore(Number(attempt.rows[0].ability)) * 0.7 + accuracy * 0.2 + speedScore * 0.1);
  const sectionScores: Record<string, number> = {};
  for (const section of ["quantitative", "logical", "verbal", "domain", "coding"]) {
    const sr = rows.filter((r) => r.section === section);
    if (sr.length) sectionScores[section] = Math.round((sr.filter((r) => r.is_correct).length / sr.length) * 100);
  }
  const strengths = Object.entries(sectionScores).filter(([, score]) => score >= 80).map(([section]) => `Strong ${section} performance`);
  const weaknesses = Object.entries(sectionScores).filter(([, score]) => score < 60).map(([section]) => `Needs improvement in ${section}`);
  const recommendations = weaknesses.length ? weaknesses.map((x) => `Practice ${x.replace("Needs improvement in ", "") } questions and review explanations.`) : ["Increase difficulty and maintain consistent response speed."];
  await pgPool.query(`UPDATE assessment_attempts SET status = 'COMPLETED', completed_at = now() WHERE id = $1`, [attemptId]);
  await pgPool.query(
    `INSERT INTO assessment_results (id, attempt_id, overall_score, accuracy, speed_score, ability, section_scores, strengths, weaknesses, recommendations) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb) ON CONFLICT (attempt_id) DO UPDATE SET overall_score = EXCLUDED.overall_score, accuracy = EXCLUDED.accuracy, speed_score = EXCLUDED.speed_score, ability = EXCLUDED.ability, section_scores = EXCLUDED.section_scores, strengths = EXCLUDED.strengths, weaknesses = EXCLUDED.weaknesses, recommendations = EXCLUDED.recommendations`,
    [randomUUID(), attemptId, overallScore, accuracy, speedScore, Number(attempt.rows[0].ability), JSON.stringify(sectionScores), JSON.stringify(strengths), JSON.stringify(weaknesses), JSON.stringify(recommendations)],
  );
  return getResult(userId, attemptId);
}

export async function getResult(userId: string, attemptId: string): Promise<AssessmentResult> {
  const result = await pgPool.query(
    `SELECT r.overall_score, r.accuracy, r.speed_score, r.ability, r.section_scores, r.strengths, r.weaknesses, r.recommendations
     FROM assessment_results r JOIN assessment_attempts a ON a.id = r.attempt_id WHERE a.id = $1 AND a.user_id = $2`,
    [attemptId, userId],
  );
  if (!result.rows[0]) throw new Error("Assessment result not found");
  const r = result.rows[0];
  return { overallScore: r.overall_score, accuracy: r.accuracy, speedScore: r.speed_score, ability: Number(r.ability), sectionScores: r.section_scores, strengths: r.strengths, weaknesses: r.weaknesses, recommendations: r.recommendations };
}
