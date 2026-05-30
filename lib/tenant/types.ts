import type { OperatoryRulesConfig } from "@/lib/pms/operatory-rules";
import type { PmsType } from "@/lib/pms/types";

export type TenantStatus = "active" | "suspended" | "trial";

export type TenantFeatures = {
  voice?: boolean;
  webForm?: boolean;
};

export type TenantBranding = Record<string, unknown>;

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  features: TenantFeatures;
  branding: TenantBranding;
  maxBots: number;
  webFormAccessCode: string | null;
}

export type BotType = "booking" | "admin" | "faq" | "other";

export interface TenantBot {
  id: string;
  tenantId: string;
  botKey: string;
  botType: BotType;
  lexBotId: string | null;
  lexBotAlias: string | null;
  lambdaArn: string | null;
  connectFlowArn: string | null;
  promptsConfig: Record<string, unknown>;
  capabilities: Record<string, unknown>;
  enabled: boolean;
}

export interface TenantPmsSummary {
  pmsType: PmsType;
  operatoryRules: OperatoryRulesConfig;
  /** Server-side PMS connection config (do not expose in public/resolve-phone APIs). */
  config: Record<string, unknown>;
}

export interface TenantContext {
  tenant: Tenant;
  pms: TenantPmsSummary;
}

export interface TenantBotContext extends TenantContext {
  bot: TenantBot;
  phoneE164?: string;
}

export interface ResolvePhoneResult {
  tenantSlug: string;
  tenantId: string;
  botId: string;
  botKey: string;
  botType: BotType;
  practiceName: string;
  botDisplayName: string;
  pmsType: PmsType;
  operatoryRules: OperatoryRulesConfig;
  capabilities: Record<string, unknown>;
  features: TenantFeatures;
}
