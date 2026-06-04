import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(req: Request) {
  const baseUrl = (process.env.FASTAPI_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!baseUrl) {
    return NextResponse.json({ ok: false, error: "FASTAPI_BASE_URL not set" }, { status: 500 });
  }

  const secret = (process.env.S2S_SHARED_SECRET ?? "").trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "S2S_SHARED_SECRET not set" }, { status: 500 });
  }

  const bodyText = await req.text();
  const res = await fetch(`${baseUrl}/v1/booking`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-s2s-secret": secret },
    body: bodyText,
    cache: "no-store",
  }).catch((err) => {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  });

  const upstreamText = await res.text();
  return new NextResponse(upstreamText, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

