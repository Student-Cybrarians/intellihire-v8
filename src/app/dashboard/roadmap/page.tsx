"use client";
import { useEffect, useState } from "react";

type Roadmap = { targetRole: string | null; confidence: number; milestones: { id: string; title: string; skill: string; objective: string; deliverables: string[]; acceptanceCriteria: string[]; estimatedHours: number }[]; projects: { id: string; title: string; problem: string; skills: string[]; deliverables: string[]; acceptanceCriteria: string[]; portfolioSignal: string }[]; integrity: { fabricatedEvidence: boolean; employmentDecision: boolean; source: string } };

export default function RoadmapPage() {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  async function load() { const r = await fetch("/api/roadmap", { cache: "no-store" }); const d = await r.json(); if (r.ok) setRoadmap(d.roadmap); else setError(d.message || "Unable to load roadmap."); setLoading(false); }
  async function generate() { setGenerating(true); setError(""); const r = await fetch("/api/roadmap", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); const d = await r.json(); if (r.ok) setRoadmap(d.roadmap); else setError(d.message || "Roadmap generation failed."); setGenerating(false); }
  useEffect(() => { void load(); }, []);
  return <main style={{ maxWidth: 1000, margin: "0 auto", padding: 32, fontFamily: "system-ui" }}>
    <p><a href="/dashboard">← Dashboard</a></p><h1>Roadmap & Projects</h1><p>Turn evidenced skill gaps into measurable learning milestones and portfolio evidence.</p>
    <button onClick={() => void generate()} disabled={generating}>{generating ? "Generating…" : roadmap ? "Regenerate roadmap" : "Generate roadmap"}</button>
    {error && <p role="alert">{error}</p>}
    {loading && <p>Loading…</p>}
    {roadmap && <><p>Target: <strong>{roadmap.targetRole || "Target role"}</strong> · Confidence {(roadmap.confidence * 100).toFixed(0)}% · Source: {roadmap.integrity.source}</p>
      <section><h2>Milestones</h2>{roadmap.milestones.map(m => <article key={m.id} style={{ padding: 20, margin: "12px 0", border: "1px solid #ddd", borderRadius: 12 }}><h3>{m.title}</h3><p><strong>Skill:</strong> {m.skill} · {m.estimatedHours}h</p><p>{m.objective}</p><strong>Deliverables</strong><ul>{m.deliverables.map(x => <li key={x}>{x}</li>)}</ul><strong>Acceptance</strong><ul>{m.acceptanceCriteria.map(x => <li key={x}>{x}</li>)}</ul></article>)}</section>
      <section><h2>Portfolio projects</h2>{roadmap.projects.map(p => <article key={p.id} style={{ padding: 20, margin: "12px 0", border: "1px solid #ddd", borderRadius: 12 }}><h3>{p.title}</h3><p>{p.problem}</p><p><strong>Skills:</strong> {p.skills.join(", ")}</p><p><strong>Portfolio signal:</strong> {p.portfolioSignal}</p><strong>Deliverables</strong><ul>{p.deliverables.map(x => <li key={x}>{x}</li>)}</ul><strong>Acceptance</strong><ul>{p.acceptanceCriteria.map(x => <li key={x}>{x}</li>)}</ul></article>)}</section>
    </>}
  </main>;
}
