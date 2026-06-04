import { createHash } from "crypto";

export type FastApiBookingResult = {
  ok: boolean;
  status: string;
  external_appointment_id?: string | null;
  message?: string | null;
};

export function isFastApiConfigured(): boolean {
  const base = (process.env.FASTAPI_BASE_URL ?? "").trim();
  const secret = (process.env.S2S_SHARED_SECRET ?? "").trim();
  return Boolean(base && secret);
}

function fastApiBaseUrl(): string {
  return (process.env.FASTAPI_BASE_URL ?? "").trim().replace(/\/+$/, "");
}

function s2sSecret(): string {
  return (process.env.S2S_SHARED_SECRET ?? "").trim();
}

export function bookingIdempotencyKey(tenantSlug: string, payload: unknown): string {
  return createHash("sha256")
    .update(`${tenantSlug}\n${JSON.stringify(payload ?? {})}`)
    .digest("hex")
    .slice(0, 32);
}

export async function postBooking(params: {
  tenantSlug: string;
  channel: "voice" | "web" | "admin" | "other";
  payload: unknown;
  idempotencyKey?: string;
  timeoutMs?: number;
}): Promise<FastApiBookingResult> {
  const key =
    params.idempotencyKey ?? bookingIdempotencyKey(params.tenantSlug, params.payload);

  const res = await fetch(`${fastApiBaseUrl()}/v1/booking`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-s2s-secret": s2sSecret(),
    },
    body: JSON.stringify({
      tenant_slug: params.tenantSlug,
      channel: params.channel,
      idempotency_key: key,
      payload: params.payload ?? {},
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(params.timeoutMs ?? 10_000),
  }).catch((err) => {
    return new Response(
      JSON.stringify({ ok: false, status: "failed", message: String(err) }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  });

  const text = await res.text();
  try {
    return JSON.parse(text) as FastApiBookingResult;
  } catch {
    return { ok: false, status: "failed", message: "Invalid FastAPI response" };
  }
}

export async function getAvailability(params: {
  tenantSlug: string;
  date: string;
  apptType: string;
  firstAvail?: boolean;
}): Promise<{ success: boolean; data?: unknown[]; error?: string }> {
  const url = new URL(`${fastApiBaseUrl()}/v1/availability`);
  url.searchParams.set("tenant_slug", params.tenantSlug);
  url.searchParams.set("date", params.date);
  url.searchParams.set("appt_type", params.apptType);
  url.searchParams.set("first_avail", params.firstAvail ? "true" : "false");

  const res = await fetch(url.toString(), {
    headers: { "x-s2s-secret": s2sSecret() },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch((err) => ({
    ok: false,
    json: async () => ({ success: false, error: String(err) }),
  }));

  const json = (await (res as Response).json().catch(() => null)) as {
    success?: boolean;
    data?: unknown[];
    error?: string;
  } | null;

  if (!json?.success) {
    return { success: false, error: json?.error ?? "Availability failed" };
  }
  return { success: true, data: json.data ?? [] };
}

/** Lex /api/book wrapper shape */
export function toLexBookJson(json: FastApiBookingResult) {
  const status = String(json.status || "");
  const ok = Boolean(json.ok) && (status === "confirmed" || status === "partial");
  return {
    success: true as const,
    data: {
      success: ok,
      message: json.message ?? (ok ? "Booked" : "Booking failed"),
      externalAppointmentId:
        json.external_appointment_id != null ? String(json.external_appointment_id) : undefined,
    },
  };
}

/** Web book routes — match handleBook success body */
export function toWebBookResult(json: FastApiBookingResult): {
  status: number;
  body: { success: boolean; data?: unknown; error?: unknown };
} {
  const status = String(json.status || "");
  const ok = Boolean(json.ok) && (status === "confirmed" || status === "partial");
  if (!ok) {
    return {
      status: 502,
      body: {
        success: false,
        error: { message: json.message ?? "Booking failed" },
      },
    };
  }
  return {
    status: 200,
    body: {
      success: true,
      data: {
        success: true,
        externalAppointmentId: json.external_appointment_id,
        status: json.status,
        message: json.message,
      },
    },
  };
}
