import { describe, expect, it } from "vitest";
import { fingerprintCareerTwinInput } from "./engine";

const resume = "Senior Python developer with React, PostgreSQL, Docker, Git, and API development experience delivering production systems.";
const jd = "We need a Python developer with React, PostgreSQL, Docker, Kubernetes, and system design experience.";

describe("Career Digital Twin", () => {
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

  it("never requires raw resume text to be persisted by the fingerprint contract", () => {
    const fingerprint = fingerprintCareerTwinInput(resume, jd, "Python Developer", null);
    expect(fingerprint).not.toContain("Python");
    expect(fingerprint).not.toContain("PostgreSQL");
  });
});
