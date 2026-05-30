import { NextResponse } from "next/server";
import { PRACTICE_COOKIE } from "@/lib/practice/constants";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PRACTICE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
