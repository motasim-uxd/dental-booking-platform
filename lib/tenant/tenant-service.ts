import { prisma } from "@/lib/db";
import { parseOperatoryRules } from "@/lib/pms/operatory-rules";
import type { PmsType } from "@/lib/pms/types";
import type {
  Tenant,
  TenantBot,
  TenantBotContext,
  TenantContext,
  TenantFeatures,
  TenantPmsSummary,
  TenantStatus,
} from "@/lib/tenant/types";

const CACHE_TTL_MS = 60_000;

type CacheEntry<T> = { expiresAt: number; value: T };

function mapTenant(row: {
  id: string;
  slug: string;
  name: string;
  status: string;
  features: unknown;
  branding: unknown;
  maxBots: number;
  webFormAccessCode: string | null;
}): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status as TenantStatus,
    features: (row.features ?? {}) as TenantFeatures,
    branding: (row.branding ?? {}) as Record<string, unknown>,
    maxBots: row.maxBots,
    webFormAccessCode: row.webFormAccessCode,
  };
}

function mapBot(row: {
  id: string;
  tenantId: string;
  botKey: string;
  botType: string;
  lexBotId: string | null;
  lexBotAlias: string | null;
  lambdaArn: string | null;
  connectFlowArn: string | null;
  promptsConfig: unknown;
  capabilities: unknown;
  enabled: boolean;
}): TenantBot {
  return {
    id: row.id,
    tenantId: row.tenantId,
    botKey: row.botKey,
    botType: row.botType as TenantBot["botType"],
    lexBotId: row.lexBotId,
    lexBotAlias: row.lexBotAlias,
    lambdaArn: row.lambdaArn,
    connectFlowArn: row.connectFlowArn,
    promptsConfig: (row.promptsConfig ?? {}) as Record<string, unknown>,
    capabilities: (row.capabilities ?? {}) as Record<string, unknown>,
    enabled: row.enabled,
  };
}

function mapPms(row: {
  pmsType: string;
  integrationMode?: string;
  dualBookingEnabled?: boolean;
  config: unknown;
  operatoryRules: unknown;
}): TenantPmsSummary {
  const mode = row.integrationMode ?? "external_only";
  return {
    pmsType: row.pmsType as PmsType,
    integrationMode:
      mode === "internal_only" || mode === "dual" ? mode : "external_only",
    dualBookingEnabled: Boolean(row.dualBookingEnabled),
    operatoryRules: parseOperatoryRules(row.operatoryRules),
    config: (row.config ?? {}) as Record<string, unknown>,
  };
}

function normalizeE164(did: string): string {
  const trimmed = did.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export class TenantService {
  private slugCache = new Map<string, CacheEntry<TenantContext | null>>();
  private idCache = new Map<string, CacheEntry<TenantContext | null>>();
  private phoneCache = new Map<string, CacheEntry<TenantBotContext | null>>();

  private getCached<T>(map: Map<string, CacheEntry<T>>, key: string): T | undefined {
    const entry = map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      map.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private setCached<T>(map: Map<string, CacheEntry<T>>, key: string, value: T): void {
    map.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  }

  async loadBySlug(slug: string): Promise<TenantContext | null> {
    const key = slug.trim().toLowerCase();
    const cached = this.getCached(this.slugCache, key);
    if (cached !== undefined) return cached;

    const row = await prisma.tenant.findUnique({
      where: { slug: key },
      include: { pmsConfig: true },
    });

    if (!row?.pmsConfig) {
      this.setCached(this.slugCache, key, null);
      return null;
    }

    const ctx: TenantContext = {
      tenant: mapTenant(row),
      pms: mapPms(row.pmsConfig),
    };
    this.setCached(this.slugCache, key, ctx);
    return ctx;
  }

  async loadById(id: string): Promise<TenantContext | null> {
    const cached = this.getCached(this.idCache, id);
    if (cached !== undefined) return cached;

    const row = await prisma.tenant.findUnique({
      where: { id },
      include: { pmsConfig: true },
    });

    if (!row?.pmsConfig) {
      this.setCached(this.idCache, id, null);
      return null;
    }

    const ctx: TenantContext = {
      tenant: mapTenant(row),
      pms: mapPms(row.pmsConfig),
    };
    this.setCached(this.idCache, id, ctx);
    return ctx;
  }

  async loadByPhoneE164(did: string): Promise<TenantBotContext | null> {
    const e164 = normalizeE164(did);
    const cached = this.getCached(this.phoneCache, e164);
    if (cached !== undefined) return cached;

    const phone = await prisma.tenantPhoneNumber.findUnique({
      where: { e164 },
      include: {
        tenant: { include: { pmsConfig: true } },
        bot: true,
      },
    });

    if (!phone?.tenant.pmsConfig) {
      this.setCached(this.phoneCache, e164, null);
      return null;
    }

    const ctx: TenantBotContext = {
      tenant: mapTenant(phone.tenant),
      pms: mapPms(phone.tenant.pmsConfig),
      bot: mapBot(phone.bot),
      phoneE164: e164,
    };
    this.setCached(this.phoneCache, e164, ctx);
    return ctx;
  }

  clearCache(): void {
    this.slugCache.clear();
    this.idCache.clear();
    this.phoneCache.clear();
  }
}

let singleton: TenantService | undefined;

export function getTenantService(): TenantService {
  if (!singleton) singleton = new TenantService();
  return singleton;
}
