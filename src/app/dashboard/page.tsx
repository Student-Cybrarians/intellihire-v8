import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth/current";

export default async function DashboardPage() {
  const auth = await getCurrentAuth();
  if (!auth) {
    redirect("/?returnTo=/dashboard");
  }

  const card = {
    border: "1px solid var(--ih-surface-border)",
    borderRadius: 16,
    padding: "1.25rem",
    background: "var(--ih-surface)",
  } as const;
  const link = {
    display: "inline-block",
    marginTop: ".5rem",
    padding: ".75rem 1rem",
    borderRadius: 10,
    background: "var(--ih-accent)",
    color: "var(--ih-accent-ink)",
    fontWeight: 700,
    textDecoration: "none",
  } as const;

  return (
    <main style={{ padding: "3rem", fontFamily: "var(--ih-font-body)", background: "var(--ih-bg)", color: "var(--ih-text)", minHeight: "100vh" }}>
      <h1 style={{ fontFamily: "var(--ih-font-display)" }}>Welcome back, {auth.user.name ?? "there"}.</h1>
      <p style={{ color: "var(--ih-text-muted)", maxWidth: 760 }}>
        Your IntelliHire training workspace. Work through the modules in order so every result can feed the next stage.
      </p>

      <div style={{ display: "grid", gap: "1.25rem", maxWidth: 900 }}>
        <section style={card}>
          <p style={{ margin: 0, font: "500 .72rem var(--ih-font-mono)", letterSpacing: ".12em", color: "var(--ih-accent)" }}>MODULE 01 / ATS</p>
          <h2 style={{ margin: ".4rem 0" }}>AI Resume Screening</h2>
          <p style={{ color: "var(--ih-text-muted)", lineHeight: 1.6 }}>
            Compare your resume with a target role and generate evidence-based ATS compatibility, strengths, gaps, and recommendations.
          </p>
          <Link href="/dashboard/module-1" style={link}>Open Module 1</Link>
        </section>

        <section style={card}>
          <p style={{ margin: 0, font: "500 .72rem var(--ih-font-mono)", letterSpacing: ".12em", color: "var(--ih-accent)" }}>MODULE 02 / ADAPTIVE ASSESSMENT</p>
          <h2 style={{ margin: ".4rem 0" }}>Adaptive AI Assessment</h2>
          <p style={{ color: "var(--ih-text-muted)", lineHeight: 1.6 }}>
            Answer calibrated questions across aptitude, reasoning, verbal, domain, and coding sections. Difficulty updates as your ability estimate changes.
          </p>
          <Link href="/dashboard/module-2" style={link}>Open Module 2</Link>
        </section>
      </div>

      <form action="/api/auth/logout" method="post" style={{ marginTop: "2rem" }}>
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
