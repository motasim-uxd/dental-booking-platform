import type { Tenant, TenantBranding } from "@/lib/tenant/types";

export type TenantBookBranding = {
  slug: string;
  practiceName: string;
  displayName: string;
  tagline?: string;
  address?: string;
  phone?: string;
  websiteUrl?: string;
};

const SMILESQUAD_DEFAULTS: Omit<TenantBookBranding, "slug" | "practiceName"> = {
  displayName: "Smile Squad",
  tagline: "Pediatric Dentistry",
  address: "355 W Main St, Leola, PA 17540",
  phone: "+1 (717) 884-8807",
  websiteUrl: "https://smilesquad.kids/",
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Map tenant + branding JSON to web booking UI fields. */
export function tenantBookBranding(tenant: Tenant): TenantBookBranding {
  const b = (tenant.branding ?? {}) as TenantBranding;
  const defaults =
    tenant.slug === "smilesquad" ? SMILESQUAD_DEFAULTS : { displayName: tenant.name };

  return {
    slug: tenant.slug,
    practiceName: tenant.name,
    displayName: str(b.displayName) ?? defaults.displayName ?? tenant.name,
    tagline: str(b.tagline) ?? defaults.tagline,
    address: str(b.address) ?? defaults.address,
    phone: str(b.phone) ?? defaults.phone,
    websiteUrl: str(b.websiteUrl) ?? defaults.websiteUrl,
  };
}

export function phoneTelHref(phone?: string): string {
  if (!phone?.trim()) return "";
  return `tel:${phone.replace(/\D/g, "")}`;
}
