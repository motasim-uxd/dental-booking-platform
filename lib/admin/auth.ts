import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin/constants";
import { resolveAdminSessionToken } from "@/lib/admin/session-token";

export { ADMIN_COOKIE };

export async function getAdminSessionToken(): Promise<string | null> {
  return resolveAdminSessionToken();
}

export function verifyAdminPassword(password: string): boolean {
  const secret = process.env.PLATFORM_ADMIN_SECRET?.trim();
  if (!secret || !password) return false;
  if (password.length !== secret.length) {
    // still do comparison to reduce timing leak on length only slightly
    const dummy = secret;
    timingSafeEqual(Buffer.from(dummy), Buffer.from(dummy));
    return false;
  }
  return timingSafeEqual(Buffer.from(password), Buffer.from(secret));
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const expected = await getAdminSessionToken();
  if (!expected) return false;
  const jar = await cookies();
  const got = jar.get(ADMIN_COOKIE)?.value ?? "";
  if (!got || got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function assertAdminRequest(
  req: Request
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const expected = await getAdminSessionToken();
  if (!expected) {
    return { ok: false, status: 503, error: "PLATFORM_ADMIN_SECRET not configured" };
  }

  const header = (req.headers.get("x-admin-secret") ?? "").trim();
  if (header && header.length === expected.length) {
    try {
      if (timingSafeEqual(Buffer.from(header), Buffer.from(expected))) {
        return { ok: true };
      }
    } catch {
      /* fall through */
    }
  }

  return { ok: false, status: 401, error: "Unauthorized" };
}

export async function assertAdminApi(
  req: Request
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (await isAdminAuthenticated()) return { ok: true };
  return assertAdminRequest(req);
}
