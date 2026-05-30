import { NextResponse } from "next/server";
import { handleBook } from "@/lib/booking/book";
import { DEFAULT_TENANT_SLUG, loadBookingContext } from "@/lib/booking/context";
import { assertConnectWebhookSecret } from "@/lib/platform-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Internal Lex / Connect booking endpoint.
 * Requires CONNECT_WEBHOOK_SECRET via x-api-key.
 * Optional header X-Tenant-Slug (defaults to smilesquad).
 */
export async function POST(req: Request) {
  const auth = assertConnectWebhookSecret(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: { message: auth.error } }, { status: auth.status });
  }

  const slug =
    (req.headers.get("x-tenant-slug") ?? "").trim().toLowerCase() || DEFAULT_TENANT_SLUG;

  const ctx = await loadBookingContext(slug);
  if (!ctx) {
    return NextResponse.json({ success: false, error: { message: "Tenant not found" } }, { status: 404 });
  }

  if (ctx.tenant.status === "suspended") {
    return NextResponse.json({ success: false, error: { message: "Tenant suspended" } }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const result = await handleBook(ctx, body);
  return NextResponse.json(result.body, { status: result.status });
}
