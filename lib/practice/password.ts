import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const sep = stored.indexOf(":");
  if (sep <= 0) return false;
  const salt = stored.slice(0, sep);
  const hash = stored.slice(sep + 1);
  if (!salt || !hash) return false;
  try {
    const got = scryptSync(password, salt, KEY_LEN);
    const expected = Buffer.from(hash, "hex");
    if (got.length !== expected.length) return false;
    return timingSafeEqual(got, expected);
  } catch {
    return false;
  }
}
