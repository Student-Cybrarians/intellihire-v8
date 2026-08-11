import { describe, it, expect } from "vitest";
import { sanitizeReturnTo } from "@/lib/safeRedirect";

describe("sanitizeReturnTo (open redirect prevention)", () => {
  it("allows a plain relative path", () => {
    expect(sanitizeReturnTo("/dashboard/settings")).toBe("/dashboard/settings");
  });

  it("falls back to /dashboard for null/undefined/empty input", () => {
    expect(sanitizeReturnTo(null)).toBe("/dashboard");
    expect(sanitizeReturnTo(undefined)).toBe("/dashboard");
    expect(sanitizeReturnTo("")).toBe("/dashboard");
  });

  it("rejects absolute URLs to other hosts", () => {
    expect(sanitizeReturnTo("https://evil.com/phish")).toBe("/dashboard");
    expect(sanitizeReturnTo("http://evil.com")).toBe("/dashboard");
  });

  it("rejects protocol-relative URLs", () => {
    expect(sanitizeReturnTo("//evil.com")).toBe("/dashboard");
    expect(sanitizeReturnTo("///evil.com")).toBe("/dashboard");
  });

  it("rejects backslash tricks and encoded scheme smuggling", () => {
    expect(sanitizeReturnTo("/\\evil.com")).toBe("/dashboard");
    expect(sanitizeReturnTo("/%2F%2Fevil.com")).toBe("/dashboard");
    expect(sanitizeReturnTo("/%68ttps://evil.com")).toBe("/dashboard");
  });

  it("rejects a path not starting with a single leading slash", () => {
    expect(sanitizeReturnTo("dashboard")).toBe("/dashboard");
    expect(sanitizeReturnTo("javascript:alert(1)")).toBe("/dashboard");
  });
});
