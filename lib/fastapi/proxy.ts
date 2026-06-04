export function fastApiConfigured(): boolean {
  const base = (process.env.FASTAPI_BASE_URL ?? "").trim();
  const secret = (process.env.S2S_SHARED_SECRET ?? "").trim();
  return Boolean(base && secret);
}

export async function fastApiFetch(
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const base = (process.env.FASTAPI_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const secret = (process.env.S2S_SHARED_SECRET ?? "").trim();
  if (!base || !secret) {
    return new Response(JSON.stringify({ ok: false, error: "FastAPI not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const timeoutMs = init?.timeoutMs ?? 15_000;
  const { timeoutMs: _t, ...rest } = init ?? {};

  return fetch(`${base}${path}`, {
    ...rest,
    headers: {
      "content-type": "application/json",
      "x-s2s-secret": secret,
      ...(rest.headers ?? {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((err) => {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  });
}
