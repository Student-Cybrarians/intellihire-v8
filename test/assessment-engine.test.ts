import { describe, expect, it } from "vitest";
import { abilityToScore, chooseQuestion, probabilityCorrect, updateAbility } from "@/lib/modules/assessment/engine";
import type { AssessmentQuestion } from "@/lib/modules/assessment/types";

const question = (id: string, difficulty: number): AssessmentQuestion => ({
  id,
  section: "coding",
  prompt: "Question",
  options: ["A", "B", "C", "D"],
  difficulty,
  discrimination: 1.2,
});

describe("adaptive assessment engine", () => {
  it("returns a bounded 3PL probability", () => {
    const p = probabilityCorrect(0, question("q", 0));
    expect(p).toBeGreaterThanOrEqual(0.25);
    expect(p).toBeLessThanOrEqual(1);
  });

  it("moves ability in the expected direction", () => {
    const q = question("q", 0);
    expect(updateAbility(0, q, true)).toBeGreaterThan(0);
    expect(updateAbility(0, q, false)).toBeLessThan(0);
  });

  it("keeps ability scores within the public 0-100 range", () => {
    expect(abilityToScore(-3)).toBe(10);
    expect(abilityToScore(0)).toBe(50);
    expect(abilityToScore(3)).toBe(90);
  });

  it("selects the unanswered question nearest the current ability", () => {
    const questions = [question("easy", -1), question("target", 0.1), question("hard", 2)];
    expect(chooseQuestion(questions, new Set(["easy"]), 0)).toMatchObject({ id: "target" });
    expect(chooseQuestion(questions, new Set(["easy", "target", "hard"]), 0)).toBeNull();
  });
});
