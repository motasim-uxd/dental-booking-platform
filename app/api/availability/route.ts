import { NextResponse } from "next/server";
import { handleAvailability } from "@/lib/booking/availability";
import { DEFAULT_TENANT_SLUG, loadBookingContext } from "@/lib/booking/context";
import { assertWebPreviewCode } from "@/lib/booking/preview-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Legacy Smile Squad availability — defaults to tenant `smilesquad`. */
export async function GET(req: Request) {
  try {
    const ctx = await loadBookingContext(DEFAULT_TENANT_SLUG);
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }

    const auth = assertWebPreviewCode(req, ctx.tenant);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const url = new URL(req.url);
    const result = await handleAvailability(ctx, {
      date: url.searchParams.get("date") ?? "",
      apptType: url.searchParams.get("apptType") ?? undefined,
      firstAvail: url.searchParams.get("firstAvail") ?? undefined,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Availability failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
