"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

const sections = ["quantitative", "logical", "verbal", "domain", "coding"] as const;

type AssessmentQuestion = { id: string; prompt: string; options: string[]; section: string };
type AssessmentAttempt = { id: string; answered: number; ability: number; currentQuestion?: AssessmentQuestion | null };
type AssessmentResult = {
  overallScore: number;
  accuracy: number;
  speedScore: number;
  sectionScores: Record<string, number>;
  strengths: string[];
  weaknesses?: string[];
  recommendations: string[];
};
type Feedback = { correct: boolean; explanation: string };

export function Module2Assessment() {
  const [role, setRole] = useState("Software Engineer");
  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const begin = async () => {
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch("/api/assessments/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: role.trim() || "Software Engineer" }),
      });
      const data = (await response.json()) as AssessmentAttempt & { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "Unable to start assessment");
      setAttempt(data);
      setSelected(null);
      setStartedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start assessment");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void begin(); }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const answered = attempt?.answered ?? 0;
  const progress = Math.min(100, Math.round((answered / 8) * 100));
  const currentSection = attempt?.currentQuestion?.section;
  const sectionLabel = useMemo(
    () => (currentSection ? currentSection.replace(/^./, (x) => x.toUpperCase()) : "Adaptive"),
    [currentSection],
  );

  const submitAnswer = async () => {
    if (!attempt?.currentQuestion || selected === null || busy) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch("/api/assessments/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          attemptId: attempt.id,
          questionId: attempt.currentQuestion.id,
          answerIndex: selected,
          responseMs: Math.max(0, Date.now() - startedAt),
        }),
      });
      const data = (await response.json()) as {
        state: AssessmentAttempt;
        correct: boolean;
        explanation: string;
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(data.error?.message ?? "Unable to submit answer");
      setFeedback({ correct: data.correct, explanation: data.explanation });
      setAttempt(data.state);
      setSelected(null);
      setStartedAt(Date.now());

      if (data.state.answered >= 8) {
        const done = await fetch("/api/assessments/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ attemptId: attempt.id }),
        });
        const finalData = (await done.json()) as AssessmentResult & { error?: { message?: string } };
        if (!done.ok) throw new Error(finalData.error?.message ?? "Unable to complete assessment");
        setResult(finalData);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to submit answer");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", padding: "clamp(1rem, 4vw, 2rem)", background: "var(--ih-bg)", color: "var(--ih-text)", fontFamily: "var(--ih-font-body)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap", alignItems: "end" }}>
          <div style={{ flex: "1 1 560px" }}>
            <div style={{ font: "600 .75rem var(--ih-font-mono)", color: "var(--ih-accent)", letterSpacing: ".12em" }}>MODULE 02 / ADAPTIVE ASSESSMENT</div>
            <h1 style={{ margin: ".4rem 0", fontSize: "clamp(2rem, 5vw, 3.6rem)", fontFamily: "var(--ih-font-display)" }}>Smart. Adaptive. Role-specific.</h1>
            <p style={{ maxWidth: 720, color: "var(--ih-text-muted)", lineHeight: 1.65 }}>Questions adapt to your estimated ability using a 3PL-style probability model. Every response is persisted so an in-progress assessment can recover after a refresh.</p>
          </div>
          <div style={{ flex: "1 1 240px", maxWidth: 320 }}>
            <label htmlFor="target-role" style={{ display: "block", fontSize: 13, marginBottom: 7 }}>Target role</label>
            <input id="target-role" value={role} onChange={(e) => setRole(e.target.value)} disabled={busy || !!attempt?.currentQuestion || !!result} maxLength={255} style={{ width: "100%", boxSizing: "border-box", padding: ".8rem 1rem", borderRadius: 10, border: "1px solid var(--ih-surface-border)", background: "var(--ih-surface)", color: "inherit" }} />
          </div>
        </div>

        {error ? (
          <div role="alert" style={{ marginTop: 20, padding: 14, borderRadius: 10, background: "#3d1313", border: "1px solid #7f2929" }}>
            <div>{error}</div>
            {!attempt?.currentQuestion && !result ? <button type="button" onClick={() => void begin()} disabled={busy} style={{ marginTop: 10, padding: ".6rem .9rem", borderRadius: 8, border: "1px solid var(--ih-surface-border)", background: "var(--ih-surface)", color: "inherit", cursor: "pointer" }}>{busy ? "Retrying…" : "Retry assessment"}</button> : null}
          </div>
        ) : null}

        {!result && !attempt?.currentQuestion && !error ? (
          <div style={{ marginTop: 28, padding: 24, borderRadius: 16, background: "var(--ih-surface)", border: "1px solid var(--ih-surface-border)" }}>
            <strong>{busy ? "Preparing your assessment…" : "Assessment ready"}</strong>
            <p style={{ color: "var(--ih-text-muted)" }}>Your first question is selected from the persisted question bank and will adapt after every answer.</p>
          </div>
        ) : null}

        {!result && attempt?.currentQuestion ? (
          <section style={{ marginTop: 28, display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 20 }}>
            <div style={{ background: "var(--ih-surface)", border: "1px solid var(--ih-surface-border)", borderRadius: 18, padding: "clamp(18px, 4vw, 24px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, color: "var(--ih-text-muted)" }}><span>Question {answered + 1} of 8 · {sectionLabel}</span><span>Ability {attempt.ability.toFixed(2)}</span></div>
              <div aria-label={`Assessment progress ${progress}%`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} style={{ marginTop: 10, height: 7, borderRadius: 999, background: "rgba(255,255,255,.08)", overflow: "hidden" }}><div style={{ width: `${Math.max(5, progress)}%`, height: "100%", background: "var(--ih-accent)" }} /></div>
              <h2 style={{ fontSize: "1.45rem", lineHeight: 1.45, marginTop: 28 }}>{attempt.currentQuestion.prompt}</h2>
              <div style={{ display: "grid", gap: 10, marginTop: 22 }}>
                {attempt.currentQuestion.options.map((option, index) => (
                  <button key={`${attempt.currentQuestion?.id}-${index}`} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)} disabled={busy} style={{ textAlign: "left", padding: "1rem", borderRadius: 12, border: `1px solid ${selected === index ? "var(--ih-accent)" : "var(--ih-surface-border)"}`, background: selected === index ? "rgba(74,156,255,.12)" : "transparent", color: "inherit", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? .7 : 1 }}><strong>{String.fromCharCode(65 + index)}.</strong> {option}</button>
                ))}
              </div>
              {feedback ? <div role="status" style={{ marginTop: 18, padding: 14, borderRadius: 10, border: "1px solid var(--ih-surface-border)", background: "rgba(255,255,255,.03)" }}><strong>{feedback.correct ? "Correct" : "Not quite"}</strong><div style={{ marginTop: 5, color: "var(--ih-text-muted)" }}>{feedback.explanation}</div></div> : null}
              <button type="button" onClick={submitAnswer} disabled={selected === null || busy} style={{ marginTop: 22, width: "100%", padding: ".9rem 1rem", borderRadius: 10, border: 0, background: "var(--ih-accent)", color: "var(--ih-accent-ink)", fontWeight: 800, cursor: selected === null || busy ? "not-allowed" : "pointer", opacity: selected === null || busy ? .5 : 1 }}>{busy ? "Evaluating…" : answered >= 7 ? "Finish assessment" : "Submit answer"}</button>
            </div>
            <aside style={{ display: "grid", gap: 14 }}>
              <Panel title="ADAPTIVE ENGINE"><p>Difficulty is selected near your current ability estimate rather than from a random sequence.</p></Panel>
              <Panel title="SECTIONS"><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{sections.map((section) => <span key={section} style={{ padding: ".55rem .7rem", borderRadius: 8, background: "rgba(255,255,255,.04)", fontSize: 12 }}>{section}</span>)}</div></Panel>
            </aside>
          </section>
        ) : null}

        {result ? (
          <section style={{ marginTop: 28, display: "grid", gap: 18 }}>
            <div style={{ background: "var(--ih-surface)", border: "1px solid var(--ih-surface-border)", borderRadius: 18, padding: "clamp(18px, 4vw, 26px)" }}>
              <div style={{ font: "600 .7rem var(--ih-font-mono)", color: "var(--ih-accent)" }}>ASSESSMENT REPORT</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginTop: 16 }}>{[["Overall", result.overallScore], ["Accuracy", result.accuracy], ["Speed", result.speedScore]].map(([label, value]) => <div key={label as string} style={{ padding: 18, borderRadius: 12, background: "rgba(255,255,255,.04)" }}><div style={{ color: "var(--ih-text-muted)", fontSize: 12 }}>{label}</div><div style={{ fontSize: "2.2rem", fontWeight: 800, marginTop: 6 }}>{value}<span style={{ fontSize: 14, color: "var(--ih-text-muted)" }}>/100</span></div></div>)}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 18 }}>
              <Panel title="Section scores"><pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--ih-text-muted)" }}>{JSON.stringify(result.sectionScores, null, 2)}</pre></Panel>
              <Panel title="Strengths"><ul>{result.strengths.map((x) => <li key={x}>{x}</li>)}</ul></Panel>
              <Panel title="Next steps"><ul>{result.recommendations.map((x) => <li key={x}>{x}</li>)}</ul></Panel>
            </div>
            {result.weaknesses?.length ? <Panel title="Focus areas"><ul>{result.weaknesses.map((x) => <li key={x}>{x}</li>)}</ul></Panel> : null}
            <button type="button" onClick={() => { setAttempt(null); setResult(null); setFeedback(null); setError(null); setSelected(null); }} style={{ justifySelf: "start", padding: ".75rem 1rem", borderRadius: 10, border: "1px solid var(--ih-surface-border)", background: "var(--ih-surface)", color: "inherit", cursor: "pointer" }}>Start another assessment</button>
          </section>
        ) : null}
      </div>
      <style>{`@media (max-width: 820px) { main section { grid-template-columns: 1fr !important; } }`}</style>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <div style={{ background: "var(--ih-surface)", border: "1px solid var(--ih-surface-border)", borderRadius: 16, padding: 18 }}><h3 style={{ marginTop: 0 }}>{title}</h3><div style={{ color: "var(--ih-text-muted)", lineHeight: 1.6 }}>{children}</div></div>;
}
