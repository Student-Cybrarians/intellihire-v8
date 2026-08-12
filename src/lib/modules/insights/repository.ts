import { pgPool } from "@/db/client";

export type ModuleMetric = {
  module: "module-1" | "module-2" | "module-3" | "module-4";
  label: string;
  available: boolean;
  attempts: number;
  score: number | null;
  completionRate: number;
  lastActivityAt: string | null;
};

export type InsightsOverview = {
  period: { start: string; end: string; days: number };
  overallScore: number | null;
  readinessLevel: "NOT_STARTED" | "BUILDING" | "READY" | "STRONG";
  metrics: ModuleMetric[];
  trend: Array<{ date: string; score: number }>;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
};

type ScoreRow = { attempts: number; completed: number; score: number | null; last_activity: Date | null };

function clamp(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }
function average(values: Array<number | null>) {
  const usable = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return usable.length ? clamp(usable.reduce((a, b) => a + b, 0) / usable.length) : null;
}
function readiness(score: number | null, attempts: number) {
  if (score === null || attempts === 0) return "NOT_STARTED" as const;
  if (score < 60) return "BUILDING" as const;
  if (score < 80) return "READY" as const;
  return "STRONG" as const;
}
function metric(label: ModuleMetric["label"], module: ModuleMetric["module"], row: ScoreRow | null, available: boolean): ModuleMetric {
  if (!available || !row) return { module, label, available, attempts: 0, score: null, completionRate: 0, lastActivityAt: null };
  return { module, label, available: true, attempts: row.attempts, score: row.score == null ? null : clamp(row.score), completionRate: row.attempts ? clamp((row.completed / row.attempts) * 100) : 0, lastActivityAt: row.last_activity?.toISOString() ?? null };
}

async function getModule2(userId: string, start: Date, end: Date): Promise<ScoreRow> {
  const result = await pgPool.query(`
    SELECT COUNT(a.id)::int AS attempts,
      COUNT(*) FILTER (WHERE a.status='COMPLETED')::int AS completed,
      AVG(r.overall_score)::float AS score,
      MAX(COALESCE(a.completed_at, a.started_at)) AS last_activity
    FROM assessment_attempts a
    LEFT JOIN assessment_results r ON r.attempt_id=a.id
    WHERE a.user_id=$1 AND a.started_at >= $2 AND a.started_at <= $3
  `, [userId, start, end]);
  return result.rows[0] as ScoreRow;
}

async function getModule3(userId: string, start: Date, end: Date): Promise<ScoreRow> {
  const result = await pgPool.query(`
    SELECT COUNT(i.id)::int AS attempts,
      COUNT(*) FILTER (WHERE i.status='COMPLETED')::int AS completed,
      AVG(r.overall_score)::float AS score,
      MAX(COALESCE(i.completed_at, i.started_at)) AS last_activity
    FROM technical_interviews i
    LEFT JOIN technical_results r ON r.interview_id=i.id
    WHERE i.user_id=$1 AND i.started_at >= $2 AND i.started_at <= $3
  `, [userId, start, end]);
  return result.rows[0] as ScoreRow;
}

async function getModule4(userId: string, start: Date, end: Date): Promise<ScoreRow> {
  const result = await pgPool.query(`
    SELECT COUNT(i.id)::int AS attempts,
      COUNT(*) FILTER (WHERE i.status='COMPLETED')::int AS completed,
      AVG(r.overall_score)::float AS score,
      MAX(COALESCE(i.completed_at, i.started_at)) AS last_activity
    FROM hr_interviews i
    LEFT JOIN hr_results r ON r.interview_id=i.id
    WHERE i.user_id=$1 AND i.started_at >= $2 AND i.started_at <= $3
  `, [userId, start, end]);
  return result.rows[0] as ScoreRow;
}

function buildNarrative(metrics: ModuleMetric[], overallScore: number | null) {
  const scored = metrics.filter((m) => m.score !== null);
  const strengths = scored.filter((m) => (m.score ?? 0) >= 75).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3).map((m) => `${m.label} is a strength at ${m.score}/100.`);
  const gaps = scored.filter((m) => (m.score ?? 0) < 70).sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, 3).map((m) => `${m.label} needs attention (${m.score}/100).`);
  const recommendations: string[] = [];
  for (const m of metrics) {
    if (!m.available) continue;
    if (m.attempts === 0) recommendations.push(`Complete ${m.label} so your readiness profile has enough evidence.`);
    else if ((m.score ?? 0) < 70) recommendations.push(`Repeat ${m.label} and focus on the feedback from your lowest-scoring areas.`);
    else if (m.completionRate < 80) recommendations.push(`Finish more ${m.label} sessions to make the score more reliable.`);
  }
  if (overallScore !== null && overallScore >= 80) recommendations.push("Maintain your strongest areas while practicing the lowest-scoring module weekly.");
  if (overallScore !== null && overallScore < 60) recommendations.push("Build consistency first: complete one focused practice session in each available module.");
  return {
    strengths: strengths.length ? strengths : ["Keep completing modules to establish measurable strengths."],
    gaps: gaps.length ? gaps : ["No major score gap is visible in the selected period."],
    recommendations: [...new Set(recommendations)].slice(0, 6),
  };
}

export async function getOverview(userId: string, days = 30): Promise<InsightsOverview> {
  const safeDays = Math.max(1, Math.min(365, Math.trunc(days)));
  const end = new Date();
  const start = new Date(end.getTime() - safeDays * 24 * 60 * 60 * 1000);
  const [m2, m3, m4] = await Promise.all([getModule2(userId, start, end), getModule3(userId, start, end), getModule4(userId, start, end)]);
  const metrics = [
    metric("AI Adaptive Assessment", "module-2", m2, true),
    metric("Technical Interview", "module-3", m3, true),
    metric("HR Interview", "module-4", m4, true),
  ];
  const overallScore = average(metrics.map((m) => m.score));
  const narrative = buildNarrative(metrics, overallScore);
  const trendResult = await pgPool.query(`
    SELECT DATE_TRUNC('day', created_at)::date AS day, AVG(overall_score)::float AS score
    FROM (
      SELECT r.created_at, r.overall_score FROM assessment_results r JOIN assessment_attempts a ON a.id=r.attempt_id WHERE a.user_id=$1 AND r.created_at >= $2 AND r.created_at <= $3
      UNION ALL
      SELECT r.created_at, r.overall_score FROM technical_results r JOIN technical_interviews i ON i.id=r.interview_id WHERE i.user_id=$1 AND r.created_at >= $2 AND r.created_at <= $3
      UNION ALL
      SELECT r.created_at, r.overall_score FROM hr_results r JOIN hr_interviews i ON i.id=r.interview_id WHERE i.user_id=$1 AND r.created_at >= $2 AND r.created_at <= $3
    ) scores
    GROUP BY day ORDER BY day
  `, [userId, start, end]);
  return {
    period: { start: start.toISOString(), end: end.toISOString(), days: safeDays },
    overallScore,
    readinessLevel: readiness(overallScore, metrics.reduce((sum, m) => sum + m.attempts, 0)),
    metrics,
    trend: trendResult.rows.map((row) => ({ date: new Date(row.day).toISOString().slice(0, 10), score: clamp(Number(row.score)) })),
    ...narrative,
  };
}

export async function createReport(userId: string, days = 30) {
  const overview = await getOverview(userId, days);
  const idResult = await pgPool.query(`
    INSERT INTO performance_insight_reports(id,user_id,period_start,period_end,overall_score,readiness_level,metrics,strengths,gaps,recommendations)
    VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb)
    RETURNING id, created_at
  `, [userId, new Date(overview.period.start), new Date(overview.period.end), overview.overallScore ?? 0, overview.readinessLevel, JSON.stringify(overview.metrics), JSON.stringify(overview.strengths), JSON.stringify(overview.gaps), JSON.stringify(overview.recommendations)]);
  return { id: idResult.rows[0].id as string, createdAt: idResult.rows[0].created_at as Date, ...overview };
}

export async function listReports(userId: string) {
  const result = await pgPool.query(`
    SELECT id, period_start, period_end, overall_score, readiness_level, created_at
    FROM performance_insight_reports WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50
  `, [userId]);
  return result.rows.map((row) => ({ id: row.id, periodStart: row.period_start, periodEnd: row.period_end, overallScore: Number(row.overall_score), readinessLevel: row.readiness_level, createdAt: row.created_at }));
}

export async function getReport(userId: string, reportId: string) {
  const result = await pgPool.query(`
    SELECT id, period_start, period_end, overall_score, readiness_level, metrics, strengths, gaps, recommendations, created_at
    FROM performance_insight_reports WHERE id=$1 AND user_id=$2
  `, [reportId, userId]);
  const row = result.rows[0];
  if (!row) throw Object.assign(new Error("Performance report not found"), { code: "NOT_FOUND" });
  return { id: row.id, period: { start: row.period_start, end: row.period_end }, overallScore: Number(row.overall_score), readinessLevel: row.readiness_level, metrics: row.metrics, strengths: row.strengths, gaps: row.gaps, recommendations: row.recommendations, createdAt: row.created_at };
}
