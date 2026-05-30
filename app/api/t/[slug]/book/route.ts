import { NextResponse } from "next/server";
import { handleBook } from "@/lib/booking/book";
import { assertWebFormFeature, loadBookingContext } from "@/lib/booking/context";
import { assertTenantChannelAuth } from "@/lib/booking/preview-auth";
import { rateLimit } from "@/lib/booking/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { slug } = await context.params;
  const ctx = await loadBookingContext(slug);

  if (!ctx) {
    return NextResponse.json({ success: false, error: { message: "Tenant not found" } }, { status: 404 });
  }

  if (ctx.tenant.status === "suspended") {
    return NextResponse.json({ success: false, error: { message: "Tenant suspended" } }, { status: 403 });
  }

  const webForm = assertWebFormFeature(ctx.tenant);
  if (!webForm.ok) {
    return NextResponse.json(
      { success: false, error: { message: webForm.error } },
      { status: webForm.status }
    );
  }

  const auth = assertTenantChannelAuth(req, ctx.tenant);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: { message: auth.error } }, { status: auth.status });
  }

  const limited = rateLimit(req);
  if (!limited.ok) {
    return NextResponse.json(
      { success: false, error: { message: "Too many requests. Please try again." } },
      { status: 429, headers: { "retry-after": String(limited.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  if (body && typeof body === "object" && (body as { website?: string }).website) {
    return NextResponse.json({ success: false, error: { message: "Invalid request." } }, { status: 400 });
  }

  const result = await handleBook(ctx, body);
  return NextResponse.json(result.body, { status: result.status });
}
