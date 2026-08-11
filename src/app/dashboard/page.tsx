import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth/current";

export default async function DashboardPage() {
  const auth = await getCurrentAuth();
  if (!auth) {
    redirect("/?returnTo=/dashboard");
  }

  return (
    <main style={{ padding: "3rem", fontFamily: "var(--ih-font-body)", background: "var(--ih-bg)", color: "var(--ih-text)", minHeight: "100vh" }}>
      <h1 style={{ fontFamily: "var(--ih-font-display)" }}>Welcome back, {auth.user.name ?? "there"}.</h1>
      <p style={{ color: "var(--ih-text-muted)", maxWidth: 720 }}>
        Your IntelliHire training workspace. Start with Module 1 to benchmark your resume against a target role.
      </p>

      <section style={{ marginTop: "2rem", maxWidth: 720, border: "1px solid var(--ih-surface-border)", borderRadius: 16, padding: "1.25rem", background: "var(--ih-surface)" }}>
        <p style={{ margin: 0, font: "500 .72rem var(--ih-font-mono)", letterSpacing: ".12em", color: "var(--ih-accent)" }}>MODULE 01 / ATS</p>
        <h2 style={{ margin: ".4rem 0" }}>AI Resume Screening</h2>
        <p style={{ color: "var(--ih-text-muted)", lineHeight: 1.6 }}>
          Compare your resume with a real job description and get an ATS compatibility score, matched skills, gaps, and rewrite recommendations.
        </p>
        <Link href="/dashboard/module-1" style={{ display: "inline-block", marginTop: ".5rem", padding: ".75rem 1rem", borderRadius: 10, background: "var(--ih-accent)", color: "var(--ih-accent-ink)", fontWeight: 700, textDecoration: "none" }}>
          Open Module 1
        </Link>
      </section>

      <form action="/api/auth/logout" method="post" style={{ marginTop: "2rem" }}>
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
