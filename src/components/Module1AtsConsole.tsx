"use client";

import { useMemo, useState } from "react";
import type { AtsScreeningResult } from "@/lib/modules/ats/types";
import "./Module1AtsConsole.css";

const steps = [
  "Resume", "Job Description", "Target Role", "Parse", "Match", "Score", "Gaps", "Recommendations",
];

export function Module1AtsConsole() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [company, setCompany] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [result, setResult] = useState<AtsScreeningResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resumeWords = useMemo(() => wordCount(resumeText), [resumeText]);
  const jdWords = useMemo(() => wordCount(jobDescription), [jobDescription]);

  async function screenResume(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/modules/ats/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jobDescription,
          company,
          targetRole,
        }),
      });
      const payload = (await response.json()) as { result?: AtsScreeningResult; message?: string };
      if (!response.ok || !payload.result) {
        throw new Error(payload.message || "ATS screening failed.");
      }
      setResult(payload.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ATS screening failed.");
    } finally {
      setBusy(false);
    }
  }

  function downloadReport() {
    if (!result) return;
    const report = {
      product: "IntelliHire",
      module: "Module 1 — AI Recruitment Screening & ATS Engine",
      generatedAt: new Date().toISOString(),
      company: company || null,
      targetRole: targetRole || null,
      result,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "intellihire-module-1-ats-report.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="m1-console">
      <header className="m1-console__header">
        <div>
          <p className="m1-kicker">MODULE 01 / AI RECRUITMENT SCREENING</p>
          <h1>ATS Resume Intelligence Engine</h1>
          <p>From resume to shortlist. Analyze a candidate against a target job using evidence from the supplied resume and job description.</p>
        </div>
        <div className="m1-header-actions">
          <span className="m1-badge">LIVE ANALYSIS</span>
          <span className="m1-secure">● Authenticated workspace</span>
        </div>
      </header>

      <section className="m1-workflow" aria-label="Module 1 workflow">
        {steps.map((step, index) => (
          <div className="m1-step" key={step}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step}</strong>
            {index < steps.length - 1 ? <i aria-hidden="true">→</i> : null}
          </div>
        ))}
      </section>

      <form className="m1-form" onSubmit={screenResume}>
        <section className="m1-panel m1-panel--resume">
          <div className="m1-panel-heading">
            <div><span className="m1-panel-index">01</span><div><h2>Candidate Resume</h2><p>Paste the extracted resume text for analysis.</p></div></div>
            <span className="m1-count">{resumeWords} words</span>
          </div>
          <textarea
            value={resumeText}
            onChange={(event) => setResumeText(event.target.value)}
            placeholder="Name, summary, education, experience, projects, skills, certifications..."
            rows={18}
            required
          />
        </section>

        <section className="m1-panel">
          <div className="m1-panel-heading">
            <div><span className="m1-panel-index">02</span><div><h2>Target Job Description</h2><p>Use the actual posting you want to prepare for.</p></div></div>
            <span className="m1-count">{jdWords} words</span>
          </div>
          <textarea
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            placeholder="Responsibilities, required skills, qualifications, experience, technologies..."
            rows={18}
            required
          />
        </section>

        <section className="m1-panel m1-target-panel">
          <div className="m1-panel-heading">
            <div><span className="m1-panel-index">03</span><div><h2>Target Context</h2><p>Optional context used to personalize the screening.</p></div></div>
          </div>
          <div className="m1-target-grid">
            <label><span>Company</span><input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="e.g. Acme Technologies" /></label>
            <label><span>Target role</span><input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="e.g. Software Engineer" /></label>
          </div>
        </section>

        <div className="m1-submit-row">
          <div><strong>Ready to screen?</strong><span>Scores are generated from the submitted resume and job description — no placeholder scores.</span></div>
          <button type="submit" disabled={busy}>{busy ? "Analyzing…" : "Run AI ATS Screening →"}</button>
        </div>
      </form>

      {error ? <div className="m1-error" role="alert">{error}</div> : null}

      {result ? (
        <section className="m1-results" aria-live="polite">
          <div className="m1-results-header">
            <div><p className="m1-kicker">SCREENING COMPLETE</p><h2>Candidate Match Report</h2><p>{company || "Target company not specified"} · {targetRole || "Target role not specified"}</p></div>
            <button type="button" className="m1-secondary-button" onClick={downloadReport}>Export JSON report</button>
          </div>

          <div className="m1-score">
            <div className="m1-score__number">{result.overallScore}</div>
            <div><div className="m1-score__label">Overall match / 100</div><p>{result.summary}</p></div>
          </div>

          <div className="m1-metrics">
            {[["ATS compatibility", result.atsCompatibility], ["Keyword match", result.keywordMatch], ["Experience fit", result.experienceFit], ["Education fit", result.educationFit]].map(([label, value]) => (
              <div className="m1-metric" key={String(label)}><span>{label}</span><strong>{value}%</strong><div className="m1-meter"><i style={{ width: `${Number(value)}%` }} /></div></div>
            ))}
          </div>

          <div className="m1-grid">
            <List title="Matched skills" tone="positive" items={result.matchedSkills} />
            <List title="Missing skills" tone="warning" items={result.missingSkills} />
            <List title="Candidate strengths" items={result.strengths} />
            <List title="Recruiter recommendations" items={result.recommendations} />
          </div>
        </section>
      ) : null}
    </main>
  );
}

function List({ title, items, tone = "default" }: { title: string; items: string[]; tone?: "default" | "positive" | "warning" }) {
  return <div className={`m1-list m1-list--${tone}`}><h3>{title}</h3>{items.length ? <ul>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p className="m1-empty">No items returned.</p>}</div>;
}

function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}
