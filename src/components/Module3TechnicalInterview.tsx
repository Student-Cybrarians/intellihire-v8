"use client";

import { useEffect, useState, type ChangeEvent } from "react";

type TechnicalQuestion = { id: string; kind: string; prompt: string };
type TechnicalSession = { id: string; role?: string | null; status: string; answered: number; total: number; currentQuestion?: TechnicalQuestion | null };
type TechnicalEvaluation = { correctness: number; codeQuality: number; problemSolving: number; communication: number; strengths: string[]; improvements: string[] };
type TechnicalResult = { overallScore: number; correctness: number; codeQuality: number; problemSolving: number; communication: number; strengths: string[]; improvements: string[]; recommendations: string[] };
type HistoryItem = { id: string; role: string | null; status: string; startedAt: string; completedAt: string | null; result: { overallScore: number; correctness: number; codeQuality: number; problemSolving: number; communication: number } | null };

async function readError(response: Response, fallback: string) {
  try {
    const data = await response.json() as { error?: { message?: string } };
    return data.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

export function Module3TechnicalInterview() {
  const [role, setRole] = useState("Software Engineer");
  const [session, setSession] = useState<TechnicalSession | null>(null);
  const [answer, setAnswer] = useState("");
  const [code, setCode] = useState("");
  const [evaluation, setEvaluation] = useState<TechnicalEvaluation | null>(null);
  const [result, setResult] = useState<TechnicalResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch("/api/technical/history", { credentials: "include", cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { interviews: HistoryItem[] };
      setHistory(data.interviews ?? []);
    } finally {
      setLoadingHistory(false);
    }
  };

  const start = async () => {
    setBusy(true); setError(null); setResult(null); setEvaluation(null);
    try {
      const response = await fetch("/api/technical/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      if (!response.ok) throw new Error(await readError(response, "Unable to start interview"));
      const data = await response.json() as TechnicalSession;
      setSession(data); setAnswer(""); setCode("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void start(); void loadHistory(); }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!session?.currentQuestion || !answer.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/technical/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ interviewId: session.id, questionId: session.currentQuestion.id, answerText: answer, code: code || null }),
      });
      if (!response.ok) throw new Error(await readError(response, "Unable to evaluate response"));
      const data = await response.json() as { evaluation: TechnicalEvaluation; interview: TechnicalSession };
      setEvaluation(data.evaluation); setSession(data.interview); setAnswer(""); setCode("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    if (!session?.id || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/technical/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ interviewId: session.id }),
      });
      if (!response.ok) throw new Error(await readError(response, "Unable to complete interview"));
      const data = await response.json() as TechnicalResult;
      setResult(data); setSession((current) => current ? { ...current, status: "COMPLETED" } : current);
      await loadHistory();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const current = session?.currentQuestion ?? null;

  if (result) return <main style={pageStyle}><div style={containerStyle}>
    <div style={eyebrow}>MODULE 03 / TECHNICAL REPORT</div>
    <h1 style={heading}>Technical interview report</h1>
    <p style={muted}>Your result is based on the four completed responses. AI feedback is coaching evidence, not a hiring decision.</p>
    <div style={scoreGrid}>{[["Overall", result.overallScore], ["Correctness", result.correctness], ["Code quality", result.codeQuality], ["Problem solving", result.problemSolving], ["Communication", result.communication]].map(([label, value]) => <div key={label as string} style={cardStyle}><div style={smallLabel}>{label}</div><div style={score}>{value}</div></div>)}</div>
    <div style={twoCol}><ReportPanel title="Strengths" items={result.strengths} /><ReportPanel title="Improvement areas" items={result.improvements} /><ReportPanel title="Recommendations" items={result.recommendations} /></div>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}><button type="button" onClick={start} style={primaryButton}>Start another interview</button><button type="button" onClick={() => { setResult(null); void loadHistory(); }} style={secondaryButton}>View history</button></div>
  </div></main>;

  return <main style={pageStyle}><div style={containerStyle}>
    <div style={headerStyle}><div><div style={eyebrow}>MODULE 03 / TECHNICAL INTERVIEW</div><h1 style={heading}>Think like an engineer.</h1><p style={muted}>Practice technical reasoning, DSA, system design, and project trade-offs. Each response is persisted and evaluated through IntelliHire&apos;s server-side AI abstraction.</p></div><div style={{ minWidth: 240 }}><label style={smallLabel}>Target role</label><input value={role} onChange={(e: ChangeEvent<HTMLInputElement>) => setRole(e.target.value)} disabled={busy || !!session?.answered} style={inputStyle} maxLength={255} /></div></div>
    {error ? <div role="alert" style={errorStyle}>{error}</div> : null}

    {session && current ? <section style={twoColWide}><div style={cardStyle}><div style={questionMeta}><span>{current.kind}</span><span>{session.answered} / {session.total} answered</span></div><div style={{ height: 6, background: "rgba(255,255,255,.08)", borderRadius: 999, marginTop: 12 }}><div style={{ width: `${Math.min(100, (session.answered / session.total) * 100)}%`, height: "100%", background: "var(--ih-accent)", borderRadius: 999 }} /></div><h2 style={{ lineHeight: 1.45, marginTop: 22 }}>{current.prompt}</h2><label style={labelStyle}>Explain your approach</label><textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={9} maxLength={10000} placeholder="Walk through assumptions, approach, trade-offs, complexity, and edge cases…" style={textareaStyle} /><div style={charCount}>{answer.length}/10000</div><label style={labelStyle}>Optional code sample <span style={muted}>— reviewed only; never executed by IntelliHire</span></label><textarea value={code} onChange={(e) => setCode(e.target.value)} rows={10} maxLength={20000} placeholder="Paste the relevant implementation…" style={{ ...textareaStyle, background: "#0b1020", color: "#d7e3ff", fontFamily: "var(--ih-font-mono)" }} /><button type="button" onClick={submit} disabled={!answer.trim() || busy} style={{ ...primaryButton, width: "100%", opacity: !answer.trim() || busy ? .5 : 1 }}>{busy ? "Evaluating…" : "Submit response"}</button></div><aside style={{ display: "grid", gap: 14, alignContent: "start" }}><div style={cardStyle}><div style={eyebrow}>INTERVIEWER FEEDBACK</div>{evaluation ? <div style={{ marginTop: 14 }}><Metric label="Correctness" value={evaluation.correctness} /><Metric label="Code quality" value={evaluation.codeQuality} /><Metric label="Problem solving" value={evaluation.problemSolving} /><Metric label="Communication" value={evaluation.communication} /><List title="What went well" items={evaluation.strengths} /><List title="Improve next" items={evaluation.improvements} /></div> : <p style={muted}>Submit a response to receive evidence-based feedback.</p>}</div><div style={cardStyle}><div style={eyebrow}>SESSION</div><p>Question {session.answered + 1} of {session.total}</p><button type="button" onClick={complete} disabled={busy || session.answered !== session.total} style={{ ...secondaryButton, width: "100%", opacity: busy || session.answered !== session.total ? .5 : 1 }}>{busy ? "Finishing…" : "Finish interview"}</button><p style={{ ...muted, fontSize: 12, marginTop: 10 }}>Finish becomes available only after every question has been answered.</p></div></aside></section> : session && session.answered === session.total ? <section style={cardStyle}><div style={eyebrow}>READY TO FINISH</div><h2>All questions answered.</h2><p style={muted}>Review the last feedback panel, then generate your final report.</p><button type="button" onClick={complete} disabled={busy} style={primaryButton}>{busy ? "Generating report…" : "Generate interview report"}</button></section> : session ? <section style={cardStyle}>Loading next question…</section> : null}

    <section style={{ marginTop: 36 }}><div style={eyebrow}>HISTORY</div><h2 style={{ marginTop: 8 }}>Your technical interviews</h2>{loadingHistory ? <p style={muted}>Loading history…</p> : history.length === 0 ? <p style={muted}>No completed interviews yet.</p> : <div style={{ display: "grid", gap: 10 }}>{history.slice(0, 8).map((item) => <div key={item.id} style={{ ...cardStyle, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}><div><strong>{item.role || "Software Engineer"}</strong><div style={muted}>{new Date(item.startedAt).toLocaleString()} · {item.status}</div></div>{item.result ? <strong>{item.result.overallScore}/100</strong> : <span style={muted}>In progress</span>}</div>)}</div>}</section>
  </div></main>;
}

const pageStyle: React.CSSProperties = { minHeight: "100vh", padding: 32, background: "var(--ih-bg)", color: "var(--ih-text)", fontFamily: "var(--ih-font-body)" };
const containerStyle: React.CSSProperties = { maxWidth: 1100, margin: "0 auto" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap", alignItems: "end" };
const heading: React.CSSProperties = { fontFamily: "var(--ih-font-display)", fontSize: "clamp(2rem, 5vw, 3.5rem)", margin: "8px 0" };
const eyebrow: React.CSSProperties = { font: "600 .72rem var(--ih-font-mono)", color: "var(--ih-accent)", letterSpacing: ".12em" };
const muted: React.CSSProperties = { color: "var(--ih-text-muted)", lineHeight: 1.6 };
const cardStyle: React.CSSProperties = { padding: 20, background: "var(--ih-surface)", border: "1px solid var(--ih-surface-border)", borderRadius: 16 };
const scoreGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginTop: 24 };
const twoCol: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16, marginTop: 18 };
const twoColWide: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(280px,330px)", gap: 18, marginTop: 28 };
const score: React.CSSProperties = { fontSize: "2rem", fontWeight: 800, marginTop: 4 };
const smallLabel: React.CSSProperties = { color: "var(--ih-text-muted)", fontSize: 12 };
const labelStyle: React.CSSProperties = { display: "block", marginTop: 20, fontSize: 13 };
const questionMeta: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, color: "var(--ih-text-muted)", fontSize: 13 };
const inputStyle: React.CSSProperties = { width: "100%", marginTop: 7, padding: ".8rem 1rem", borderRadius: 10, border: "1px solid var(--ih-surface-border)", background: "var(--ih-surface)", color: "inherit" };
const textareaStyle: React.CSSProperties = { marginTop: 8, width: "100%", resize: "vertical", padding: 14, borderRadius: 12, border: "1px solid var(--ih-surface-border)", background: "rgba(0,0,0,.15)", color: "inherit", boxSizing: "border-box" };
const primaryButton: React.CSSProperties = { padding: ".85rem 1.1rem", borderRadius: 10, border: 0, background: "var(--ih-accent)", color: "var(--ih-accent-ink)", fontWeight: 800, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { padding: ".8rem 1rem", borderRadius: 10, border: "1px solid var(--ih-surface-border)", background: "transparent", color: "inherit", fontWeight: 700, cursor: "pointer" };
const errorStyle: React.CSSProperties = { marginTop: 20, padding: 14, borderRadius: 10, background: "#3d1313", border: "1px solid #7f2929" };
const charCount: React.CSSProperties = { textAlign: "right", color: "var(--ih-text-muted)", fontSize: 11, marginTop: 4 };

function Metric({ label, value }: { label: string; value: number }) { return <div style={{ marginBottom: 10 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>{label}</span><strong>{value}</strong></div><div style={{ height: 6, marginTop: 5, borderRadius: 999, background: "rgba(255,255,255,.08)" }}><div style={{ width: `${value}%`, height: "100%", background: "var(--ih-accent)", borderRadius: 999 }} /></div></div>; }
function List({ title, items }: { title: string; items: string[] }) { return <div style={{ marginTop: 16 }}><strong>{title}</strong><ul>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>; }
function ReportPanel({ title, items }: { title: string; items: string[] }) { return <div style={cardStyle}><h3>{title}</h3><List title="" items={items} /></div>; }
