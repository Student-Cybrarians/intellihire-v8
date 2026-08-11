import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentAuth = vi.fn();
vi.mock("@/lib/auth/current", () => ({
  getCurrentAuth: () => mockGetCurrentAuth(),
}));

const { requireAuth, requireRole, requirePermission } = await import("@/lib/auth/guards");

function fakeUser(overrides: Partial<{ role: "USER" | "ADMIN" }> = {}) {
  return {
    id: "user-1",
    role: overrides.role ?? "USER",
    status: "ACTIVE",
  };
}

beforeEach(() => {
  mockGetCurrentAuth.mockReset();
});

describe("requireAuth", () => {
  it("returns 401 when there is no session", async () => {
    mockGetCurrentAuth.mockResolvedValue(null);
    const handler = requireAuth(async () => new Response("ok"));
    const res = await handler(new Request("https://intellihire.test/api/whatever"));
    expect(res.status).toBe(401);
  });

  it("calls the handler when a session exists", async () => {
    mockGetCurrentAuth.mockResolvedValue({ user: fakeUser(), session: { id: "s1" } });
    const handler = requireAuth(async () => new Response("ok"));
    const res = await handler(new Request("https://intellihire.test/api/whatever"));
    expect(res.status).toBe(200);
  });
});

describe("requireRole", () => {
  it("allows a USER hitting a USER-gated route", async () => {
    mockGetCurrentAuth.mockResolvedValue({ user: fakeUser({ role: "USER" }), session: { id: "s1" } });
    const handler = requireRole("USER", async () => new Response("ok"));
    const res = await handler(new Request("https://intellihire.test/api/whatever"));
    expect(res.status).toBe(200);
  });

  it("blocks a USER hitting an ADMIN-gated route with 403", async () => {
    mockGetCurrentAuth.mockResolvedValue({ user: fakeUser({ role: "USER" }), session: { id: "s1" } });
    const handler = requireRole("ADMIN", async () => new Response("ok"));
    const res = await handler(new Request("https://intellihire.test/api/whatever"));
    expect(res.status).toBe(403);
  });

  it("ADMIN can access routes gated to any role (implicit superset)", async () => {
    mockGetCurrentAuth.mockResolvedValue({ user: fakeUser({ role: "ADMIN" }), session: { id: "s1" } });
    const handler = requireRole("USER", async () => new Response("ok"));
    const res = await handler(new Request("https://intellihire.test/api/whatever"));
    expect(res.status).toBe(200);
  });
});

describe("requirePermission", () => {
  it("blocks a plain USER (no granular permissions yet -> none held)", async () => {
    mockGetCurrentAuth.mockResolvedValue({ user: fakeUser({ role: "USER" }), session: { id: "s1" } });
    const handler = requirePermission("users:suspend", async () => new Response("ok"));
    const res = await handler(new Request("https://intellihire.test/api/whatever"));
    expect(res.status).toBe(403);
  });

  it("allows ADMIN through any permission check", async () => {
    mockGetCurrentAuth.mockResolvedValue({ user: fakeUser({ role: "ADMIN" }), session: { id: "s1" } });
    const handler = requirePermission("users:suspend", async () => new Response("ok"));
    const res = await handler(new Request("https://intellihire.test/api/whatever"));
    expect(res.status).toBe(200);
  });
});
