import { NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin/auth";
import { deletePhone } from "@/lib/admin/tenant-admin";

type Ctx = { params: Promise<{ id: string; phoneId: string }> };

export async function DELETE(req: Request, context: Ctx) {
  const auth = await assertAdminApi(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { phoneId } = await context.params;
  try {
    await deletePhone(phoneId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 400 });
  }
}
