"use client";

import { useState } from "react";
import type { AtsScreeningResult } from "@/lib/modules/ats/types";
import "./Module1AtsConsole.css";

export function Module1AtsConsole() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<AtsScreeningResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function screenResume(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/modules/ats/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, jobDescription }),
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

  return (
    <div className="m1-console">
      <div className="m1-console__header">
        <div>
          <p className="m1-kicker">MODULE 01 / ATS</p>
          <h1>AI Resume Screening</h1>
          <p>Compare your resume with a real target role and see what an ATS is likely to notice.</p>
        </div>
        <div className="m1-badge">OpenRouter</div>
      </div>

      <form className="m1-form" onSubmit={screenResume}>
        <label>
          <span>Resume text</span>
          <textarea
            value={resumeText}
            onChange={(event) => setResumeText(event.target.value)}
            placeholder="Paste your resume text here..."
            rows={16}
            required
          />
        </label>
        <label>
          <span>Target job description</span>
          <textarea
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            placeholder="Paste the target job description here..."
            rows={16}
            required
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Screening…" : "Run ATS screening"}
        </button>
      </form>

      {error ? <div className="m1-error">{error}</div> : null}

      {result ? (
        <section className="m1-results" aria-live="polite">
          <div className="m1-score">
            <div className="m1-score__number">{result.overallScore}</div>
            <div>
              <div className="m1-score__label">Overall readiness</div>
              <p>{result.summary}</p>
            </div>
          </div>

          <div className="m1-metrics">
            {[
              ["ATS compatibility", result.atsCompatibility],
              ["Keyword match", result.keywordMatch],
              ["Experience fit", result.experienceFit],
              ["Education fit", result.educationFit],
            ].map(([label, value]) => (
              <div className="m1-metric" key={label}>
                <span>{label}</span>
                <strong>{value}%</strong>
              </div>
            ))}
          </div>

          <div className="m1-grid">
            <List title="Matched skills" items={result.matchedSkills} />
            <List title="Missing skills" items={result.missingSkills} />
            <List title="Strengths" items={result.strengths} />
            <List title="Recommendations" items={result.recommendations} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="m1-list">
      <h2>{title}</h2>
      {items.length ? (
        <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
      ) : (
        <p className="m1-empty">Nothing returned.</p>
      )}
    </div>
  );
}
