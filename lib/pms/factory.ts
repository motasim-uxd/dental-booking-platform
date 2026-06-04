import { OryxPmsAdapter, type OryxPmsConfig } from "@/lib/pms/oryx-adapter";
import { parseOperatoryRules } from "@/lib/pms/operatory-rules";
import type { PmsAdapter, PmsType, TenantPmsConfigRecord } from "@/lib/pms/types";

export function createPmsAdapter(record: TenantPmsConfigRecord): PmsAdapter {
  const operatoryRules = parseOperatoryRules(record.operatoryRules);

  switch (record.pmsType) {
    case "oryx": {
      const config = record.config as unknown as OryxPmsConfig;
      if (!config?.realm || typeof config.realm !== "string") {
        throw new Error("Oryx PMS config requires realm");
      }
      return new OryxPmsAdapter(
        { realm: config.realm, baseUrl: config.baseUrl },
        operatoryRules
      );
    }
    case "internal":
      // Booking/availability for internal tenants go through FastAPI (see lib/booking/fastapi-client.ts).
      return new OryxPmsAdapter({ realm: "internal-via-fastapi" }, operatoryRules);
    case "open_dental":
    case "dentrix":
    case "custom_api":
      throw new Error(`PMS adapter not implemented: ${record.pmsType}`);
    default:
      throw new Error(`Unknown PMS type: ${record.pmsType as PmsType}`);
  }
}
