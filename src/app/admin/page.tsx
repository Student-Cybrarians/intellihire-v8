import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth/current";
import { isConfiguredAdminEmail } from "@/db/repositories/users";

const navItems = [
  ["Dashboard", "/admin"],
  ["Users", "/admin/users"],
  ["Sessions", "/admin/sessions"],
  ["Audit Logs", "/admin/audit"],
] as const;

const cards = [
  { label: "Platform Users", value: "—", meta: "Live data from PostgreSQL" },
  { label: "Active Sessions", value: "—", meta: "Live session inventory" },
  { label: "Security Events", value: "—", meta: "Recent events" },
  { label: "System Status", value: "Healthy", meta: "Application services online" },
];

export default async function AdminPage() {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/?returnTo=/admin");

  if (
    auth.user.role !== "ADMIN" ||
    !isConfiguredAdminEmail(auth.user.email, auth.user.emailVerified)
  ) {
    redirect("/dashboard");
  }

  return (
    <main className="admin-page">
      <aside className="admin-sidebar" aria-label="Administration navigation">
        <div className="admin-brand">
          <span className="admin-brand-mark">IH</span>
          <div>
            <strong>IntelliHire</strong>
            <span>Admin Console</span>
          </div>
        </div>
        <nav>
          {navItems.map(([label, href], index) => (
            <a key={href} href={href} className={`admin-nav-item ${index === 0 ? "active" : ""}`}>
              <span className="admin-nav-dot" />
              {label}
            </a>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <span className="admin-status-dot" />
          Secure administrator session
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-eyebrow">INTELLIHIRE CONTROL CENTER</p>
            <h1>Admin Dashboard</h1>
            <p>Manage platform operations, users, sessions, and security.</p>
          </div>
          <div className="admin-user-chip">
            <div className="admin-avatar">{(auth.user.name ?? auth.user.email).slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{auth.user.name ?? "Administrator"}</strong>
              <span>{auth.user.email}</span>
            </div>
          </div>
        </header>

        <div className="admin-grid">
          {cards.map((card) => (
            <section className="admin-card" key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.meta}</small>
            </section>
          ))}
        </div>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <span className="admin-eyebrow">QUICK ACTIONS</span>
              <h2>Administration</h2>
            </div>
            <span className="admin-live-pill"><span /> Live</span>
          </div>
          <div className="admin-actions">
            <a href="/admin/users">User Management</a>
            <a href="/admin/sessions">Session Oversight</a>
            <a href="/admin/audit">Security &amp; Audit Logs</a>
            <a href="/dashboard">Return to IntelliHire</a>
          </div>
        </section>

        <footer className="admin-footer">IntelliHire • Protected administrator area • Role-based access enforced server-side</footer>
      </section>
    </main>
  );
}
