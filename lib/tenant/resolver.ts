import { getTenantService } from "@/lib/tenant/tenant-service";
import type {
  ResolvePhoneResult,
  TenantBotContext,
  TenantContext,
} from "@/lib/tenant/types";

export async function resolveTenantFromSlug(slug: string): Promise<TenantContext | null> {
  return getTenantService().loadBySlug(slug);
}

export async function resolveTenantBotFromPhone(
  did: string
): Promise<TenantBotContext | null> {
  return getTenantService().loadByPhoneE164(did);
}

export function toResolvePhoneResult(ctx: TenantBotContext): ResolvePhoneResult {
  const prompts = ctx.bot.promptsConfig ?? {};
  const displayName =
    typeof prompts.displayName === "string" && prompts.displayName.trim()
      ? prompts.displayName.trim()
      : "Amy";

  return {
    tenantSlug: ctx.tenant.slug,
    tenantId: ctx.tenant.id,
    botId: ctx.bot.id,
    botKey: ctx.bot.botKey,
    botType: ctx.bot.botType,
    practiceName: ctx.tenant.name,
    botDisplayName: displayName,
    pmsType: ctx.pms.pmsType,
    operatoryRules: ctx.pms.operatoryRules,
    capabilities: ctx.bot.capabilities,
    features: ctx.tenant.features ?? {},
  };
}
