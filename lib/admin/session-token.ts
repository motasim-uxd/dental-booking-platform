const SESSION_SALT = "platform-admin-session-v1";

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeAdminSessionToken(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(SESSION_SALT));
  return bytesToHex(sig);
}

export async function resolveAdminSessionToken(): Promise<string | null> {
  const direct = process.env.ADMIN_SESSION_TOKEN?.trim();
  if (direct) return direct;

  const secret = process.env.PLATFORM_ADMIN_SECRET?.trim();
  if (!secret) return null;

  return computeAdminSessionToken(secret);
}
