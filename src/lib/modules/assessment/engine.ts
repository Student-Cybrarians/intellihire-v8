import type { AssessmentQuestion } from "./types";

const GUESSING = 0.25;

/** 3PL-style probability of a correct response. */
export function probabilityCorrect(theta: number, question: AssessmentQuestion): number {
  const a = Math.max(0.5, question.discrimination);
  const b = question.difficulty;
  const logistic = 1 / (1 + Math.exp(-a * (theta - b)));
  return GUESSING + (1 - GUESSING) * logistic;
}

/** One-step Fisher-style ability update, bounded to the calibrated range. */
export function updateAbility(theta: number, question: AssessmentQuestion, correct: boolean): number {
  const p = probabilityCorrect(theta, question);
  const error = (correct ? 1 : 0) - p;
  const information = Math.max(0.15, question.discrimination * question.discrimination * p * (1 - p));
  const next = theta + 0.35 * (error / information);
  return Math.max(-3, Math.min(3, next));
}

export function abilityToScore(theta: number): number {
  return Math.round(Math.max(0, Math.min(100, 50 + (theta / 3) * 40)));
}

export function nextDifficulty(theta: number): number {
  return Math.max(-2.5, Math.min(2.5, theta));
}

export function chooseQuestion<T extends AssessmentQuestion>(
  questions: T[],
  answeredIds: Set<string>,
  theta: number,
): T | null {
  const candidates = questions.filter((q) => !answeredIds.has(q.id));
  if (!candidates.length) return null;
  const target = nextDifficulty(theta);
  return candidates.reduce((best, current) =>
    Math.abs(current.difficulty - target) < Math.abs(best.difficulty - target) ? current : best,
  );
}
