import { timingSafeEqual } from "@/lib/platform-auth";
import type { Tenant } from "@/lib/tenant/types";
import { getEffectiveAccessCode } from "@/lib/booking/context";

export function assertWebPreviewCode(
  req: Request,
  tenant: Tenant
): { ok: true } | { ok: false; status: number; error: string } {
  const expected = getEffectiveAccessCode(tenant);
  if (!expected) return { ok: true };

  const url = new URL(req.url);
  const provided =
    (req.headers.get("x-preview-code") ?? "").trim() ||
    (req.headers.get("x-web-form-preview-code") ?? "").trim() ||
    (url.searchParams.get("code") ?? "").trim();

  if (!provided || !timingSafeEqual(provided, expected)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true };
}
