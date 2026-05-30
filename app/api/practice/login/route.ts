import { NextResponse } from "next/server";
import { PRACTICE_COOKIE } from "@/lib/practice/constants";
import { loginPracticeUser } from "@/lib/practice/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const login = await loginPracticeUser(String(body?.email ?? ""), String(body?.password ?? ""));
  if (!login.ok) {
    return NextResponse.json({ error: login.error }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(PRACTICE_COOKIE, login.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 14,
  });
  return res;
}
