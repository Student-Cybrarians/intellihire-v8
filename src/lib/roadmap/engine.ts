import { createHash } from "crypto";
import { aiService } from "@/lib/ai/aiService";

export type SkillState = "evidenced" | "gap" | "transferable";
export type SkillNode = { name: string; state: SkillState; evidence: string[]; importance?: number };
export type RoadmapMilestone = {
  id: string;
  title: string;
  skill: string;
  objective: string;
  deliverables: string[];
  acceptanceCriteria: string[];
  estimatedHours: number;
  evidenceSource: "skill_gap" | "transferable";
};
export type RoadmapProject = {
  id: string;
  title: string;
  problem: string;
  skills: string[];
  deliverables: string[];
  acceptanceCriteria: string[];
  portfolioSignal: string;
  milestoneIds: string[];
};
export type RoadmapPlan = {
  targetRole: string | null;
  milestones: RoadmapMilestone[];
  projects: RoadmapProject[];
  confidence: number;
  integrity: { fabricatedEvidence: boolean; employmentDecision: boolean; source: "skill_graph" | "ai" };
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "skill";

export function fingerprintRoadmapInput(twin: { targetRole: string | null; skillGraph: SkillNode[] }): string {
  return createHash("sha256").update(JSON.stringify(twin)).digest("hex");
}

function deterministicPlan(targetRole: string | null, graph: SkillNode[]): RoadmapPlan {
  const gaps = graph.filter((x) => x.state === "gap").slice(0, 6);
  const transferable = graph.filter((x) => x.state === "transferable").slice(0, 3);
  const milestones = gaps.map((g, i) => ({
    id: `m-${i + 1}-${slug(g.name)}`,
    title: `Build ${g.name}`,
    skill: g.name,
    objective: `Develop demonstrable ${g.name} capability for ${targetRole || "the target role"}.`,
    deliverables: [`A focused ${g.name} implementation`, "A short technical write-up", "Evidence of validation or testing"],
    acceptanceCriteria: [`Demonstrates the core ${g.name} workflow`, "Includes reproducible validation", "Documents trade-offs and limitations"],
    estimatedHours: 8 + i * 4,
    evidenceSource: "skill_gap" as const,
  }));
  const skills = [...gaps, ...transferable].map((x) => x.name).slice(0, 5);
  const projects = skills.length ? [{
    id: "p-1",
    title: `${targetRole || "Target-role"} capability portfolio project`,
    problem: `Create a small production-shaped project that demonstrates ${skills.join(", ")}.`,
    skills,
    deliverables: ["Working repository", "README with architecture and decisions", "Automated tests", "Short demo or walkthrough"],
    acceptanceCriteria: ["Runs from documented setup steps", "Tests cover core behavior", "Limitations and security considerations are documented"],
    portfolioSignal: "A reviewer can inspect reproducible evidence of the targeted skills.",
    milestoneIds: milestones.slice(0, 4).map((m) => m.id),
  }] : [];
  return { targetRole, milestones, projects, confidence: clamp(0.55 + Math.min(gaps.length, 5) * 0.05, 0, 0.8), integrity: { fabricatedEvidence: false, employmentDecision: false, source: "skill_graph" } };
}

function parseAi(text: string, fallback: RoadmapPlan): RoadmapPlan | null {
  try {
    const raw = JSON.parse(text) as Partial<RoadmapPlan>;
    if (!Array.isArray(raw.milestones) || !Array.isArray(raw.projects)) return null;
    const plan = { ...fallback, ...raw, confidence: clamp(Number(raw.confidence ?? fallback.confidence), 0, 1), integrity: { fabricatedEvidence: false, employmentDecision: false, source: "ai" as const } };
    if (plan.milestones.length > 8 || plan.projects.length > 3) return null;
    return plan;
  } catch { return null; }
}

export async function buildRoadmap(params: { requesterId: string; targetRole: string | null; skillGraph: SkillNode[] }): Promise<{ plan: RoadmapPlan; mode: "ai" | "fallback"; model?: string; correlationId?: string }> {
  const fallback = deterministicPlan(params.targetRole, params.skillGraph);
  try {
    const context = JSON.stringify({ targetRole: params.targetRole, skillGraph: params.skillGraph }).slice(0, 18000);
    const response = await aiService.generate(params.requesterId, {
      capability: "reasoning",
      temperature: 0.2,
      maxTokens: 2200,
      systemPrompt: "Generate an evidence-scoped career roadmap. Never claim a candidate has a skill unless state=evidenced. Gaps are learning targets, not evidence. Return JSON only. Do not make hiring decisions.",
      prompt: `Using only this candidate skill graph, create up to 8 milestones and 3 portfolio projects. Each must have deliverables and acceptance criteria. Preserve skill state semantics.\n${context}`,
    });
    const parsed = parseAi(response.text, fallback);
    if (!parsed) throw new Error("Invalid roadmap response");
    return { plan: parsed, mode: "ai", model: response.model, correlationId: response.correlationId };
  } catch {
    return { plan: fallback, mode: "fallback" };
  }
}
