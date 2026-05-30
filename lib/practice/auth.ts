import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { PRACTICE_COOKIE } from "@/lib/practice/constants";
import { verifyPassword } from "@/lib/practice/password";
import { signPracticeSession, verifyPracticeSessionCookie } from "@/lib/practice/session-token";

export { PRACTICE_COOKIE };

export type PracticeSessionUser = {
  id: string;
  email: string;
  tenantId: string;
  tenant: {
    id: string;
    slug: string;
    name: string;
    status: string;
    features: unknown;
  };
};

export async function getPracticeSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const cookie = jar.get(PRACTICE_COOKIE)?.value ?? "";
  return verifyPracticeSessionCookie(cookie);
}

export async function getPracticeSessionUser(): Promise<PracticeSessionUser | null> {
  const userId = await getPracticeSessionUserId();
  if (!userId) return null;
  const user = await prisma.platformUser.findUnique({
    where: { id: userId },
    include: {
      tenant: {
        select: { id: true, slug: true, name: true, status: true, features: true },
      },
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    tenantId: user.tenantId,
    tenant: user.tenant,
  };
}

export async function loginPracticeUser(
  email: string,
  password: string
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) {
    return { ok: false, error: "Email and password required" };
  }

  const user = await prisma.platformUser.findUnique({
    where: { email: normalized },
  });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { ok: false, error: "Invalid email or password" };
  }

  const token = await signPracticeSession(user.id);
  if (!token) {
    return {
      ok: false,
      error:
        "Practice login is not configured. Add PRACTICE_SESSION_SECRET, PLATFORM_INTERNAL_SECRET, or PLATFORM_ADMIN_SECRET to .env.local and restart npm run dev.",
    };
  }

  return { ok: true, token };
}

export function isPracticeSignupEnabled(): boolean {
  const v = process.env.PRACTICE_SIGNUP_ENABLED?.trim().toLowerCase();
  if (!v) return true;
  return v === "1" || v === "true" || v === "yes";
}
