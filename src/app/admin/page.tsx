import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth/current";

export default async function AdminPage() {
  const auth = await getCurrentAuth();
  if (!auth) {
    redirect("/?returnTo=/admin");
  }
  if (auth.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <main style={{ padding: "3rem", fontFamily: "var(--ih-font-body)" }}>
      <h1 style={{ fontFamily: "var(--ih-font-display)" }}>Admin console</h1>
      <p style={{ color: "var(--ih-text-muted)" }}>
        Placeholder for admin-only tooling (user management, session/device oversight, audit log
        review).
      </p>
    </main>
  );
}
