"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Metric = { module: string; label: string; available: boolean; attempts: number; score: number | null; completionRate: number; lastActivityAt: string | null };
type Overview = { period: { start: string; end: string; days: number }; overallScore: number | null; readinessLevel: string; metrics: Metric[]; trend: Array<{ date: string; score: number }>; strengths: string[]; gaps: string[]; recommendations: string[] };
type Report = { id: string; periodStart: string; periodEnd: string; overallScore: number; readinessLevel: string; createdAt: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message ?? "Request failed");
  return data as T;
}

const card: React.CSSProperties = { border: "1px solid var(--ih-surface-border)", borderRadius: 16, padding: "1.2rem", background: "var(--ih-surface)" };
const button: React.CSSProperties = { border: 0, borderRadius: 10, padding: ".75rem 1rem", background: "var(--ih-accent)", color: "var(--ih-accent-ink)", fontWeight: 800, cursor: "pointer" };

function scoreTone(score: number | null) { return score === null ? "var(--ih-text-muted)" : score >= 80 ? "var(--ih-success, #3b8f68)" : score >= 60 ? "var(--ih-accent)" : "var(--ih-danger, #c95d5d)"; }

export default function Module5Page() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [busy, setBusy] = useState(true);
  const [reportBusy, setReportBusy] = useState(false);
  const [error, setError] = useState("");

  async function load(selectedDays = days) {
    setBusy(true); setError("");
    try {
      const [data, reportData] = await Promise.all([
        api<Overview>(`/api/insights/overview?days=${selectedDays}`),
        api<{ reports: Report[] }>("/api/insights/reports"),
      ]);
      setOverview(data); setReports(reportData.reports);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load insights"); }
    finally { setBusy(false); }
  }

  // Load user-owned analytics after the browser is mounted; no server-side data is exposed to the client before auth.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(30); }, []);

  async function generateReport() {
    setReportBusy(true); setError("");
    try {
      const report = await api<Overview & { id: string; createdAt: string }>("/api/insights/reports", { method: "POST", body: JSON.stringify({ days }) });
      setOverview(report); setReports((current) => [{ id: report.id, periodStart: report.period.start, periodEnd: report.period.end, overallScore: report.overallScore ?? 0, readinessLevel: report.readinessLevel, createdAt: report.createdAt }, ...current]);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to generate report"); }
    finally { setReportBusy(false); }
  }

  function exportCsv() {
    if (!overview) return;
    const rows = [["Module","Score","Attempts","Completion rate"], ...overview.metrics.map((m) => [m.label, m.score == null ? "N/A" : String(m.score), String(m.attempts), `${m.completionRate}%`])];
    rows.push(["Overall readiness", overview.overallScore == null ? "N/A" : String(overview.overallScore), "", ""]);
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `intellihire-performance-${days}d.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--ih-bg)", color: "var(--ih-text)", padding: "2rem", fontFamily: "var(--ih-font-body)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link href="/dashboard" style={{ color: "var(--ih-accent)", textDecoration: "none", fontWeight: 700 }}>← Dashboard</Link>
        <header style={{ margin: "1.5rem 0 2rem" }}>
          <p style={{ margin: 0, font: ".72rem var(--ih-font-mono)", letterSpacing: ".12em", color: "var(--ih-accent)" }}>MODULE 05 / PERFORMANCE INSIGHTS</p>
          <h1 style={{ margin: ".4rem 0", fontFamily: "var(--ih-font-display)", fontSize: "clamp(2rem,5vw,3.5rem)" }}>Performance Insights</h1>
          <p style={{ color: "var(--ih-text-muted)", maxWidth: 780, lineHeight: 1.65 }}>One evidence-based view of your IntelliHire training performance across adaptive assessment, technical interview, and HR interview results.</p>
        </header>

        {error && <div role="alert" style={{ ...card, borderColor: "var(--ih-danger, #c95d5d)", marginBottom: "1rem" }}>{error}</div>}
        <section style={{ ...card, marginBottom: "1rem", display: "flex", gap: ".75rem", alignItems: "center", flexWrap: "wrap" }}>
          <label>Time window <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ marginLeft: ".5rem", padding: ".6rem", borderRadius: 8, background: "var(--ih-bg)", color: "inherit", border: "1px solid var(--ih-surface-border)" }}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option><option value={365}>1 year</option></select></label>
          <button disabled={busy} onClick={() => void load(days)} style={{ ...button, opacity: busy ? .6 : 1 }}>{busy ? "Refreshing…" : "Refresh insights"}</button>
          <button disabled={!overview} onClick={exportCsv} style={{ ...button, background: "var(--ih-surface)", color: "inherit", border: "1px solid var(--ih-surface-border)", opacity: overview ? 1 : .5 }}>Export CSV</button>
          <button disabled={reportBusy || !overview} onClick={() => void generateReport()} style={{ ...button, opacity: reportBusy || !overview ? .6 : 1 }}>{reportBusy ? "Generating…" : "Save performance report"}</button>
        </section>

        {busy && !overview ? <section style={card}><p>Loading your performance profile…</p></section> : overview && <>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: "1rem", marginBottom: "1rem" }}>
            <div style={card}><div style={{ color: "var(--ih-text-muted)", fontSize: ".82rem" }}>Overall readiness</div><div style={{ fontSize: "3.2rem", fontWeight: 900, color: scoreTone(overview.overallScore) }}>{overview.overallScore == null ? "—" : overview.overallScore}<span style={{ fontSize: "1rem", color: "var(--ih-text-muted)" }}>{overview.overallScore == null ? "" : "/100"}</span></div><strong>{overview.readinessLevel.replaceAll("_", " ")}</strong></div>
            <div style={card}><div style={{ color: "var(--ih-text-muted)", fontSize: ".82rem" }}>Evidence</div><div style={{ fontSize: "2rem", fontWeight: 900 }}>{overview.metrics.reduce((sum, m) => sum + m.attempts, 0)}</div><div style={{ color: "var(--ih-text-muted)" }}>practice attempts in {overview.period.days} days</div></div>
            <div style={card}><div style={{ color: "var(--ih-text-muted)", fontSize: ".82rem" }}>Scored modules</div><div style={{ fontSize: "2rem", fontWeight: 900 }}>{overview.metrics.filter((m) => m.score !== null).length}/{overview.metrics.length}</div><div style={{ color: "var(--ih-text-muted)" }}>with completed results</div></div>
          </section>

          <section style={{ ...card, marginBottom: "1rem" }}><h2 style={{ marginTop: 0 }}>Module scorecard</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "1rem" }}>{overview.metrics.map((m) => <div key={m.module} style={{ ...card, background: "var(--ih-bg)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: ".5rem" }}><strong>{m.label}</strong><strong style={{ color: scoreTone(m.score) }}>{m.score == null ? "—" : `${m.score}/100`}</strong></div><div style={{ height: 8, borderRadius: 999, background: "var(--ih-surface-border)", margin: ".8rem 0", overflow: "hidden" }}><div style={{ width: `${m.score ?? 0}%`, height: "100%", background: "var(--ih-accent)" }} /></div><div style={{ fontSize: ".82rem", color: "var(--ih-text-muted)" }}>{m.attempts} attempts · {m.completionRate}% completion</div></div>)}</div></section>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "1rem", marginBottom: "1rem" }}>
            <div style={card}><h2 style={{ marginTop: 0 }}>Strengths</h2><ul>{overview.strengths.map((item, i) => <li key={`${item}-${i}`} style={{ marginBottom: ".6rem" }}>{item}</li>)}</ul></div>
            <div style={card}><h2 style={{ marginTop: 0 }}>Gaps to address</h2><ul>{overview.gaps.map((item, i) => <li key={`${item}-${i}`} style={{ marginBottom: ".6rem" }}>{item}</li>)}</ul></div>
            <div style={card}><h2 style={{ marginTop: 0 }}>Recommended next steps</h2><ol>{overview.recommendations.map((item, i) => <li key={`${item}-${i}`} style={{ marginBottom: ".6rem" }}>{item}</li>)}</ol></div>
          </section>

          <section style={card}><h2 style={{ marginTop: 0 }}>Score trend</h2>{overview.trend.length === 0 ? <p style={{ color: "var(--ih-text-muted)" }}>Complete a scored module to start building your trend.</p> : <div style={{ display: "flex", gap: ".35rem", alignItems: "end", height: 180, overflowX: "auto", paddingTop: "1rem" }}>{overview.trend.map((point) => <div key={point.date} title={`${point.date}: ${point.score}/100`} style={{ minWidth: 22, height: `${Math.max(8, point.score * 1.45)}px`, background: "var(--ih-accent)", borderRadius: "5px 5px 0 0" }} />)}</div>}</section>
        </>}

        <section style={{ ...card, marginTop: "1rem" }}><h2 style={{ marginTop: 0 }}>Saved reports</h2>{reports.length === 0 ? <p style={{ color: "var(--ih-text-muted)" }}>No saved reports yet. Generate one when you want a point-in-time record.</p> : <div style={{ display: "grid", gap: ".5rem" }}>{reports.map((report) => <Link key={report.id} href={`/dashboard/module-5/report/${report.id}`} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: ".75rem", borderRadius: 10, background: "var(--ih-bg)", color: "inherit", textDecoration: "none" }}><span>{new Date(report.periodStart).toLocaleDateString()} – {new Date(report.periodEnd).toLocaleDateString()}</span><strong>{report.overallScore}/100 · {report.readinessLevel.replaceAll("_", " ")}</strong></Link>)}</div>}</section>
      </div>
    </main>
  );
}
