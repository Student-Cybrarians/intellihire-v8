const modules = [
  ["01", "Resume screening", "Signal extraction and readiness scoring"],
  ["02", "Adaptive assessments", "Difficulty that responds to performance"],
  ["03", "Technical + HR interviews", "Structured practice with actionable feedback"],
];

export default function Home() {
  return (
    <main className="shell">
      <nav className="nav"><div className="brand">Intelli<span>Hire</span></div><div className="pill">AI-Based Placement Trainer</div></nav>
      <section className="hero">
        <div>
          <div className="eyebrow">Placement readiness console</div>
          <h1>Train smart.<br/>Perform better.<br/><span>Get placed.</span></h1>
          <p className="lede">IntelliHire turns placement preparation into a measurable training loop: screen your resume, stress-test your skills, rehearse interviews, and see exactly where you need to improve.</p>
          <div className="actions"><a className="btn primary" href="#modules">Explore modules</a><a className="btn" href="https://github.com/Student-Cybrarians/intellihire-v8">View source</a></div>
        </div>
        <div className="console"><h2>Training pipeline</h2>{modules.map(([code,name,detail])=><div className="row" key={code}><span className="dot"/><span className="code">{code}</span><strong>{name}</strong><span className="detail">{detail}</span></div>)}</div>
      </section>
      <section id="modules" className="grid">{modules.map(([code,name,detail])=><article className="card" key={code}><div className="eyebrow">Module {code}</div><h3>{name}</h3><p>{detail}. Built as part of the IntelliHire training platform.</p></article>)}</section>
      <footer className="foot">IntelliHire v8 · Student-Cybrarians</footer>
    </main>
  );
}
