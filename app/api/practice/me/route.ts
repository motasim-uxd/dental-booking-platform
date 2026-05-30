import { NextResponse } from "next/server";
import { getPracticeSessionUser } from "@/lib/practice/auth";

export async function GET() {
  const user = await getPracticeSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ user });
}
