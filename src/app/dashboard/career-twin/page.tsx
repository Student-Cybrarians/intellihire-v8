import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth/current";
import CareerTwinConsole from "@/components/CareerTwinConsole";

export default async function CareerTwinPage() {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/?returnTo=/dashboard/career-twin");

  return (
    <main style={{ minHeight: "100vh", padding: "2rem", background: "var(--ih-bg)", color: "var(--ih-text)", fontFamily: "var(--ih-font-body)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link href="/dashboard" style={{ color: "var(--ih-accent)", textDecoration: "none" }}>← Dashboard</Link>
        <header style={{ margin: "2rem 0" }}>
          <p style={{ margin: 0, color: "var(--ih-accent)", font: "500 .72rem var(--ih-font-mono)", letterSpacing: ".14em" }}>CAREER DIGITAL TWIN / SKILL GRAPH</p>
          <h1 style={{ fontFamily: "var(--ih-font-display)", fontSize: "clamp(2rem, 5vw, 3.5rem)", margin: ".5rem 0" }}>Build your evidence graph.</h1>
          <p style={{ maxWidth: 760, color: "var(--ih-text-muted)", lineHeight: 1.7 }}>
            IntelliHire maps skills explicitly supported by your resume against a target role, separates genuine gaps from transferable skills, and keeps only the derived graph for future modules.
          </p>
        </header>
        <CareerTwinConsole />
      </div>
    </main>
  );
}
