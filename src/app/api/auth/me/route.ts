import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";

export const GET = requireAuth(async (auth) => {
  const { user } = auth;
  return NextResponse.json({
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  });
});
