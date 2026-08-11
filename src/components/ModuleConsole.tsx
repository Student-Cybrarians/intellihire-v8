const MODULES = [
  { code: "ATS", name: "AI Resume Screening", detail: "Parsed against real job descriptions" },
  { code: "AAS", name: "Adaptive Assessments", detail: "Difficulty tunes to your answers" },
  { code: "TEC", name: "AI Technical Interviews", detail: "Live coding + system design" },
  { code: "HR", name: "Real-Time HR Interviews", detail: "Behavioral, voice-based" },
  { code: "INS", name: "Performance Insights", detail: "Scored, tracked, actionable" },
] as const;

export function ModuleConsole() {
  return (
    <div className="ih-console" aria-label="IntelliHire training modules">
      <p className="ih-console__label">Training console</p>
      <ul className="ih-console__list">
        {MODULES.map((mod) => (
          <li key={mod.code} className="ih-console__row">
            <span className="ih-console__dot" aria-hidden="true" />
            <span className="ih-console__code">{mod.code}</span>
            <span className="ih-console__name">{mod.name}</span>
            <span className="ih-console__detail">{mod.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
