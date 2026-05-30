import { NextResponse } from "next/server";
import { assertPlatformSecret } from "@/lib/platform-auth";
import {
  resolveTenantBotFromPhone,
  toResolvePhoneResult,
} from "@/lib/tenant/resolver";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = assertPlatformSecret(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(req.url);
  const did = (url.searchParams.get("did") ?? "").trim();
  if (!did) {
    return NextResponse.json({ error: "Missing did query parameter" }, { status: 400 });
  }

  const ctx = await resolveTenantBotFromPhone(did);
  if (!ctx) {
    return NextResponse.json({ error: "Phone number not found" }, { status: 404 });
  }

  if (ctx.tenant.status === "suspended") {
    return NextResponse.json({ error: "Tenant suspended" }, { status: 403 });
  }

  if (!ctx.bot.enabled) {
    return NextResponse.json({ error: "Bot disabled" }, { status: 403 });
  }

  return NextResponse.json(toResolvePhoneResult(ctx));
}
