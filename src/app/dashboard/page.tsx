import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth/current";

export default async function DashboardPage() {
  const auth = await getCurrentAuth();
  if (!auth) {
    redirect("/?returnTo=/dashboard");
  }

  return (
    <main style={{ padding: "3rem", fontFamily: "var(--ih-font-body)" }}>
      <h1 style={{ fontFamily: "var(--ih-font-display)" }}>Welcome back, {auth.user.name ?? "there"}.</h1>
      <p style={{ color: "var(--ih-text-muted)" }}>
        This is a placeholder dashboard. Modules 1–5 (resume screening, adaptive assessments,
        technical/HR interviews, insights) plug into this shell as they are built.
      </p>
      <form action="/api/auth/logout" method="post">
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
