import { NextResponse } from "next/server";
import { ADMIN_COOKIE, getAdminSessionToken, verifyAdminPassword } from "@/lib/admin/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ success: false, error: "Invalid password" }, { status: 401 });
  }

  const token = await getAdminSessionToken();
  if (!token) {
    return NextResponse.json(
      { success: false, error: "PLATFORM_ADMIN_SECRET not configured" },
      { status: 503 }
    );
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
