"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Interview = {
  id: string; role: string | null; company: string | null; status: string; answered: number; total: number;
  currentQuestion: { id: string; category: string; prompt: string; sequenceNo: number } | null;
};
type Evaluation = { communication: number; behavioral: number; relevance: number; structure: number; strengths: string[]; improvements: string[] };
type Result = Evaluation & { overallScore: number; recommendations: string[] };
type HistoryItem = { id: string; role: string | null; company: string | null; status: string; startedAt: string; result: { overallScore: number } | null };

type SpeechRecognitionLike = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };

declare global { interface Window { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike; } }

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message ?? "Request failed");
  return data as T;
}

const card: React.CSSProperties = { border: "1px solid var(--ih-surface-border)", borderRadius: 16, padding: "1.25rem", background: "var(--ih-surface)" };
const button: React.CSSProperties = { border: 0, borderRadius: 10, padding: ".8rem 1.05rem", background: "var(--ih-accent)", color: "var(--ih-accent-ink)", fontWeight: 800, cursor: "pointer" };

export default function Module4Page() {
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [interview, setInterview] = useState<Interview | null>(null);
  const [answer, setAnswer] = useState("");
  const [lastEvaluation, setLastEvaluation] = useState<Evaluation | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");

  async function loadHistory() {
    try { const data = await api<{ interviews: HistoryItem[] }>("/api/hr/history"); setHistory(data.interviews); } catch { /* history is secondary to the active workflow */ }
  }
  useEffect(() => { void loadHistory(); }, []);

  async function start() {
    setBusy(true); setError(""); setResult(null); setLastEvaluation(null);
    try { setInterview(await api<Interview>("/api/hr/start", { method: "POST", body: JSON.stringify({ role: role || null, company: company || null }) })); setAnswer(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to start interview"); }
    finally { setBusy(false); }
  }

  async function submitAnswer() {
    if (!interview?.currentQuestion) return;
    setBusy(true); setError("");
    try {
      const data = await api<{ evaluation: Evaluation; interview: Interview }>("/api/hr/answer", { method: "POST", body: JSON.stringify({ interviewId: interview.id, questionId: interview.currentQuestion.id, answer }) });
      setLastEvaluation(data.evaluation); setInterview(data.interview); setAnswer("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to submit answer"); }
    finally { setBusy(false); }
  }

  async function finish() {
    if (!interview) return;
    setBusy(true); setError("");
    try { setResult(await api<Result>("/api/hr/complete", { method: "POST", body: JSON.stringify({ interviewId: interview.id }) })); setInterview(null); await loadHistory(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to finish interview"); }
    finally { setBusy(false); }
  }

  function toggleSpeech() {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) { setError("Speech-to-text is not supported by this browser. You can type your answer instead."); return; }
    if (listening) { setListening(false); return; }
    const recognition = new Recognition();
    recognition.lang = "en-US"; recognition.interimResults = true; recognition.continuous = true;
    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) text += event.results[i][0]?.transcript ?? "";
      setAnswer(text.trim());
    };
    recognition.onerror = () => { setListening(false); setError("Microphone transcription failed. Check browser microphone permission or type your answer."); };
    recognition.onend = () => setListening(false);
    recognition.start(); setListening(true);
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--ih-bg)", color: "var(--ih-text)", padding: "2rem", fontFamily: "var(--ih-font-body)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <Link href="/dashboard" style={{ color: "var(--ih-accent)", textDecoration: "none", fontWeight: 700 }}>← Dashboard</Link>
        <header style={{ margin: "1.5rem 0 2rem" }}>
          <p style={{ margin: 0, font: ".72rem var(--ih-font-mono)", letterSpacing: ".12em", color: "var(--ih-accent)" }}>MODULE 04 / HR INTERVIEW</p>
          <h1 style={{ margin: ".4rem 0", fontFamily: "var(--ih-font-display)", fontSize: "clamp(2rem,5vw,3.5rem)" }}>Real-Time HR Interview</h1>
          <p style={{ color: "var(--ih-text-muted)", maxWidth: 760, lineHeight: 1.65 }}>Practice behavioral and motivation questions, receive evidence-based coaching after each answer, and finish with a scored interview report. Speech-to-text is optional.</p>
        </header>

        {error && <div role="alert" style={{ ...card, borderColor: "var(--ih-danger, #c95d5d)", marginBottom: "1rem" }}>{error}</div>}

        {!interview && !result && <section style={card}>
          <h2 style={{ marginTop: 0 }}>Start a practice interview</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "1rem" }}>
            <label>Target role<input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Software Engineer" style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: ".4rem", padding: ".8rem", borderRadius: 10, border: "1px solid var(--ih-surface-border)", background: "var(--ih-bg)", color: "inherit" }} /></label>
            <label>Company (optional)<input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Accenture" style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: ".4rem", padding: ".8rem", borderRadius: 10, border: "1px solid var(--ih-surface-border)", background: "var(--ih-bg)", color: "inherit" }} /></label>
          </div>
          <button disabled={busy} onClick={start} style={{ ...button, marginTop: "1rem", opacity: busy ? .6 : 1 }}>{busy ? "Starting…" : "Start HR Interview →"}</button>
        </section>}

        {interview && <section style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}><div><strong>{interview.role || "General HR practice"}</strong>{interview.company ? ` · ${interview.company}` : ""}</div><span>{interview.answered} / {interview.total} answered</span></div>
          {interview.currentQuestion ? <>
            <div style={{ margin: "2rem 0 1rem", color: "var(--ih-text-muted)", font: ".75rem var(--ih-font-mono)", letterSpacing: ".08em" }}>QUESTION {interview.currentQuestion.sequenceNo} · {interview.currentQuestion.category.toUpperCase()}</div>
            <h2 style={{ lineHeight: 1.45 }}>{interview.currentQuestion.prompt}</h2>
            <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={9} placeholder="Type your answer here. Aim for a specific example, your actions, and the outcome." style={{ width: "100%", boxSizing: "border-box", padding: "1rem", borderRadius: 12, border: "1px solid var(--ih-surface-border)", background: "var(--ih-bg)", color: "inherit", resize: "vertical", lineHeight: 1.55 }} />
            <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap", marginTop: ".8rem" }}>
              <button onClick={toggleSpeech} style={{ ...button, background: listening ? "var(--ih-danger, #c95d5d)" : "var(--ih-surface)", color: listening ? "white" : "inherit", border: "1px solid var(--ih-surface-border)" }}>{listening ? "■ Stop microphone" : "🎙 Use microphone"}</button>
              <button disabled={busy || answer.trim().length < 10} onClick={submitAnswer} style={{ ...button, opacity: busy || answer.trim().length < 10 ? .5 : 1 }}>{busy ? "Evaluating…" : "Submit answer →"}</button>
            </div>
            {lastEvaluation && <div style={{ ...card, marginTop: "1.25rem", background: "var(--ih-bg)" }}><h3 style={{ marginTop: 0 }}>Coaching feedback</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: ".6rem" }}>{[["Communication",lastEvaluation.communication],["Behavioral",lastEvaluation.behavioral],["Relevance",lastEvaluation.relevance],["Structure",lastEvaluation.structure]].map(([label,score]) => <div key={String(label)}><div style={{ color: "var(--ih-text-muted)", fontSize: ".8rem" }}>{label}</div><strong style={{ fontSize: "1.5rem" }}>{score}</strong>/100</div>)}</div><p><strong>Strengths:</strong> {lastEvaluation.strengths.join(" · ")}</p><p><strong>Improve:</strong> {lastEvaluation.improvements.join(" · ")}</p></div>}
          </> : <><h2>Interview complete</h2><button disabled={busy} onClick={finish} style={button}>{busy ? "Finishing…" : "Generate final report →"}</button></>}
        </section>}

        {result && <section style={card}>
          <p style={{ margin: 0, color: "var(--ih-accent)", font: ".75rem var(--ih-font-mono)" }}>INTERVIEW RESULT</p><h2 style={{ marginBottom: ".5rem" }}>Your HR readiness score</h2><div style={{ fontSize: "4rem", fontWeight: 900 }}>{result.overallScore}<span style={{ fontSize: "1rem", color: "var(--ih-text-muted)" }}>/100</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: ".75rem", margin: "1rem 0" }}>{[["Communication",result.communication],["Behavioral",result.behavioral],["Relevance",result.relevance],["Structure",result.structure]].map(([label,score]) => <div key={String(label)} style={{ ...card, background: "var(--ih-bg)" }}><div style={{ color: "var(--ih-text-muted)", fontSize: ".8rem" }}>{label}</div><strong style={{ fontSize: "1.5rem" }}>{score}</strong>/100</div>)}</div>
          <h3>Strengths</h3><ul>{result.strengths.map((item) => <li key={item}>{item}</li>)}</ul><h3>Next steps</h3><ul>{result.improvements.concat(result.recommendations).map((item, i) => <li key={`${item}-${i}`}>{item}</li>)}</ul>
          <button onClick={() => { setResult(null); setLastEvaluation(null); }} style={button}>Start another interview</button>
        </section>}

        <section style={{ ...card, marginTop: "1.5rem" }}><h2 style={{ marginTop: 0 }}>Interview history</h2>{history.length === 0 ? <p style={{ color: "var(--ih-text-muted)" }}>No completed interviews yet.</p> : <div style={{ display: "grid", gap: ".6rem" }}>{history.map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: ".75rem 0", borderBottom: "1px solid var(--ih-surface-border)" }}><span>{item.role || "General HR"}{item.company ? ` · ${item.company}` : ""}</span><span>{item.result ? `${item.result.overallScore}/100` : item.status}</span></div>)}</div>}</section>
      </div>
    </main>
  );
}
