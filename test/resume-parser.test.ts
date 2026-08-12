import { describe, expect, it } from "vitest";
import { parseResumeFile, resumeParserLimits, ResumeParseError } from "../src/lib/modules/ats/resumeParser";

describe("resume parser", () => {
  it("extracts plain-text resumes", async () => {
    const file = new File(
      ["Jane Doe\nSoftware Engineer\nPython React PostgreSQL and five years of experience."],
      "resume.txt",
      { type: "text/plain" },
    );
    const result = await parseResumeFile(file);
    expect(result.documentType).toBe("text");
    expect(result.text).toContain("Jane Doe");
  });

  it("rejects oversized files before parsing", async () => {
    const file = new File([new Uint8Array(resumeParserLimits.maxBytes + 1)], "resume.txt", { type: "text/plain" });
    await expect(parseResumeFile(file)).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  it("rejects unsupported file formats", async () => {
    const file = new File(["not a resume"], "resume.exe", { type: "application/octet-stream" });
    await expect(parseResumeFile(file)).rejects.toBeInstanceOf(ResumeParseError);
  });
});
