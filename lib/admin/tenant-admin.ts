import { prisma } from "@/lib/db";
import { DEFAULT_OPERATORY_RULES } from "@/lib/pms/operatory-rules";
import { getTenantService } from "@/lib/tenant/tenant-service";
import type {
  BotType,
  IntegrationMode,
  PmsType,
  Prisma,
  TenantStatus,
} from "@prisma/client";

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && slug.length >= 2 && slug.length <= 48;
}

export function normalizeE164(did: string): string {
  const trimmed = did.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function invalidateTenantCache() {
  getTenantService().clearCache();
}

export async function listTenants() {
  return prisma.tenant.findMany({
    orderBy: { name: "asc" },
    include: {
      pmsConfig: { select: { pmsType: true } },
      bots: { select: { id: true, botKey: true, enabled: true, botType: true } },
      phoneNumbers: { select: { id: true, e164: true, label: true } },
      _count: { select: { bots: true, phoneNumbers: true } },
    },
  });
}

export async function getTenantDetail(id: string) {
  return prisma.tenant.findUnique({
    where: { id },
    include: {
      pmsConfig: true,
      bots: { orderBy: { botKey: "asc" } },
      phoneNumbers: { include: { bot: { select: { botKey: true, botType: true } } } },
      subscription: true,
    },
  });
}

export type CreateTenantInput = {
  slug: string;
  name: string;
  status?: TenantStatus;
  features?: { voice?: boolean; webForm?: boolean };
  branding?: Record<string, unknown>;
  webFormAccessCode?: string | null;
  pmsType?: PmsType;
  oryxRealm?: string;
  operatoryRules?: Record<string, unknown>;
};

export async function createTenant(input: CreateTenantInput) {
  const slug = normalizeSlug(input.slug);
  if (!isValidSlug(slug)) throw new Error("Invalid slug (use lowercase letters, numbers, hyphens)");

  const features = {
    voice: input.features?.voice !== false,
    webForm: input.features?.webForm === true,
  };

  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: input.name.trim(),
      status: input.status ?? "active",
      features,
      branding: asJson((input.branding ?? {}) as Record<string, unknown>),
      webFormAccessCode: input.webFormAccessCode?.trim() || null,
      pmsConfig: {
        create: {
          pmsType: input.pmsType ?? "oryx",
          config: asJson({
            realm: input.oryxRealm?.trim() || slug,
            baseUrl: "https://mychart.myoryx.com",
          }),
          operatoryRules: asJson(
            (input.operatoryRules ?? DEFAULT_OPERATORY_RULES) as Record<string, unknown>
          ),
        },
      },
      bots: {
        create: {
          botKey: "booking",
          botType: "booking",
          enabled: true,
          promptsConfig: { displayName: "Amy", role: "receptionist" },
          capabilities: { book: true, availability: true, inbound: true },
        },
      },
      subscription: { create: { status: "active" } },
    },
    include: { pmsConfig: true, bots: true },
  });

  invalidateTenantCache();
  return tenant;
}

export type UpdateTenantInput = {
  name?: string;
  status?: TenantStatus;
  features?: { voice?: boolean; webForm?: boolean };
  branding?: Record<string, unknown>;
  webFormAccessCode?: string | null;
  maxBots?: number;
  pmsType?: PmsType;
  oryxRealm?: string;
  operatoryRules?: Record<string, unknown>;
  integrationMode?: IntegrationMode;
  dualBookingEnabled?: boolean;
};

export async function updateTenant(id: string, input: UpdateTenantInput) {
  const existing = await prisma.tenant.findUnique({ where: { id } });
  if (!existing) return null;

  const features =
    input.features !== undefined
      ? {
          voice: input.features.voice !== false,
          webForm: input.features.webForm === true,
        }
      : undefined;

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(features !== undefined ? { features } : {}),
        ...(input.branding !== undefined
          ? { branding: asJson(input.branding as Record<string, unknown>) }
          : {}),
        ...(input.webFormAccessCode !== undefined
          ? { webFormAccessCode: input.webFormAccessCode?.trim() || null }
          : {}),
        ...(input.maxBots !== undefined ? { maxBots: input.maxBots } : {}),
      },
    });

    if (
      input.pmsType !== undefined ||
      input.oryxRealm !== undefined ||
      input.operatoryRules !== undefined ||
      input.integrationMode !== undefined ||
      input.dualBookingEnabled !== undefined
    ) {
      const current = await tx.tenantPmsConfig.findUnique({ where: { tenantId: id } });
      const config = (current?.config ?? {}) as Record<string, unknown>;
      if (input.oryxRealm !== undefined) config.realm = input.oryxRealm.trim();

      await tx.tenantPmsConfig.upsert({
        where: { tenantId: id },
        create: {
          tenantId: id,
          pmsType: input.pmsType ?? "oryx",
          config: asJson(config),
          operatoryRules: asJson(
            (input.operatoryRules ?? DEFAULT_OPERATORY_RULES) as Record<string, unknown>
          ),
        },
        update: {
          ...(input.pmsType !== undefined ? { pmsType: input.pmsType } : {}),
          ...(input.oryxRealm !== undefined ? { config: asJson(config) } : {}),
          ...(input.operatoryRules !== undefined
            ? { operatoryRules: asJson(input.operatoryRules as Record<string, unknown>) }
            : {}),
          ...(input.integrationMode !== undefined
            ? { integrationMode: input.integrationMode }
            : {}),
          ...(input.dualBookingEnabled !== undefined
            ? { dualBookingEnabled: input.dualBookingEnabled }
            : {}),
        },
      });
    }
  });

  invalidateTenantCache();
  return getTenantDetail(id);
}

export async function deleteTenant(id: string) {
  await prisma.tenant.delete({ where: { id } });
  invalidateTenantCache();
}

export type UpsertBotInput = {
  botKey: string;
  botType: BotType;
  displayName?: string;
  enabled?: boolean;
  lexBotId?: string | null;
  lexBotAlias?: string | null;
  lambdaArn?: string | null;
  connectFlowArn?: string | null;
};

export async function createBot(tenantId: string, input: UpsertBotInput) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { _count: { select: { bots: true } } },
  });
  if (!tenant) throw new Error("Tenant not found");
  if (tenant._count.bots >= tenant.maxBots) {
    throw new Error(`Maximum ${tenant.maxBots} bots per tenant`);
  }

  const botKey = input.botKey.trim().toLowerCase().replace(/\s+/g, "_");
  if (!botKey) throw new Error("botKey required");

  const bot = await prisma.tenantBot.create({
    data: {
      tenantId,
      botKey,
      botType: input.botType,
      enabled: input.enabled !== false,
      lexBotId: input.lexBotId?.trim() || null,
      lexBotAlias: input.lexBotAlias?.trim() || null,
      lambdaArn: input.lambdaArn?.trim() || null,
      connectFlowArn: input.connectFlowArn?.trim() || null,
      promptsConfig: {
        displayName: input.displayName?.trim() || botKey,
      },
      capabilities: {},
    },
  });

  invalidateTenantCache();
  return bot;
}

export async function updateBot(botId: string, input: Partial<UpsertBotInput>) {
  const existing = await prisma.tenantBot.findUnique({ where: { id: botId } });
  if (!existing) return null;

  const prompts = (existing.promptsConfig ?? {}) as Record<string, unknown>;
  if (input.displayName !== undefined) {
    prompts.displayName = input.displayName.trim();
  }

  const bot = await prisma.tenantBot.update({
    where: { id: botId },
    data: {
      ...(input.botType !== undefined ? { botType: input.botType } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.lexBotId !== undefined ? { lexBotId: input.lexBotId?.trim() || null } : {}),
      ...(input.lexBotAlias !== undefined ? { lexBotAlias: input.lexBotAlias?.trim() || null } : {}),
      ...(input.lambdaArn !== undefined ? { lambdaArn: input.lambdaArn?.trim() || null } : {}),
      ...(input.connectFlowArn !== undefined
        ? { connectFlowArn: input.connectFlowArn?.trim() || null }
        : {}),
      ...(input.displayName !== undefined
        ? { promptsConfig: asJson(prompts) }
        : {}),
    },
  });

  invalidateTenantCache();
  return bot;
}

export async function deleteBot(botId: string) {
  await prisma.tenantBot.delete({ where: { id: botId } });
  invalidateTenantCache();
}

export async function createPhone(tenantId: string, botId: string, e164: string, label?: string) {
  const normalized = normalizeE164(e164);
  if (!normalized) throw new Error("Phone number required");

  const bot = await prisma.tenantBot.findFirst({ where: { id: botId, tenantId } });
  if (!bot) throw new Error("Bot not found for tenant");

  const existing = await prisma.tenantPhoneNumber.findUnique({
    where: { e164: normalized },
    include: { tenant: { select: { slug: true } } },
  });
  if (existing) {
    if (existing.tenantId === tenantId) {
      throw new Error(
        `This number (${normalized}) is already registered for this practice. Edit it in the list above or remove it first.`
      );
    }
    throw new Error(
      `This number (${normalized}) is already used by tenant "${existing.tenant.slug}". Each DID can only be mapped once.`
    );
  }

  const phone = await prisma.tenantPhoneNumber.create({
    data: {
      tenantId,
      botId,
      e164: normalized,
      label: label?.trim() || null,
    },
  });

  invalidateTenantCache();
  return phone;
}

export async function deletePhone(phoneId: string) {
  await prisma.tenantPhoneNumber.delete({ where: { id: phoneId } });
  invalidateTenantCache();
}
