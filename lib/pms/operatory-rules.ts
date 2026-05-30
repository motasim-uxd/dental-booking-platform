/**
 * Tenant-scoped operatory rules (JSON from tenant_pms_config.operatory_rules).
 */

export const DEFAULT_TREATMENT_OPERATORY_ID = 4;

export const DEFAULT_OPERATORY_RULES: OperatoryRulesConfig = {
  treatmentOperatoryId: DEFAULT_TREATMENT_OPERATORY_ID,
  labels: {
    "2": "OP2",
    "3": "OP3",
    "4": "OP4",
    "6": "OP2",
  },
  allowedByType: {
    Cleaning: [6, 2],
    Emergency: [6, 2],
    Consultation: [3],
    Treatment: [4],
  },
};

export interface OperatoryRulesConfig {
  treatmentOperatoryId?: number;
  labels?: Record<string, string>;
  allowedByType?: Record<string, number[]>;
}

export function parseOperatoryRules(raw: unknown): OperatoryRulesConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_OPERATORY_RULES };
  const obj = raw as OperatoryRulesConfig;
  return {
    treatmentOperatoryId:
      obj.treatmentOperatoryId ?? DEFAULT_OPERATORY_RULES.treatmentOperatoryId,
    labels: { ...DEFAULT_OPERATORY_RULES.labels, ...obj.labels },
    allowedByType: { ...DEFAULT_OPERATORY_RULES.allowedByType, ...obj.allowedByType },
  };
}

/** Build rules from legacy SMILE_SQUAD_* env vars (single-tenant transition). */
export function operatoryRulesFromEnv(): OperatoryRulesConfig {
  const rules: OperatoryRulesConfig = { ...DEFAULT_OPERATORY_RULES };

  const treatment = process.env.SMILE_SQUAD_BOOKING_OPERATORY_TREATMENT;
  if (treatment?.trim()) {
    const id = Number(treatment);
    if (Number.isFinite(id) && id > 0) rules.treatmentOperatoryId = id;
  }

  const labelsJson = process.env.SMILE_SQUAD_BOOKING_OPERATORY_LABELS;
  if (labelsJson?.trim()) {
    try {
      const parsed = JSON.parse(labelsJson) as Record<string, string>;
      rules.labels = { ...rules.labels, ...parsed };
    } catch {
      // ignore
    }
  }

  const byTypeJson = process.env.SMILE_SQUAD_BOOKING_OPERATORIES_BY_TYPE;
  if (byTypeJson?.trim()) {
    try {
      const parsed = JSON.parse(byTypeJson) as Record<string, number[]>;
      rules.allowedByType = { ...rules.allowedByType, ...parsed };
    } catch {
      // ignore
    }
  }

  return rules;
}

export function operatoryDisplayLabel(
  operatoryId: number,
  rules: OperatoryRulesConfig = DEFAULT_OPERATORY_RULES
): string {
  const id = Number(operatoryId);
  const label = rules.labels?.[String(id)];
  if (typeof label === "string" && label.trim()) return label.trim();
  return `OP${id}`;
}

export function scheduleApptTypeForOryxQuery(requestedApptType: string): string {
  const t = String(requestedApptType || "").trim();
  if (t === "Consultation" || t === "Emergency" || t === "Treatment") return "Cleaning";
  return t || "Cleaning";
}

export function shouldFallbackScheduleApptType(requestedApptType: string): boolean {
  const t = String(requestedApptType || "").trim();
  return t === "Consultation" || t === "Emergency" || t === "Treatment";
}

export function treatmentOperatoryId(
  rules: OperatoryRulesConfig = DEFAULT_OPERATORY_RULES
): number {
  const id = Number(rules.treatmentOperatoryId ?? DEFAULT_TREATMENT_OPERATORY_ID);
  return Number.isFinite(id) && id > 0 ? id : DEFAULT_TREATMENT_OPERATORY_ID;
}

export function operatoryAllowSet(
  apptType: string,
  rules: OperatoryRulesConfig = DEFAULT_OPERATORY_RULES
): Set<number> {
  const t = String(apptType || "").trim() || "Cleaning";

  if (t === "Treatment") return new Set([treatmentOperatoryId(rules)]);

  const list = rules.allowedByType?.[t];
  if (Array.isArray(list) && list.length) {
    return new Set(list.map((n) => Number(n)).filter((n) => Number.isFinite(n)));
  }

  return new Set([6, 2]);
}

export function filterAvailabilityWithFallback<T extends { operatoryId: number }>(
  rows: T[],
  apptType: string,
  rules: OperatoryRulesConfig = DEFAULT_OPERATORY_RULES
): T[] {
  const allow = operatoryAllowSet(apptType, rules);
  const whitelisted = rows.filter((r) => allow.has(Number(r.operatoryId)));
  if (whitelisted.length) return whitelisted;

  const treatmentOp = treatmentOperatoryId(rules);
  if (String(apptType || "").trim() === "Treatment") {
    return rows.filter((r) => Number(r.operatoryId) === treatmentOp);
  }
  return rows.filter((r) => Number(r.operatoryId) !== treatmentOp);
}

export function coerceScheduleSlots(slots: unknown): unknown[] {
  if (Array.isArray(slots)) return slots;
  if (slots && typeof slots === "object") {
    const obj = slots as Record<string, unknown>;
    const maybe = obj.obj ?? obj.data ?? obj.slots;
    if (Array.isArray(maybe)) return maybe;
  }
  return [];
}

export function isOperatoryAllowedForApptType(
  operatoryId: number,
  apptType: string,
  rules: OperatoryRulesConfig = DEFAULT_OPERATORY_RULES
): boolean {
  return operatoryAllowSet(apptType, rules).has(Number(operatoryId));
}

export function filterAvailabilityByApptType<T extends { operatoryId: number }>(
  rows: T[],
  apptType: string,
  rules: OperatoryRulesConfig = DEFAULT_OPERATORY_RULES
): T[] {
  return filterAvailabilityWithFallback(rows, apptType, rules);
}

export function resolveOralIdFromSlot(
  slot: { oralId?: unknown; providerId?: unknown },
  providerIdToOralId: Map<number, number>
): number | null {
  const oralIdFromSlot = Number(slot?.oralId);
  const providerId = Number(slot?.providerId);
  if (Number.isFinite(oralIdFromSlot) && oralIdFromSlot > 0) return oralIdFromSlot;
  const mapped = providerIdToOralId.get(providerId);
  return mapped != null && Number.isFinite(mapped) && mapped > 0 ? mapped : null;
}
