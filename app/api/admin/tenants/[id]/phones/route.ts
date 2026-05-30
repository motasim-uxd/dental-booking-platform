import { NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin/auth";
import { createPhone } from "@/lib/admin/tenant-admin";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Ctx) {
  const auth = await assertAdminApi(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: tenantId } = await context.params;
  const body = await req.json().catch(() => null);

  try {
    const phone = await createPhone(
      tenantId,
      String(body?.botId ?? ""),
      String(body?.e164 ?? ""),
      body?.label
    );
    return NextResponse.json({ phone }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Create phone failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
