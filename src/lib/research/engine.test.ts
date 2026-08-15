import { describe, expect, it, vi } from "vitest";
import { buildResearchBrief } from "@/lib/research/engine";

vi.mock("@/db/repositories/careerTwin", () => ({ getLatestCareerTwin: vi.fn(async () => ({ targetRole: "Security Engineer", gaps: ["Kubernetes"], skillGraph: [{ name: "Python", state: "evidenced", relevance: 90 }, { name: "Kubernetes", state: "gap", relevance: 95 }] })) }));
vi.mock("@/lib/ai/aiService", () => ({ aiService: { analyzeText: vi.fn() } }));

describe("research engine", () => {
  it("does not fabricate evidence when retrieval is unavailable", async () => {
    delete process.env.TAVILY_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.NVIDIA_API_KEY;
    const result = await buildResearchBrief("00000000-0000-0000-0000-000000000000", "What should I learn for cloud security?");
    expect(result.mode).toBe("fallback");
    expect(result.brief.sources).toHaveLength(0);
    expect(result.brief.synthesis).toContain("Insufficient external evidence");
  });

  it("keeps only valid HTTP(S) source URLs", async () => {
    process.env.TAVILY_API_KEY = "test";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ results: [
      { title: "Good", url: "https://example.com/good", content: "evidence", score: 0.9 },
      { title: "Bad", url: "javascript:alert(1)", content: "bad", score: 1 },
      { title: "Duplicate", url: "https://example.com/good", content: "duplicate", score: 0.8 },
    ] }), { status: 200, headers: { "content-type": "application/json" } }));
    const result = await buildResearchBrief("00000000-0000-0000-0000-000000000000", "What should I learn for cloud security?");
    expect(result.brief.sources.map((s) => s.url)).toEqual(["https://example.com/good"]);
    fetchMock.mockRestore();
    delete process.env.TAVILY_API_KEY;
  });
});
