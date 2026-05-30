const SESSION_SALT = "practice-session-v1";

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bytesToHex(sig);
}

/** Same secret must be used for sign + verify (middleware + API routes). */
export function practiceSessionSecret(): string | null {
  return (
    process.env.PRACTICE_SESSION_SECRET?.trim() ||
    process.env.PLATFORM_INTERNAL_SECRET?.trim() ||
    process.env.PLATFORM_ADMIN_SECRET?.trim() ||
    null
  );
}

function sessionSecret(): string | null {
  return practiceSessionSecret();
}

export async function signPracticeSession(userId: string): Promise<string | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const sig = await hmacHex(secret, `${SESSION_SALT}:${userId}`);
  return `${userId}.${sig}`;
}

export async function verifyPracticeSessionCookie(cookie: string): Promise<string | null> {
  const secret = sessionSecret();
  if (!secret || !cookie) return null;
  const dot = cookie.indexOf(".");
  if (dot <= 0) return null;
  const userId = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  if (!userId || !sig) return null;
  const expected = await hmacHex(secret, `${SESSION_SALT}:${userId}`);
  if (sig.length !== expected.length) return null;
  let ok = 0;
  for (let i = 0; i < sig.length; i++) ok |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return ok === 0 ? userId : null;
}
