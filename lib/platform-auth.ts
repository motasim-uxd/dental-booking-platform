export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function assertPlatformSecret(
  req: Request,
  options?: { headerName?: string; envKey?: string }
): { ok: true } | { ok: false; status: number; error: string } {
  const headerName = options?.headerName ?? "x-platform-secret";
  const envKey = options?.envKey ?? "PLATFORM_INTERNAL_SECRET";
  const expected = process.env[envKey]?.trim();
  if (!expected) {
    return { ok: false, status: 503, error: "Platform secret not configured" };
  }

  const provided = (req.headers.get(headerName) ?? "").trim();
  if (!provided || !timingSafeEqual(provided, expected)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true };
}

export function assertConnectWebhookSecret(
  req: Request
): { ok: true } | { ok: false; status: number; error: string } {
  const expected = process.env.CONNECT_WEBHOOK_SECRET?.trim();
  if (!expected) {
    return { ok: false, status: 503, error: "CONNECT_WEBHOOK_SECRET not configured" };
  }

  const provided =
    (req.headers.get("x-api-key") ?? "").trim() ||
    (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  if (!provided || !timingSafeEqual(provided, expected)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true };
}
