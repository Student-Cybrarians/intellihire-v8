import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth/current";
import { isConfiguredAdminEmail } from "@/db/repositories/users";

export default async function AdminPage() {
  const auth = await getCurrentAuth();
  if (!auth) {
    redirect("/?returnTo=/admin");
  }

  // Defense in depth: ADMIN role plus the one server-configured, verified
  // Google email are both required. This keeps a stale or manually altered
  // role from granting administrator access to another account.
  if (
    auth.user.role !== "ADMIN" ||
    !isConfiguredAdminEmail(auth.user.email, auth.user.emailVerified)
  ) {
    redirect("/dashboard");
  }

  return (
    <main style={{ padding: "3rem", fontFamily: "var(--ih-font-body)" }}>
      <h1 style={{ fontFamily: "var(--ih-font-display)" }}>Admin console</h1>
      <p style={{ color: "var(--ih-text-muted)" }}>
        Administrator access is restricted to the single verified Google account configured by
        ADMIN_EMAIL.
      </p>
    </main>
  );
}
