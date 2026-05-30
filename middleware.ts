import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin/constants";
import { resolveAdminSessionToken } from "@/lib/admin/session-token";
import { PRACTICE_COOKIE } from "@/lib/practice/constants";
import { verifyPracticeSessionCookie } from "@/lib/practice/session-token";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function guardAdmin(req: NextRequest): Promise<NextResponse | null> {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return null;
  if (pathname === "/admin/login") return NextResponse.next();

  const expected = await resolveAdminSessionToken();
  if (!expected) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const got = req.cookies.get(ADMIN_COOKIE)?.value ?? "";
  if (!safeEqual(got, expected)) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  return NextResponse.next();
}

async function guardPractice(req: NextRequest): Promise<NextResponse | null> {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/practice")) return null;
  if (pathname === "/practice/login" || pathname === "/practice/register") {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(PRACTICE_COOKIE)?.value ?? "";
  const userId = await verifyPracticeSessionCookie(cookie);
  if (!userId) {
    return NextResponse.redirect(new URL("/practice/login", req.url));
  }

  return NextResponse.next();
}

export async function middleware(req: NextRequest) {
  const admin = await guardAdmin(req);
  if (admin) return admin;
  const practice = await guardPractice(req);
  if (practice) return practice;
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/practice/:path*"],
};
