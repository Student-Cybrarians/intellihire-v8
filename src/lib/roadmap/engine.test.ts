import { describe, expect, it } from "vitest";
import { fingerprintRoadmapInput } from "./engine";

const graph = [
  { name: "TypeScript", state: "evidenced" as const, evidence: ["resume"] },
  { name: "Kubernetes", state: "gap" as const, evidence: ["job requirement"] },
  { name: "Docker", state: "transferable" as const, evidence: ["resume"] },
];

describe("roadmap engine contracts", () => {
  it("fingerprints identical skill graphs deterministically", () => {
    const input = { targetRole: "Platform Engineer", skillGraph: graph };
    expect(fingerprintRoadmapInput(input)).toBe(fingerprintRoadmapInput(input));
  });

  it("keeps evidence states explicit", () => {
    expect(graph.find((x) => x.name === "Kubernetes")?.state).toBe("gap");
    expect(graph.find((x) => x.name === "Docker")?.state).toBe("transferable");
  });
});
