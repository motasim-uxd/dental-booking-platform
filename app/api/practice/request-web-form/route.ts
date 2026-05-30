import { NextResponse } from "next/server";
import { getPracticeSessionUser } from "@/lib/practice/auth";
import { requestWebFormAddOn } from "@/lib/practice/register";

export async function POST() {
  const user = await getPracticeSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const features = await requestWebFormAddOn(user.tenantId);
  if (!features) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, features });
}
