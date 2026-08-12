"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

const sections = ["quantitative", "logical", "verbal", "domain", "coding"] as const;

type AssessmentQuestion = { id: string; prompt: string; options: string[]; section: string };
type AssessmentAttempt = { id: string; answered: number; ability: number; currentQuestion?: AssessmentQuestion };
type AssessmentResult = { overallScore: number; accuracy: number; speedScore: number; sectionScores: Record<string, number>; strengths: string[]; recommendations: string[] };

export function Module2Assessment() {
  const [role, setRole] = useState("Software Engineer");
  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const begin = async () => {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/assessments/start", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ role }) });
      const data = (await response.json()) as AssessmentAttempt & { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "Unable to start assessment");
      setAttempt(data); setSelected(null); setStartedAt(Date.now());
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  useEffect(() => {
    // Defer the initial network action until after the mount commit. This avoids
    // a synchronous state update from the effect while still starting the
    // persisted assessment automatically for the user.
    const timer = window.setTimeout(() => { void begin(); }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const answered = attempt?.answered ?? 0;
  const progress = Math.min(100, Math.round((answered / 8) * 100));
  const currentSection = attempt?.currentQuestion?.section;
  const sectionLabel = useMemo(() => (currentSection ? currentSection.replace(/^./, (x) => x.toUpperCase()) : "Adaptive"), [currentSection]);

  const submitAnswer = async () => {
    if (!attempt?.currentQuestion || selected === null || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/assessments/answer", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ attemptId: attempt.id, questionId: attempt.currentQuestion.id, answerIndex: selected, responseMs: Date.now() - startedAt }) });
      const data = (await response.json()) as { state: AssessmentAttempt; error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "Unable to submit answer");
      setAttempt(data.state); setSelected(null); setStartedAt(Date.now());
      if (data.state.answered >= 8) {
        const done = await fetch("/api/assessments/complete", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ attemptId: attempt.id }) });
        const finalData = (await done.json()) as AssessmentResult & { error?: { message?: string } };
        if (!done.ok) throw new Error(finalData.error?.message ?? "Unable to complete assessment");
        setResult(finalData);
      }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <main style={{ minHeight: "100vh", padding: "2rem", background: "var(--ih-bg)", color: "var(--ih-text)", fontFamily: "var(--ih-font-body)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap", alignItems: "end" }}>
          <div><div style={{ font: "600 .75rem var(--ih-font-mono)", color: "var(--ih-accent)", letterSpacing: ".12em" }}>MODULE 02 / ADAPTIVE ASSESSMENT</div><h1 style={{ margin: ".4rem 0", fontSize: "clamp(2rem, 5vw, 3.6rem)", fontFamily: "var(--ih-font-display)" }}>Smart. Adaptive. Role-specific.</h1><p style={{ maxWidth: 720, color: "var(--ih-text-muted)", lineHeight: 1.65 }}>Questions adapt to your estimated ability using a 3PL-style probability model. Every response updates your ability estimate and is persisted for recovery.</p></div>
          <div style={{ minWidth: 240 }}><label style={{ display: "block", fontSize: 13, marginBottom: 7 }}>Target role</label><input value={role} onChange={(e) => setRole(e.target.value)} disabled={busy || !!result} style={{ width: "100%", padding: ".8rem 1rem", borderRadius: 10, border: "1px solid var(--ih-surface-border)", background: "var(--ih-surface)", color: "inherit" }} /></div>
        </div>
        {error ? <div role="alert" style={{ marginTop: 20, padding: 14, borderRadius: 10, background: "#3d1313", border: "1px solid #7f2929" }}>{error}</div> : null}
        {!result && attempt?.currentQuestion ? <section style={{ marginTop: 28, display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 20 }}>
          <div style={{ background: "var(--ih-surface)", border: "1px solid var(--ih-surface-border)", borderRadius: 18, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, color: "var(--ih-text-muted)" }}><span>Question {answered + 1} of 8 · {sectionLabel}</span><span>Ability {attempt.ability.toFixed(2)}</span></div>
            <div style={{ marginTop: 10, height: 7, borderRadius: 999, background: "rgba(255,255,255,.08)", overflow: "hidden" }}><div style={{ width: `${Math.max(5, progress)}%`, height: "100%", background: "var(--ih-accent)" }} /></div>
            <h2 style={{ fontSize: "1.45rem", lineHeight: 1.45, marginTop: 28 }}>{attempt.currentQuestion.prompt}</h2>
            <div style={{ display: "grid", gap: 10, marginTop: 22 }}>{attempt.currentQuestion.options.map((option, index) => <button key={`${attempt.currentQuestion?.id}-${index}`} type="button" onClick={() => setSelected(index)} style={{ textAlign: "left", padding: "1rem", borderRadius: 12, border: `1px solid ${selected === index ? "var(--ih-accent)" : "var(--ih-surface-border)"}`, background: selected === index ? "rgba(74,156,255,.12)" : "transparent", color: "inherit", cursor: "pointer" }}><strong>{String.fromCharCode(65 + index)}.</strong> {option}</button>)}</div>
            <button type="button" onClick={submitAnswer} disabled={selected === null || busy} style={{ marginTop: 22, width: "100%", padding: ".9rem 1rem", borderRadius: 10, border: 0, background: "var(--ih-accent)", color: "var(--ih-accent-ink)", fontWeight: 800, cursor: selected === null || busy ? "not-allowed" : "pointer", opacity: selected === null || busy ? .5 : 1 }}>{busy ? "Evaluating…" : "Submit answer"}</button>
          </div>
          <aside style={{ display: "grid", gap: 14 }}><div style={{ background: "var(--ih-surface)", border: "1px solid var(--ih-surface-border)", borderRadius: 16, padding: 18 }}><div style={{ font: "600 .7rem var(--ih-font-mono)", color: "var(--ih-accent)" }}>ADAPTIVE ENGINE</div><p style={{ color: "var(--ih-text-muted)", lineHeight: 1.55 }}>Difficulty is selected near your current ability estimate rather than from a random sequence.</p></div><div style={{ background: "var(--ih-surface)", border: "1px solid var(--ih-surface-border)", borderRadius: 16, padding: 18 }}><div style={{ font: "600 .7rem var(--ih-font-mono)", color: "var(--ih-accent)" }}>SECTIONS</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>{sections.map((section) => <span key={section} style={{ padding: ".55rem .7rem", borderRadius: 8, background: "rgba(255,255,255,.04)", fontSize: 12 }}>{section}</span>)}</div></div></aside>
        </section> : null}
        {result ? <section style={{ marginTop: 28, display: "grid", gap: 18 }}><div style={{ background: "var(--ih-surface)", border: "1px solid var(--ih-surface-border)", borderRadius: 18, padding: 26 }}><div style={{ font: "600 .7rem var(--ih-font-mono)", color: "var(--ih-accent)" }}>ASSESSMENT REPORT</div><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginTop: 16 }}>{[["Overall", result.overallScore], ["Accuracy", result.accuracy], ["Speed", result.speedScore]].map(([label, value]) => <div key={label as string} style={{ padding: 18, borderRadius: 12, background: "rgba(255,255,255,.04)" }}><div style={{ color: "var(--ih-text-muted)", fontSize: 12 }}>{label}</div><div style={{ fontSize: "2.2rem", fontWeight: 800, marginTop: 6 }}>{value}<span style={{ fontSize: 14, color: "var(--ih-text-muted)" }}>/100</span></div></div>)}</div></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}><Panel title="Section scores"><pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--ih-text-muted)" }}>{JSON.stringify(result.sectionScores, null, 2)}</pre></Panel><Panel title="Strengths"><ul>{result.strengths.map((x) => <li key={x}>{x}</li>)}</ul></Panel><Panel title="Next steps"><ul>{result.recommendations.map((x) => <li key={x}>{x}</li>)}</ul></Panel></div></section> : null}
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) { return <div style={{ background: "var(--ih-surface)", border: "1px solid var(--ih-surface-border)", borderRadius: 16, padding: 18 }}><h3 style={{ marginTop: 0 }}>{title}</h3><div style={{ color: "var(--ih-text-muted)", lineHeight: 1.6 }}>{children}</div></div>; }
