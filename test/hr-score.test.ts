import { describe, expect, it } from "vitest";
import { deterministicEvaluation } from "@/lib/modules/hr/repository";

describe("HR score", () => {
  it("is stable", () => {
    const answer = "Situation task action result: I owned the incident, coordinated the fix, and restored service.";
    expect(deterministicEvaluation(answer)).toEqual(deterministicEvaluation(answer));
  });

  it("stays within the score range", () => {
    const score = deterministicEvaluation("I fixed the issue.");
    for (const value of [score.communication, score.behavioral, score.relevance, score.structure]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});
