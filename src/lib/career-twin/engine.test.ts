import { describe, expect, it } from "vitest";
import { deterministicCareerTwin, fingerprintCareerTwinInput } from "./engine";

const resume = "Senior Python developer with React, PostgreSQL, Docker, Git, and API development experience delivering production systems.";
const jd = "We need a Python developer with React, PostgreSQL, Docker, Kubernetes, and system design experience.";

describe("Career Digital Twin", () => {
  it("builds an evidence-scoped graph with explicit skill states", () => {
    const twin = deterministicCareerTwin(resume, jd, "Python Developer", "Example Corp");
    expect(twin.targetRole).toBe("Python Developer");
    expect(twin.skillGraph.find((skill) => skill.name === "python")?.state).toBe("evidenced");
    expect(twin.skillGraph.find((skill) => skill.name === "kubernetes")?.state).toBe("gap");
    expect(twin.skillGraph.every((skill) => ["evidenced", "gap", "transferable"].includes(skill.state))).toBe(true);
    expect(twin.confidence).toBeGreaterThanOrEqual(35);
    expect(twin.confidence).toBeLessThanOrEqual(95);
  });

  it("never promotes an unsupported job requirement to evidenced", () => {
    const twin = deterministicCareerTwin(resume, jd, "Python Developer", null);
    expect(twin.skillGraph.find((skill) => skill.name === "kubernetes")?.state).not.toBe("evidenced");
    expect(twin.gaps.some((gap) => gap.toLowerCase().includes("kubernetes"))).toBe(true);
  });

  it("produces stable fingerprints for the same evidence inputs", () => {
    const first = fingerprintCareerTwinInput(resume, jd, "Python Developer", "Example Corp");
    const second = fingerprintCareerTwinInput(resume, jd, "Python Developer", "Example Corp");
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes the fingerprint when the target evidence changes", () => {
    const first = fingerprintCareerTwinInput(resume, jd, "Python Developer", null);
    const second = fingerprintCareerTwinInput(resume, jd.replace("Kubernetes", "Terraform"), "Python Developer", null);
    expect(first).not.toBe(second);
  });

  it("does not encode raw resume content in the persisted fingerprint", () => {
    const fingerprint = fingerprintCareerTwinInput(resume, jd, "Python Developer", null);
    expect(fingerprint).not.toContain("Python");
    expect(fingerprint).not.toContain("PostgreSQL");
  });
});
