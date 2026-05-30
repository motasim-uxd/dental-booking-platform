const RL_WINDOW_MS = 60_000;
const RL_MAX = 30;
const rl = new Map<string, { resetAt: number; count: number }>();

function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const first = xff.split(",")[0]?.trim();
  return first || null;
}

export function rateLimit(
  req: Request
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const key = getClientIp(req) ?? "unknown";
  const now = Date.now();
  const cur = rl.get(key);
  if (!cur || cur.resetAt <= now) {
    rl.set(key, { resetAt: now + RL_WINDOW_MS, count: 1 });
    return { ok: true };
  }
  if (cur.count >= RL_MAX) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)) };
  }
  cur.count += 1;
  return { ok: true };
}
