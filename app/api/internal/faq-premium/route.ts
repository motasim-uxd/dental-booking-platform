import { NextResponse } from "next/server";
import { fastApiFetch } from "@/lib/fastapi/proxy";
import { assertPlatformSecret } from "@/lib/platform-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Complex FAQ → FastAPI Claude premium layer (diagram).
 */
export async function POST(req: Request) {
  const auth = assertPlatformSecret(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const body = await req.text();
  const res = await fastApiFetch("/v1/faq/premium", {
    method: "POST",
    body,
    timeoutMs: 25_000,
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}
