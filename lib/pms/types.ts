import type { BookOnlineApptInput } from "@/lib/oryxClient";
import type { OperatoryRulesConfig } from "@/lib/pms/operatory-rules";

export type PmsType = "oryx" | "open_dental" | "dentrix" | "custom_api";

export interface TenantPmsConfigRecord {
  pmsType: PmsType;
  config: Record<string, unknown>;
  operatoryRules: OperatoryRulesConfig;
}

export interface PmsAdapter {
  readonly pmsType: PmsType;
  readonly operatoryRules: OperatoryRulesConfig;
  getPracticeInfo(): Promise<unknown>;
  getProviders(apptType: string): Promise<unknown>;
  getAvailability(params: {
    apptType: string;
    dateISO: string;
    firstAvail?: boolean;
  }): Promise<unknown>;
  bookAppointment(input: BookOnlineApptInput): Promise<unknown>;
}
