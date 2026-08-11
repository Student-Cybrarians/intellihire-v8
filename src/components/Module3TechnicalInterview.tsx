"use client";

import { useEffect, useState, type ChangeEvent } from "react";

export function Module3TechnicalInterview() {
  const [role, setRole] = useState("Software Engineer");
  const [session, setSession] = useState<any>(null);
  const [answer, setAnswer] = useState("");
  const [code, setCode] = useState("");
  const [evaluation, setEvaluation] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/technical/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Unable to start interview");
      setSession(data);
      setEvaluation(null);
      setAnswer("");
      setCode("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void start(); }, []);

  const submit = async () => {
    if (!session?.currentQuestion || !answer.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/technical/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId: session.id,
          questionId: session.currentQuestion.id,
          answerText: answer,
          code: code || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Unable to evaluate response");
      setEvaluation(data.evaluation);
      setSession(data.interview);
      setAnswer("");
      setCode("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    if (!session?.id || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/technical/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId: session.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Unable to complete interview");
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <main style={{ minHeight: "100vh", padding: 32, background: "var(--ih-bg)", color: "var(--ih-text)", fontFamily: "var(--ih-font-body)" }}>
        <div style={{ maxWidth: 1050, margin: "0 auto" }}>
          <div style={{ font: "600 .75rem var(--ih-font-mono)", color: "var(--ih-accent)", letterSpacing: ".12em" }}>MODULE 03 / TECHNICAL REPORT</div>
          <h1 style={{ fontFamily: "var(--ih-font-display)", fontSize: "clamp(2rem, 5vw, 3.5rem)" }}>Technical interview report</h1>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginTop: 24 }}>
            {[["Overall", result.overallScore], ["Correctness", result.correctness], ["Problem solving", result.problemSolving], ["Communication", result.communication]].map(([label, value]) => <div key={label as string} style={{ padding: 18, background: "var(--ih-surface)", border: "1px solid var(--ih-surface-border)", borderRadius: 14 }}><div style={{ color: "var(--ih-text-muted)", fontSize: 12 }}>{label}</div><div style={{ fontSize: "2rem", fontWeight: 800 }}>{value}</div></div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }}>
            <ReportPanel title="Strengths" items={result.strengths} />
            <ReportPanel title="Improvement areas" items={result.improvements} />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", padding: 32, background: "var(--ih-bg)", color: "var(--ih-text)", fontFamily: "var(--ih-font-body)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "end" }}>
          <div>
            <div style={{ font: "600 .75rem var(--ih-font-mono)", color: "var(--ih-accent)", letterSpacing: ".12em" }}>MODULE 03 / TECHNICAL INTERVIEW</div>
            <h1 style={{ fontFamily: "var(--ih-font-display)", fontSize: "clamp(2rem, 5vw, 3.5rem)", marginBottom: 8 }}>Think like an engineer.</h1>
            <p style={{ color: "var(--ih-text-muted)", maxWidth: 760, lineHeight: 1.6 }}>Practice technical reasoning, DSA, system design, and project trade-offs. Responses are evaluated by OpenRouter and persisted to your interview history.</p>
          </div>
          <div style={{ minWidth: 240 }}>
            <label style={{ display: "block", fontSize: 13, marginBottom: 7 }}>Target role</label>
            <input value={role} onChange={(e: ChangeEvent<HTMLInputElement>) => setRole(e.target.value)} disabled={busy || !!session?.answered} style={{ width: "100%", padding: ".8rem 1rem", borderRadius: 10, border: "1px solid var(--ih-surface-border)", background: "var(--ih-surface)", color: "inherit" }} />
          </div>
        </div>

        {error ? <div role="alert" style={{ marginTop: 20, padding: 14, borderRadius: 10, background: "#3d1313", border: "1px solid #7f2929" }}>{error}</div> : null}

        {session?.currentQuestion ? (
          <section style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 330px", gap: 20, marginTop: 28 }}>
            <div style={{ background: "var(--ih-surface)", border: "1px solid var(--ih-surface-border)", borderRadius: 18, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ih-text-muted)", fontSize: 13 }}><span>{session.currentQuestion.kind}</span><span>{session.answered} answered</span></div>
              <h2 style={{ lineHeight: 1.45, marginTop: 18 }}>{session.currentQuestion.prompt}</h2>
              <label style={{ display: "block", marginTop: 22, fontSize: 13 }}>Explain your approach</label>
              <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={9} placeholder="Walk through the approach, trade-offs, complexity, and edge cases…" style={{ marginTop: 8, width: "100%", resize: "vertical", padding: 14, borderRadius: 12, border: "1px solid var(--ih-surface-border)", background: "rgba(0,0,0,.15)", color: "inherit" }} />
              <label style={{ display: "block", marginTop: 18, fontSize: 13 }}>Optional code sample <span style={{ color: "var(--ih-text-muted)" }}>(review only; execution is isolated and not performed here)</span></label>
              <textarea value={code} onChange={(e) => setCode(e.target.value)} rows={10} placeholder="Paste the relevant implementation…" style={{ marginTop: 8, width: "100%", resize: "vertical", padding: 14, borderRadius: 12, border: "1px solid var(--ih-surface-border)", background: "#0b1020", color: "#d7e3ff", fontFamily: "var(--ih-font-mono)" }} />
              <button type="button" onClick={submit} disabled={!answer.trim() || busy} style={{ marginTop: 18, width: "100%", padding: ".9rem 1rem", borderRadius: 10, border: 0, background: "var(--ih-accent)", color: "var(--ih-accent-ink)", fontWeight: 800, opacity: !answer.trim() || busy ? .5 : 1 }}>{busy ? "Evaluating…" : "Submit response"}</button>
            </div>
            <aside style={{ display: "grid", gap: 14, alignContent: "start" }}>
              <div style={{ background: "var(--ih-surface)", border: "1px solid var(--ih-surface-border)", borderRadius: 16, padding: 18 }}><div style={{ font: "600 .7rem var(--ih-font-mono)", color: "var(--ih-accent)" }}>INTERVIEWER FEEDBACK</div>{evaluation ? <div style={{ marginTop: 12 }}><Metric label="Correctness" value={evaluation.correctness} /><Metric label="Problem solving" value={evaluation.problemSolving} /><Metric label="Communication" value={evaluation.communication} /><ul>{evaluation.improvements.map((x: string) => <li key={x}>{x}</li>)}</ul></div> : <p style={{ color: "var(--ih-text-muted)", lineHeight: 1.6 }}>Submit a response to receive evidence-based feedback.</p>}</div>
              <div style={{ background: "var(--ih-surface)", border: "1px solid var(--ih-surface-border)", borderRadius: 16, padding: 18 }}><div style={{ font: "600 .7rem var(--ih-font-mono)", color: "var(--ih-accent)" }}>SESSION</div><p style={{ marginBottom: 8 }}>Question {session.answered + 1} of {session.total}</p><button type="button" onClick={complete} disabled={busy || session.answered === 0} style={{ width: "100%", padding: ".75rem 1rem", borderRadius: 10, border: "1px solid var(--ih-surface-border)", background: "transparent", color: "inherit", opacity: busy || session.answered === 0 ? .5 : 1 }}>Finish interview</button></div>
            </aside>
          </section>
        ) : session ? <div style={{ marginTop: 28, padding: 22, borderRadius: 16, background: "var(--ih-surface)" }}>Loading next question…</div> : null}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div style={{ marginBottom: 10 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>{label}</span><strong>{value}</strong></div><div style={{ height: 6, marginTop: 5, borderRadius: 999, background: "rgba(255,255,255,.08)" }}><div style={{ width: `${value}%`, height: "100%", background: "var(--ih-accent)", borderRadius: 999 }} /></div></div>;
}

function ReportPanel({ title, items }: { title: string; items: string[] }) {
  return <div style={{ background: "var(--ih-surface)", border: "1px solid var(--ih-surface-border)", borderRadius: 16, padding: 18 }}><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}
