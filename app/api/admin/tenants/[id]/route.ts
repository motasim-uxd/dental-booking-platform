import { NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin/auth";
import { deleteTenant, getTenantDetail, updateTenant } from "@/lib/admin/tenant-admin";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: Ctx) {
  const auth = await assertAdminApi(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await context.params;
  const tenant = await getTenantDetail(id);
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ tenant });
}

export async function PATCH(req: Request, context: Ctx) {
  const auth = await assertAdminApi(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await context.params;
  const body = await req.json().catch(() => null);

  try {
    const tenant = await updateTenant(id, {
      name: body?.name,
      status: body?.status,
      features: body?.features,
      branding: body?.branding,
      webFormAccessCode: body?.webFormAccessCode,
      maxBots: body?.maxBots,
      pmsType: body?.pmsType,
      oryxRealm: body?.oryxRealm,
      operatoryRules: body?.operatoryRules,
    });
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ tenant });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: Request, context: Ctx) {
  const auth = await assertAdminApi(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await context.params;
  try {
    await deleteTenant(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 400 });
  }
}
