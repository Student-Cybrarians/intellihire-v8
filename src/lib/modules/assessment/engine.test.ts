import { describe, expect, it } from "vitest";
import { abilityToScore, chooseAdaptiveQuestion, chooseQuestion, probabilityCorrect, updateAbility, weakestSection } from "./engine";
import type { AssessmentQuestion, AssessmentSection } from "./types";

const question: AssessmentQuestion = {
  id: "q1",
  section: "coding",
  prompt: "What is average hash lookup complexity?",
  options: ["O(1)", "O(n)"],
  difficulty: 0,
  discrimination: 1,
};

const sectionAbilities: Record<AssessmentSection, number> = {
  quantitative: 0.4,
  logical: 0.2,
  verbal: 0.1,
  domain: -0.8,
  coding: 0.6,
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

  it("covers an unseen section before drilling into the weakest section", () => {
    const counts = { quantitative: 1, logical: 1, verbal: 1, domain: 1, coding: 0 } as Record<AssessmentSection, number>;
    expect(weakestSection(sectionAbilities, counts)).toBe("coding");
  });

  it("targets the weakest persisted section at a calibrated difficulty", () => {
    const questions = [
      { ...question, id: "coding-hard", difficulty: 0.7 },
      { ...question, id: "coding-easy", difficulty: -0.5 },
      { ...question, id: "domain-mid", section: "domain" as const, difficulty: -0.7 },
    ];
    const counts = { quantitative: 1, logical: 1, verbal: 1, domain: 2, coding: 2 } as Record<AssessmentSection, number>;
    expect(chooseAdaptiveQuestion(questions, new Set(), 0, sectionAbilities, counts)?.id).toBe("domain-mid");
  });
});
