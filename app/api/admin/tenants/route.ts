import { NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin/auth";
import { createTenant, listTenants } from "@/lib/admin/tenant-admin";

export async function GET(req: Request) {
  const auth = await assertAdminApi(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenants = await listTenants();
  return NextResponse.json({ tenants });
}

export async function POST(req: Request) {
  const auth = await assertAdminApi(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  try {
    const tenant = await createTenant({
      slug: String(body?.slug ?? ""),
      name: String(body?.name ?? ""),
      status: body?.status,
      features: body?.features,
      branding: body?.branding,
      webFormAccessCode: body?.webFormAccessCode,
      pmsType: body?.pmsType,
      oryxRealm: body?.oryxRealm,
      operatoryRules: body?.operatoryRules,
    });
    return NextResponse.json({ tenant }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
