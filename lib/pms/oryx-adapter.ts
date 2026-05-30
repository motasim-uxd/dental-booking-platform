import type { BookOnlineApptInput, OryxApptType, OryxRealm } from "@/lib/oryxClient";
import { OryxClient } from "@/lib/oryxClient";
import type { OperatoryRulesConfig } from "@/lib/pms/operatory-rules";
import type { PmsAdapter } from "@/lib/pms/types";

export interface OryxPmsConfig {
  realm: string;
  baseUrl?: string;
}

export class OryxPmsAdapter implements PmsAdapter {
  readonly pmsType = "oryx" as const;
  readonly operatoryRules: OperatoryRulesConfig;
  private readonly client: OryxClient;

  constructor(config: OryxPmsConfig, operatoryRules: OperatoryRulesConfig) {
    this.operatoryRules = operatoryRules;
    this.client = new OryxClient({
      realm: config.realm as OryxRealm,
      baseUrl: config.baseUrl,
    });
  }

  getPracticeInfo() {
    return this.client.getPracticeInfo();
  }

  getProviders(apptType: string) {
    return this.client.getProviders(apptType as OryxApptType);
  }

  getAvailability(params: { apptType: string; dateISO: string; firstAvail?: boolean }) {
    return this.client.getScheduleForDate({
      apptType: params.apptType as OryxApptType,
      dateISO: params.dateISO,
      firstAvail: params.firstAvail,
    });
  }

  bookAppointment(input: BookOnlineApptInput) {
    return this.client.bookOnlineAppointment(input);
  }
}
