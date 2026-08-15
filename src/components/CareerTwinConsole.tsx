"use client";

import { useEffect, useState } from "react";

type SkillNode = { name: string; state: "evidenced" | "gap" | "transferable"; evidence: string[]; relevance: number };
type Twin = { targetRole: string | null; targetCompany: string | null; skillGraph: SkillNode[]; strengths: string[]; gaps: string[]; recommendations: string[]; confidence: number; mode: "ai" | "fallback"; createdAt?: string };

const panel: React.CSSProperties = { border: "1px solid var(--ih-surface-border)", borderRadius: 16, padding: "1.25rem", background: "var(--ih-surface)" };

export default function CareerTwinConsole() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [targetCompany, setTargetCompany] = useState("");
  const [twin, setTwin] = useState<Twin | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/career-twin", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const data = (await response.json()) as { twin?: Twin | null };
      if (data.twin) setTwin(data.twin);
    }).catch(() => undefined);
  }, []);

  async function build() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/career-twin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, jobDescription, targetRole, targetCompany }),
      });
      const data = (await response.json()) as { twin?: Twin; error?: string; message?: string };
      if (!response.ok || !data.twin) throw new Error(data.message ?? data.error ?? "Career Twin generation failed.");
      setTwin(data.twin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Career Twin generation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <section style={panel}>
        <h2 style={{ marginTop: 0 }}>Source evidence</h2>
        <p style={{ color: "var(--ih-text-muted)", lineHeight: 1.6 }}>Paste the same resume and target job description you use for Module 1. Raw text is processed server-side and is not persisted by the Career Twin store.</p>
        <div style={{ display: "grid", gap: ".75rem", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          <input aria-label="Target role" placeholder="Target role" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} style={inputStyle} maxLength={255} />
          <input aria-label="Target company" placeholder="Target company (optional)" value={targetCompany} onChange={(e) => setTargetCompany(e.target.value)} style={inputStyle} maxLength={255} />
        </div>
        <textarea aria-label="Resume" placeholder="Paste your resume text…" value={resumeText} onChange={(e) => setResumeText(e.target.value)} style={textAreaStyle} maxLength={30000} />
        <textarea aria-label="Job description" placeholder="Paste the target job description…" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} style={textAreaStyle} maxLength={20000} />
        <button type="button" onClick={build} disabled={busy || resumeText.trim().length < 100 || jobDescription.trim().length < 50} style={buttonStyle}>{busy ? "Building evidence graph…" : "Build Career Twin"}</button>
        {error && <p role="alert" style={{ color: "#ff6b8a" }}>{error}</p>}
      </section>

      {twin && (
        <section style={panel} aria-live="polite">
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between" }}>
            <div><p style={{ margin: 0, color: "var(--ih-accent)", font: "500 .7rem var(--ih-font-mono)", letterSpacing: ".12em" }}>PERSISTED SKILL GRAPH</p><h2 style={{ margin: ".35rem 0" }}>{twin.targetRole ?? "Target role"}{twin.targetCompany ? ` · ${twin.targetCompany}` : ""}</h2></div>
            <span style={{ color: "var(--ih-text-muted)" }}>Confidence {twin.confidence}% · {twin.mode === "ai" ? "AI enriched" : "deterministic fallback"}</span>
          </div>
          <div style={{ display: "grid", gap: ".75rem", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", marginTop: "1rem" }}>
            {(["evidenced", "gap", "transferable"] as const).map((state) => (
              <div key={state} style={{ border: "1px solid var(--ih-surface-border)", borderRadius: 12, padding: "1rem" }}>
                <strong style={{ textTransform: "capitalize" }}>{state}</strong>
                <ul>{twin.skillGraph.filter((skill) => skill.state === state).map((skill) => <li key={skill.name}>{skill.name} <small style={{ color: "var(--ih-text-muted)" }}>({skill.relevance}%)</small></li>)}</ul>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", marginTop: "1rem" }}>
            <Insight title="Strengths" items={twin.strengths} />
            <Insight title="Gaps" items={twin.gaps} />
            <Insight title="Next actions" items={twin.recommendations} />
          </div>
          <p style={{ color: "var(--ih-text-muted)", fontSize: ".85rem", marginBottom: 0 }}>The graph is career guidance evidence, not an autonomous employment decision.</p>
        </section>
      )}
    </div>
  );
}

function Insight({ title, items }: { title: string; items: string[] }) {
  return <div style={{ borderTop: "1px solid var(--ih-surface-border)", paddingTop: ".75rem" }}><h3>{title}</h3><ul>{items.length ? items.map((item) => <li key={item} style={{ marginBottom: ".5rem" }}>{item}</li>) : <li>No evidence yet.</li>}</ul></div>;
}

const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: ".8rem", borderRadius: 10, border: "1px solid var(--ih-surface-border)", background: "var(--ih-bg)", color: "var(--ih-text)" };
const textAreaStyle: React.CSSProperties = { ...inputStyle, minHeight: 180, marginTop: ".75rem", resize: "vertical" };
const buttonStyle: React.CSSProperties = { marginTop: ".75rem", padding: ".8rem 1.1rem", border: 0, borderRadius: 10, background: "var(--ih-accent)", color: "var(--ih-accent-ink)", fontWeight: 800, cursor: "pointer" };
