import { NextResponse } from "next/server";
import { PRACTICE_COOKIE } from "@/lib/practice/constants";
import { isPracticeSignupEnabled, loginPracticeUser } from "@/lib/practice/auth";
import { registerPractice } from "@/lib/practice/register";

export async function POST(req: Request) {
  if (!isPracticeSignupEnabled()) {
    return NextResponse.json({ error: "Registration is disabled" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);

  try {
    const { user } = await registerPractice({
      email: String(body?.email ?? ""),
      password: String(body?.password ?? ""),
      practiceName: String(body?.practiceName ?? ""),
      slug: body?.slug ? String(body.slug) : undefined,
      oryxRealm: body?.oryxRealm ? String(body.oryxRealm) : undefined,
      pmsType: "oryx",
    });

    const login = await loginPracticeUser(String(body?.email ?? ""), String(body?.password ?? ""));
    if (!login.ok) {
      return NextResponse.json(
        { error: login.error, tenantId: user.tenantId },
        { status: 201 }
      );
    }

    const res = NextResponse.json(
      { ok: true, tenantId: user.tenantId },
      { status: 201 }
    );
    res.cookies.set(PRACTICE_COOKIE, login.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Registration failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
