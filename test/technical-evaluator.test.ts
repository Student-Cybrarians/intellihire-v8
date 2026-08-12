import { describe, expect, it } from "vitest";
import { deterministicTechnicalEvaluation, parseTechnicalEvaluation } from "@/lib/modules/technical/evaluator";

describe("Module 3 technical evaluator", () => {
  it("parses and clamps structured AI output", () => {
    const result = parseTechnicalEvaluation('{"correctness":120,"codeQuality":-4,"problemSolving":80,"communication":70,"strengths":["clear"],"improvements":["add edge cases"]}');
    expect(result.correctness).toBe(100);
    expect(result.codeQuality).toBe(0);
    expect(result.problemSolving).toBe(80);
  });

  it("rejects malformed AI output", () => {
    expect(() => parseTechnicalEvaluation("not json")).toThrow();
  });

  it("provides bounded deterministic fallback feedback", () => {
    const result = deterministicTechnicalEvaluation("I would use a hash set, discuss complexity, and handle edge cases.", "const seen = new Set();");
    expect(result.correctness).toBeGreaterThanOrEqual(0);
    expect(result.correctness).toBeLessThanOrEqual(100);
    expect(result.codeQuality).toBeGreaterThanOrEqual(0);
    expect(result.codeQuality).toBeLessThanOrEqual(100);
    expect(result.strengths.length).toBeGreaterThan(0);
    expect(result.improvements.length).toBeGreaterThan(0);
  });
});
