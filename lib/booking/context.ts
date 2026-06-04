import { isDatabaseConfigured } from "@/lib/db";
import { createPmsAdapter } from "@/lib/pms/factory";
import {
  DEFAULT_OPERATORY_RULES,
  operatoryRulesFromEnv,
  type OperatoryRulesConfig,
} from "@/lib/pms/operatory-rules";
import type { PmsAdapter } from "@/lib/pms/types";
import { resolveTenantFromSlug } from "@/lib/tenant/resolver";
import type { IntegrationMode, Tenant, TenantFeatures } from "@/lib/tenant/types";

export const DEFAULT_TENANT_SLUG = "smilesquad";

export interface BookingContext {
  tenant: Tenant;
  adapter: PmsAdapter;
  operatoryRules: OperatoryRulesConfig;
  integrationMode: IntegrationMode;
  fromDatabase: boolean;
}

function fallbackTenant(slug: string): Tenant {
  return {
    id: "legacy-smilesquad",
    slug,
    name: "Smile Squad Pediatric Dentistry",
    status: "active",
    features: { voice: true, webForm: true },
    branding: {},
    maxBots: 8,
    webFormAccessCode: process.env.WEB_FORM_PREVIEW_CODE?.trim() || null,
  };
}

/** Load tenant + PMS adapter for booking APIs. Falls back to env-based Smile Squad when DB unavailable. */
export async function loadBookingContext(
  slug: string = DEFAULT_TENANT_SLUG
): Promise<BookingContext | null> {
  const normalized = slug.trim().toLowerCase();

  if (isDatabaseConfigured()) {
    const ctx = await resolveTenantFromSlug(normalized);
    if (!ctx) return normalized === DEFAULT_TENANT_SLUG ? legacyFallback() : null;
    if (ctx.tenant.status === "suspended") return null;

    const adapter = createPmsAdapter({
      pmsType: ctx.pms.pmsType,
      config: ctx.pms.config,
      operatoryRules: ctx.pms.operatoryRules,
    });

    return {
      tenant: ctx.tenant,
      adapter,
      operatoryRules: ctx.pms.operatoryRules,
      integrationMode: ctx.pms.integrationMode,
      fromDatabase: true,
    };
  }

  if (normalized !== DEFAULT_TENANT_SLUG) return null;
  return legacyFallback();
}

function legacyFallback(): BookingContext {
  const rules = operatoryRulesFromEnv();
  const adapter = createPmsAdapter({
    pmsType: "oryx",
    config: { realm: "smilesquadpd" },
    operatoryRules: rules,
  });

  return {
    tenant: fallbackTenant(DEFAULT_TENANT_SLUG),
    adapter,
    operatoryRules: rules,
    integrationMode: "external_only",
    fromDatabase: false,
  };
}

export function tenantRequiresAccessCode(tenant: Tenant): boolean {
  return Boolean(
    tenant.webFormAccessCode?.trim() || process.env.WEB_FORM_PREVIEW_CODE?.trim()
  );
}

export function getEffectiveAccessCode(tenant: Tenant): string | null {
  return tenant.webFormAccessCode?.trim() || process.env.WEB_FORM_PREVIEW_CODE?.trim() || null;
}

export function tenantFeatures(tenant: Tenant): TenantFeatures {
  return tenant.features ?? {};
}

export function isWebFormEnabled(tenant: Tenant): boolean {
  return tenantFeatures(tenant).webForm !== false;
}

export function assertWebFormFeature(
  tenant: Tenant
): { ok: true } | { ok: false; status: number; error: string } {
  if (!isWebFormEnabled(tenant)) {
    return { ok: false, status: 403, error: "Web booking is not enabled for this practice" };
  }
  return { ok: true };
}

export { DEFAULT_OPERATORY_RULES };
