import { NextResponse } from "next/server";
import { handleBook } from "@/lib/booking/book";
import { DEFAULT_TENANT_SLUG, loadBookingContext } from "@/lib/booking/context";
import { assertConnectWebhookSecret } from "@/lib/platform-auth";
import { createHash } from "crypto";

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

  // Prefer FastAPI booking service if configured; fall back to legacy in-process handler otherwise.
  const fastapiBase = (process.env.FASTAPI_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const s2s = (process.env.S2S_SHARED_SECRET ?? "").trim();

  if (fastapiBase && s2s) {
    // Idempotency: stable hash of tenant + raw payload (retries from Connect/Lex repeat the same body).
    const idempotencyKey = createHash("sha256")
      .update(`${slug}\n${JSON.stringify(body ?? {})}`)
      .digest("hex")
      .slice(0, 32);

    const upstreamBody = {
      tenant_slug: slug,
      channel: "voice",
      idempotency_key: idempotencyKey,
      payload: body ?? {},
    };

    const res = await fetch(`${fastapiBase}/v1/booking`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-s2s-secret": s2s },
      body: JSON.stringify(upstreamBody),
      cache: "no-store",
      // Voice target: keep within ~10s.
      signal: AbortSignal.timeout(10_000),
    }).catch((err) => {
      return new Response(JSON.stringify({ ok: false, status: "failed", message: String(err) }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    const ok = Boolean(json?.ok) && String(json?.status || "") === "confirmed";
    const message = typeof json?.message === "string" ? json.message : undefined;
    const externalAppointmentId =
      json?.external_appointment_id != null ? String(json.external_appointment_id) : undefined;

    // Keep legacy Lex expectations:
    // - HTTP 200
    // - booked = result.success === true && result.data.success === true
    return NextResponse.json(
      {
        success: true,
        data: {
          success: ok,
          message: message ?? (ok ? "Booked" : "Booking failed"),
          externalAppointmentId,
        },
      },
      { status: 200 }
    );
  }

  const result = await handleBook(ctx, body);
  return NextResponse.json(result.body, { status: result.status });
}
