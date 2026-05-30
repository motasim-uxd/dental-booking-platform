import {
  assertConnectWebhookSecret,
  timingSafeEqual,
} from "@/lib/platform-auth";
import { getEffectiveAccessCode, tenantFeatures } from "@/lib/booking/context";
import type { Tenant } from "@/lib/tenant/types";

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

/** Web preview code and/or Connect/Lex shared secret (server-to-server). */
export function assertTenantChannelAuth(
  req: Request,
  tenant: Tenant
): { ok: true } | { ok: false; status: number; error: string } {
  const features = tenantFeatures(tenant);
  const preview = assertWebPreviewCode(req, tenant);
  if (preview.ok) return preview;

  const connect = assertConnectWebhookSecret(req);
  if (connect.ok) {
    if (features.voice === false) {
      return { ok: false, status: 403, error: "Voice booking is not enabled for this practice" };
    }
    return { ok: true };
  }

  return connect;
}
