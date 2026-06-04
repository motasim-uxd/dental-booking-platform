import { NextResponse } from "next/server";
import { handleBook } from "@/lib/booking/book";
import { DEFAULT_TENANT_SLUG, loadBookingContext } from "@/lib/booking/context";
import {
  isFastApiConfigured,
  postBooking,
  toWebBookResult,
} from "@/lib/booking/fastapi-client";
import { assertWebPreviewCode } from "@/lib/booking/preview-auth";
import { rateLimit } from "@/lib/booking/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Public web booking endpoint (legacy Smile Squad path).
 * Tenant-scoped equivalent: POST /api/t/[slug]/book
 */
export async function POST(req: Request) {
  const ctx = await loadBookingContext(DEFAULT_TENANT_SLUG);
  if (!ctx) {
    return NextResponse.json({ success: false, error: { message: "Tenant not found" } }, { status: 404 });
  }

  const auth = assertWebPreviewCode(req, ctx.tenant);
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

  if (isFastApiConfigured()) {
    const json = await postBooking({
      tenantSlug: DEFAULT_TENANT_SLUG,
      channel: "web",
      payload: body,
    });
    const result = toWebBookResult(json);
    return NextResponse.json(result.body, { status: result.status });
  }

  const result = await handleBook(ctx, body);
  return NextResponse.json(result.body, { status: result.status });
}
