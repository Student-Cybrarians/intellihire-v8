import { describe, expect, it } from "vitest";
import { abilityToScore, chooseQuestion, probabilityCorrect, updateAbility } from "./engine";
import type { AssessmentQuestion } from "./types";

const question: AssessmentQuestion = {
  id: "q1",
  section: "coding",
  prompt: "What is average hash lookup complexity?",
  options: ["O(1)", "O(n)"],
  difficulty: 0,
  discrimination: 1,
};

describe("adaptive assessment engine", () => {
  it("produces a probability strictly between guessing and certainty", () => {
    const p = probabilityCorrect(0, question);
    expect(p).toBeGreaterThan(0.25);
    expect(p).toBeLessThan(1);
  });

  it("raises ability after a correct response and lowers it after an incorrect response", () => {
    const up = updateAbility(0, question, true);
    const down = updateAbility(0, question, false);
    expect(up).toBeGreaterThan(0);
    expect(down).toBeLessThan(0);
  });

  it("keeps ability score bounded and normalized", () => {
    expect(abilityToScore(-3)).toBeGreaterThanOrEqual(0);
    expect(abilityToScore(3)).toBeLessThanOrEqual(100);
  });

  it("selects the unused question closest to current ability", () => {
    const questions = [
      question,
      { ...question, id: "q2", difficulty: 1.5 },
      { ...question, id: "q3", difficulty: -1 },
    ];
    expect(chooseQuestion(questions, new Set(["q1"]), 1.2)?.id).toBe("q2");
  });
});
